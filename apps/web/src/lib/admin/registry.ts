import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import type { CrawlerPurpose, LifecycleStatus } from "@crawlpact/registry";
import { buildCanonicalSnapshot } from "../registry-snapshot";
import { computeRegistryChecksum } from "../registry-checksum";
import { computeSemanticDiff, type RegistrySemanticDiff } from "../registry-semantic-diff";

// --- Operators ---------------------------------------------------------------

export async function listOperators(db: Database) {
  return db.select().from(schema.crawlerOperators).orderBy(schema.crawlerOperators.name);
}

export async function createOperator(
  db: Database,
  params: { name: string; websiteUrl?: string | null },
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.crawlerOperators).values({
    id,
    name: params.name,
    websiteUrl: params.websiteUrl ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

// --- Crawlers -----------------------------------------------------------------

export async function listCrawlers(db: Database) {
  return db
    .select({ crawler: schema.crawlers, operator: { name: schema.crawlerOperators.name } })
    .from(schema.crawlers)
    .innerJoin(schema.crawlerOperators, eq(schema.crawlers.operatorId, schema.crawlerOperators.id))
    .orderBy(schema.crawlers.name);
}

export type CreateCrawlerParams = {
  operatorId: string;
  name: string;
  userAgentToken: string;
  purpose: CrawlerPurpose;
  description: string;
  officialSourceUrl: string;
  approvedByUserId: string;
};

/** SRS §28.11 "create crawler records" — always starts `unverified`
 * (FR-REG-005: nothing is presented as active policy signal without
 * explicit verification, done separately via `verifyCrawler`). */
export async function createCrawlerDraft(
  db: Database,
  params: CreateCrawlerParams,
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.crawlers).values({
    id,
    operatorId: params.operatorId,
    name: params.name,
    userAgentToken: params.userAgentToken,
    purpose: params.purpose,
    description: params.description,
    officialSourceUrl: params.officialSourceUrl,
    lifecycleStatus: "unverified",
    approvedByUserId: params.approvedByUserId,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

/** SRS §28.11 "update source evidence" — moves a draft to `active` only once
 * verified against its official source, stamping both verification dates. */
export async function verifyCrawler(
  db: Database,
  crawlerId: string,
  params: { officialSourceUrl: string; approvedByUserId: string },
): Promise<void> {
  const now = new Date().toISOString();
  const [existing] = await db
    .select()
    .from(schema.crawlers)
    .where(eq(schema.crawlers.id, crawlerId))
    .limit(1);
  await db
    .update(schema.crawlers)
    .set({
      officialSourceUrl: params.officialSourceUrl,
      lifecycleStatus: "active",
      firstVerifiedAt: existing?.firstVerifiedAt ?? now,
      lastVerifiedAt: now,
      approvedByUserId: params.approvedByUserId,
      updatedAt: now,
    })
    .where(eq(schema.crawlers.id, crawlerId));
}

/** SRS §28.11 "deprecate tokens, define replacement crawlers". */
export async function deprecateCrawler(
  db: Database,
  crawlerId: string,
  params: { status: LifecycleStatus; replacementCrawlerId?: string | null },
): Promise<void> {
  await db
    .update(schema.crawlers)
    .set({
      lifecycleStatus: params.status,
      replacementCrawlerId: params.replacementCrawlerId ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.crawlers.id, crawlerId));
}

// --- Registry releases ---------------------------------------------------------

export async function listRegistryVersions(db: Database) {
  return db.select().from(schema.registryVersions).orderBy(desc(schema.registryVersions.createdAt));
}

/**
 * SRS §28.11 "create registry releases": snapshots every currently
 * active/deprecated/replaced crawler into `registry_version_entries` as a
 * frozen JSON blob. Not yet published (`is_active` stays false) — a
 * separate, confirmed `publishRegistryVersion` call is required, matching
 * "publication confirmation" and "mandatory release notes."
 */
export async function createRegistryRelease(
  db: Database,
  params: { versionLabel: string; changelog: string },
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const crawlers = await db
    .select({ crawler: schema.crawlers, operatorName: schema.crawlerOperators.name })
    .from(schema.crawlers)
    .innerJoin(schema.crawlerOperators, eq(schema.crawlers.operatorId, schema.crawlerOperators.id))
    .where(
      inArray(schema.crawlers.lifecycleStatus, [
        "active",
        "deprecated",
        "replaced",
        "unverified",
        "retired",
      ]),
    );

  // A single db.batch() rather than N+1 sequential inserts — see Phase 11's
  // established pattern (apps/web/src/lib/persist-scan.ts) — and keeps the
  // release-creation + entry-snapshot writes atomic together.
  const statements: BatchItem<"sqlite">[] = [
    db.insert(schema.registryVersions).values({
      id,
      versionLabel: params.versionLabel,
      changelog: params.changelog,
      isActive: false,
      createdAt: now,
    }),
    ...crawlers.map(({ crawler, operatorName }) =>
      db.insert(schema.registryVersionEntries).values({
        id: crypto.randomUUID(),
        registryVersionId: id,
        crawlerId: crawler.id,
        snapshot: JSON.stringify(buildCanonicalSnapshot(crawler, operatorName)),
        snapshotSchemaVersion: 2,
      }),
    ),
  ];
  await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);

  return id;
}

export type CandidateValidationIssue = { code: string; message: string; crawlerId?: string };
export type CandidateValidationResult = {
  errors: CandidateValidationIssue[];
  warnings: CandidateValidationIssue[];
  checksum: string;
};

const STALE_VERIFICATION_DAYS = 180;

/**
 * Phase 15 release-candidate validation (Section 41). Run before
 * publication; blocking errors must prevent `publishRegistryVersion` from
 * proceeding. Warnings (e.g. stale review) do not block but are surfaced in
 * the impact preview.
 */
export async function validateReleaseCandidate(
  db: Database,
  registryVersionId: string,
): Promise<CandidateValidationResult> {
  const [version] = await db
    .select()
    .from(schema.registryVersions)
    .where(eq(schema.registryVersions.id, registryVersionId))
    .limit(1);
  const errors: CandidateValidationIssue[] = [];
  const warnings: CandidateValidationIssue[] = [];

  if (!version) {
    errors.push({ code: "release_not_found", message: "Registry release candidate not found." });
    return { errors, warnings, checksum: "" };
  }
  if (!version.versionLabel.trim()) {
    errors.push({ code: "missing_version_label", message: "A version label is required." });
  }
  if (!version.changelog.trim()) {
    errors.push({ code: "missing_changelog", message: "Release notes are required." });
  }

  const entries = await db
    .select()
    .from(schema.registryVersionEntries)
    .where(eq(schema.registryVersionEntries.registryVersionId, registryVersionId));

  const seenTokens = new Map<string, string>();
  const now = Date.now();
  for (const entry of entries) {
    const snapshot = JSON.parse(entry.snapshot) as {
      lifecycleStatus: LifecycleStatus;
      userAgentToken: string;
      officialSourceUrl?: string;
      lastVerifiedAt?: string | null;
      replacementCrawlerId?: string | null;
    };
    const evaluationEligible =
      snapshot.lifecycleStatus === "active" ||
      snapshot.lifecycleStatus === "deprecated" ||
      snapshot.lifecycleStatus === "replaced";

    if (evaluationEligible) {
      const existingOwner = seenTokens.get(snapshot.userAgentToken.toLowerCase());
      if (existingOwner) {
        errors.push({
          code: "duplicate_token",
          message: `Token "${snapshot.userAgentToken}" is used by more than one evaluation-eligible crawler.`,
          crawlerId: entry.crawlerId,
        });
      }
      seenTokens.set(snapshot.userAgentToken.toLowerCase(), entry.crawlerId);

      if (!snapshot.officialSourceUrl) {
        errors.push({
          code: "missing_official_source",
          message: "An evaluation-eligible crawler is missing an official source URL.",
          crawlerId: entry.crawlerId,
        });
      }
      if (!snapshot.lastVerifiedAt) {
        errors.push({
          code: "missing_verification_date",
          message: "An evaluation-eligible crawler has never been verified.",
          crawlerId: entry.crawlerId,
        });
      } else {
        const ageDays = (now - Date.parse(snapshot.lastVerifiedAt)) / 86_400_000;
        if (ageDays > STALE_VERIFICATION_DAYS) {
          warnings.push({
            code: "stale_verification",
            message: `Verification is ${Math.round(ageDays)} days old (review threshold: ${STALE_VERIFICATION_DAYS}).`,
            crawlerId: entry.crawlerId,
          });
        }
      }
    }
  }

  const checksum = await computeRegistryChecksum(db, registryVersionId);
  return { errors, warnings, checksum };
}

/**
 * SRS §28.11 "publish releases": the only place `is_active` is ever
 * flipped for a normal forward publication. Never edits
 * `registry_version_entries` — publishing changes which immutable release
 * is "current," it never mutates the release itself.
 *
 * Phase 15 hardening:
 * - Blocking candidate validation runs first (Section 41) — an invalid
 *   candidate (unverified-but-evaluation-eligible, missing source/
 *   verification, duplicate token) is never published.
 * - The checksum is computed and stored at publish time, not left as a
 *   CLI-only on-demand computation.
 * - Both `UPDATE`s run in a single `db.batch()` so there is never a window
 *   where zero releases are active (Section 51, "Activation Atomicity").
 * - Idempotent: publishing an already-active release is a harmless no-op
 *   (Section 53) — no duplicate activation-history row.
 */
export async function publishRegistryVersion(
  db: Database,
  registryVersionId: string,
  publishedByUserId: string,
): Promise<{ alreadyActive: boolean; checksum: string }> {
  const validation = await validateReleaseCandidate(db, registryVersionId);
  if (validation.errors.length > 0) {
    throw new Error(
      `Registry release candidate failed validation: ${validation.errors.map((e) => e.message).join("; ")}`,
    );
  }

  const [current] = await db
    .select({ id: schema.registryVersions.id })
    .from(schema.registryVersions)
    .where(eq(schema.registryVersions.isActive, true))
    .limit(1);
  if (current?.id === registryVersionId) {
    return { alreadyActive: true, checksum: validation.checksum };
  }

  const now = new Date().toISOString();
  const statements: BatchItem<"sqlite">[] = [
    db
      .update(schema.registryVersions)
      .set({ isActive: false })
      .where(eq(schema.registryVersions.isActive, true)),
    db
      .update(schema.registryVersions)
      .set({
        isActive: true,
        publishedByUserId,
        publishedAt: now,
        checksum: validation.checksum,
      })
      .where(eq(schema.registryVersions.id, registryVersionId)),
    db.insert(schema.registryVersionActivations).values({
      id: crypto.randomUUID(),
      registryVersionId,
      action: "published",
      previousActiveVersionId: current?.id ?? null,
      performedByUserId: publishedByUserId,
      reason: null,
      createdAt: now,
    }),
  ];
  await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
  return { alreadyActive: false, checksum: validation.checksum };
}

/**
 * SRS §28.11 "roll back the active release pointer" — repoints `is_active`
 * to an older, already-published release. The rolled-back-from release is
 * never deleted or edited (Section 67).
 *
 * Phase 15 hardening: atomic (single `db.batch()`), idempotent (rolling
 * back to the already-active release is a no-op), records activation
 * history, and refuses to activate a release that was never published
 * (Section 145: "an unpublished draft must not become active through
 * rollback").
 */
export async function rollbackRegistryVersion(
  db: Database,
  targetVersionId: string,
  performedByUserId: string,
  reason: string,
): Promise<{ alreadyActive: boolean }> {
  const [target] = await db
    .select({ id: schema.registryVersions.id, publishedAt: schema.registryVersions.publishedAt })
    .from(schema.registryVersions)
    .where(eq(schema.registryVersions.id, targetVersionId))
    .limit(1);
  if (!target) throw new Error("Rollback target registry release does not exist.");
  if (!target.publishedAt) {
    throw new Error("Rollback target has never been published — cannot roll back to a draft.");
  }

  const [current] = await db
    .select({ id: schema.registryVersions.id })
    .from(schema.registryVersions)
    .where(eq(schema.registryVersions.isActive, true))
    .limit(1);
  if (current?.id === targetVersionId) {
    return { alreadyActive: true };
  }

  const now = new Date().toISOString();
  const statements: BatchItem<"sqlite">[] = [
    db
      .update(schema.registryVersions)
      .set({ isActive: false })
      .where(eq(schema.registryVersions.isActive, true)),
    db
      .update(schema.registryVersions)
      .set({ isActive: true })
      .where(eq(schema.registryVersions.id, targetVersionId)),
    db.insert(schema.registryVersionActivations).values({
      id: crypto.randomUUID(),
      registryVersionId: targetVersionId,
      action: "rolled_back_to",
      previousActiveVersionId: current?.id ?? null,
      performedByUserId,
      reason,
      createdAt: now,
    }),
  ];
  await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
  return { alreadyActive: false };
}

/** Re-exported for callers that need the semantic diff without importing
 * from `../registry-semantic-diff` directly (keeps the admin-registry
 * surface as the one module Admin routes depend on). */
export { computeSemanticDiff, type RegistrySemanticDiff };

/**
 * SRS §28.11 "affected-domain preview": which saved domains have a scan
 * evaluation for a crawler that changed between the active release and a
 * candidate one. Real and computable without re-running the evaluator —
 * joins the diff's changed-crawler-ID set against `scan_crawler_results`
 * for each domain's current (`last_scan_id`) evaluation.
 */
export async function getAffectedDomains(db: Database, changedCrawlerIds: string[]) {
  if (changedCrawlerIds.length === 0) return [];
  const rows = await db
    .select({
      domainId: schema.domains.id,
      canonicalOrigin: schema.domains.canonicalOrigin,
      ownerUserId: schema.domains.ownerUserId,
    })
    .from(schema.domains)
    .innerJoin(
      schema.scanCrawlerResults,
      eq(schema.scanCrawlerResults.scanId, schema.domains.lastScanId),
    )
    .where(
      and(
        isNull(schema.domains.deletedAt),
        inArray(schema.scanCrawlerResults.crawlerId, changedCrawlerIds),
      ),
    );

  const unique = new Map(rows.map((r) => [r.domainId, r]));
  return [...unique.values()];
}

/**
 * SRS §28.11 "trigger domain re-evaluation": historical scans are immutable
 * (ADR/FR-REG-007) — the only honest way to "re-evaluate" a domain against
 * a newly-published registry is a fresh scan, not mutating a past one. This
 * schedules affected domains for their next monitoring sweep immediately
 * rather than waiting for their normal cadence.
 */
export async function scheduleReEvaluation(db: Database, domainIds: string[]): Promise<number> {
  if (domainIds.length === 0) return 0;
  const now = new Date().toISOString();
  await db
    .update(schema.domains)
    .set({ nextScanAt: now, updatedAt: now })
    .where(inArray(schema.domains.id, domainIds));
  return domainIds.length;
}

// --- Ruleset versions -----------------------------------------------------------

export async function listRulesetVersions(db: Database) {
  return db.select().from(schema.rulesetVersions).orderBy(desc(schema.rulesetVersions.createdAt));
}

export async function createRulesetVersion(
  db: Database,
  params: { versionLabel: string; description: string },
): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(schema.rulesetVersions).values({
    id,
    versionLabel: params.versionLabel,
    description: params.description,
    isActive: false,
    createdAt: new Date().toISOString(),
  });
  return id;
}

/** Phase 15: same atomicity fix as `publishRegistryVersion` — a single
 * `db.batch()` rather than two sequential `UPDATE`s, so there is never a
 * window with zero active rulesets. Ruleset *semantics* are unchanged;
 * this only hardens the activation-pointer mechanism itself. */
export async function publishRulesetVersion(
  db: Database,
  rulesetVersionId: string,
  publishedByUserId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const statements: BatchItem<"sqlite">[] = [
    db
      .update(schema.rulesetVersions)
      .set({ isActive: false })
      .where(eq(schema.rulesetVersions.isActive, true)),
    db
      .update(schema.rulesetVersions)
      .set({ isActive: true, publishedByUserId, publishedAt: now })
      .where(eq(schema.rulesetVersions.id, rulesetVersionId)),
  ];
  await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
}

export async function rollbackRulesetVersion(db: Database, targetVersionId: string): Promise<void> {
  const statements: BatchItem<"sqlite">[] = [
    db
      .update(schema.rulesetVersions)
      .set({ isActive: false })
      .where(eq(schema.rulesetVersions.isActive, true)),
    db
      .update(schema.rulesetVersions)
      .set({ isActive: true })
      .where(eq(schema.rulesetVersions.id, targetVersionId)),
  ];
  await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
}
