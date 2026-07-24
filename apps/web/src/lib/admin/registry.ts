import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import type { CrawlerPurpose, LifecycleStatus } from "@crawlpact/registry";

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
  await db.insert(schema.registryVersions).values({
    id,
    versionLabel: params.versionLabel,
    changelog: params.changelog,
    isActive: false,
    createdAt: now,
  });

  const crawlers = await db
    .select()
    .from(schema.crawlers)
    .where(
      inArray(schema.crawlers.lifecycleStatus, [
        "active",
        "deprecated",
        "replaced",
        "unverified",
        "retired",
      ]),
    );

  for (const crawler of crawlers) {
    await db.insert(schema.registryVersionEntries).values({
      id: crypto.randomUUID(),
      registryVersionId: id,
      crawlerId: crawler.id,
      snapshot: JSON.stringify(crawler),
    });
  }

  return id;
}

/** SRS §28.11 "publish releases": the only place `is_active` is ever
 * flipped. Never edits `registry_version_entries` — publishing a release
 * that's already immutable data, just changing which one is "current." */
export async function publishRegistryVersion(
  db: Database,
  registryVersionId: string,
  publishedByUserId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .update(schema.registryVersions)
    .set({ isActive: false })
    .where(eq(schema.registryVersions.isActive, true));
  await db
    .update(schema.registryVersions)
    .set({ isActive: true, publishedByUserId, publishedAt: now })
    .where(eq(schema.registryVersions.id, registryVersionId));
}

/** SRS §28.11 "roll back the active release pointer" — repoints `is_active`
 * to an older release. The rolled-back-from release is not deleted. */
export async function rollbackRegistryVersion(
  db: Database,
  targetVersionId: string,
): Promise<void> {
  await db
    .update(schema.registryVersions)
    .set({ isActive: false })
    .where(eq(schema.registryVersions.isActive, true));
  await db
    .update(schema.registryVersions)
    .set({ isActive: true })
    .where(eq(schema.registryVersions.id, targetVersionId));
}

export type RegistryComparison = {
  added: string[];
  removed: string[];
  changed: { crawlerId: string; before: unknown; after: unknown }[];
};

/** SRS §28.11 "compare releases" — same diff logic as scripts/registry-tools.mjs's
 * CLI `changelog` command, ported so the admin UI doesn't need a shell-out. */
export async function compareRegistryVersions(
  db: Database,
  fromId: string,
  toId: string,
): Promise<RegistryComparison> {
  const [fromRows, toRows] = await Promise.all([
    db
      .select({
        crawlerId: schema.registryVersionEntries.crawlerId,
        snapshot: schema.registryVersionEntries.snapshot,
      })
      .from(schema.registryVersionEntries)
      .where(eq(schema.registryVersionEntries.registryVersionId, fromId)),
    db
      .select({
        crawlerId: schema.registryVersionEntries.crawlerId,
        snapshot: schema.registryVersionEntries.snapshot,
      })
      .from(schema.registryVersionEntries)
      .where(eq(schema.registryVersionEntries.registryVersionId, toId)),
  ]);

  const fromMap = new Map(fromRows.map((r) => [r.crawlerId, r.snapshot]));
  const toMap = new Map(toRows.map((r) => [r.crawlerId, r.snapshot]));

  const added = [...toMap.keys()].filter((id) => !fromMap.has(id));
  const removed = [...fromMap.keys()].filter((id) => !toMap.has(id));
  const changed = [...toMap.keys()]
    .filter((id) => fromMap.has(id) && fromMap.get(id) !== toMap.get(id))
    .map((id) => ({
      crawlerId: id,
      before: JSON.parse(fromMap.get(id)!),
      after: JSON.parse(toMap.get(id)!),
    }));

  return { added, removed, changed };
}

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

export async function publishRulesetVersion(
  db: Database,
  rulesetVersionId: string,
  publishedByUserId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .update(schema.rulesetVersions)
    .set({ isActive: false })
    .where(eq(schema.rulesetVersions.isActive, true));
  await db
    .update(schema.rulesetVersions)
    .set({ isActive: true, publishedByUserId, publishedAt: now })
    .where(eq(schema.rulesetVersions.id, rulesetVersionId));
}

export async function rollbackRulesetVersion(db: Database, targetVersionId: string): Promise<void> {
  await db
    .update(schema.rulesetVersions)
    .set({ isActive: false })
    .where(eq(schema.rulesetVersions.isActive, true));
  await db
    .update(schema.rulesetVersions)
    .set({ isActive: true })
    .where(eq(schema.rulesetVersions.id, targetVersionId));
}
