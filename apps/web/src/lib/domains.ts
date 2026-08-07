import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import type { BatchImportResult, SavedDomain } from "@crawlpact/core";
import { normalizeTarget } from "@crawlpact/core";
import { POLICY_PRESETS } from "@crawlpact/policy";
import type { PolicyPreset } from "@crawlpact/policy";
import { generatePresetChangeEvent, getLatestChangeEventPerDomain } from "./domain-timeline";

type DomainRow = typeof schema.domains.$inferSelect;

function isPolicyPreset(value: string): value is PolicyPreset {
  return (POLICY_PRESETS as readonly string[]).includes(value);
}

function toSavedDomain(
  row: DomainRow,
  openFindingsCount: number,
  recentChange?: { changeOrigin: string; summary: string } | null,
): SavedDomain {
  return {
    domainId: row.id,
    displayName: row.displayName,
    canonicalOrigin: row.canonicalOrigin,
    groupId: row.groupId,
    preset: row.preset,
    monitoringState: row.monitoringState,
    lastScanAt: row.lastScanAt,
    nextScanAt: row.nextScanAt,
    currentScore: row.currentScore,
    openFindingsCount,
    recentChangeOrigin: recentChange?.changeOrigin ?? null,
    recentChangeSummary: recentChange?.summary ?? null,
  };
}

async function openFindingsCountFor(db: Database, lastScanId: string | null): Promise<number> {
  if (!lastScanId) return 0;
  const [row] = await db
    .select({ value: count() })
    .from(schema.findings)
    .where(eq(schema.findings.scanId, lastScanId));
  return row?.value ?? 0;
}

export async function listDomains(db: Database, userId: string): Promise<SavedDomain[]> {
  const rows = await db
    .select()
    .from(schema.domains)
    .where(and(eq(schema.domains.ownerUserId, userId), isNull(schema.domains.deletedAt)));

  // Bounded by the account's own saved-domain limit (≤100, the Agency
  // ceiling) — one batched recent-change query for the whole page, not one
  // per row (see getLatestChangeEventPerDomain's own no-N+1 rationale).
  const recentChanges = await getLatestChangeEventPerDomain(
    db,
    rows.map((r) => r.id),
  );

  return Promise.all(
    rows.map(async (row) =>
      toSavedDomain(row, await openFindingsCountFor(db, row.lastScanId), recentChanges.get(row.id)),
    ),
  );
}

export async function getOwnedDomain(
  db: Database,
  userId: string,
  domainId: string,
): Promise<DomainRow | null> {
  const [row] = await db
    .select()
    .from(schema.domains)
    .where(
      and(
        eq(schema.domains.id, domainId),
        eq(schema.domains.ownerUserId, userId),
        isNull(schema.domains.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getOwnedDomainAsSavedDomain(
  db: Database,
  userId: string,
  domainId: string,
): Promise<SavedDomain | null> {
  const row = await getOwnedDomain(db, userId, domainId);
  if (!row) return null;
  return toSavedDomain(row, await openFindingsCountFor(db, row.lastScanId));
}

export async function countActiveDomains(db: Database, userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(schema.domains)
    .where(and(eq(schema.domains.ownerUserId, userId), isNull(schema.domains.deletedAt)));
  return row?.value ?? 0;
}

/** Exposed (not just used internally by createDomain) so callers like the Phase 5 anonymous
 * report page can decide whether the signed-in viewer already owns the audited domain, to show
 * "Manage this domain" instead of a save/convert CTA. */
export async function findOwnedDomainByOrigin(
  db: Database,
  userId: string,
  canonicalOrigin: string,
): Promise<DomainRow | null> {
  return findExistingByOrigin(db, userId, canonicalOrigin);
}

async function findExistingByOrigin(
  db: Database,
  userId: string,
  canonicalOrigin: string,
): Promise<DomainRow | null> {
  const [row] = await db
    .select()
    .from(schema.domains)
    .where(
      and(
        eq(schema.domains.ownerUserId, userId),
        eq(schema.domains.canonicalOrigin, canonicalOrigin),
        isNull(schema.domains.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export type CreateDomainInput = {
  canonicalOrigin: string;
  originalInput: string;
  displayName: string;
  groupId: string | null;
  preset: string | undefined;
  savedDomainLimit: number;
  monitoringFrequency: DomainRow["monitoringFrequency"];
};

export type CreateDomainResult =
  | { ok: true; domain: DomainRow }
  | { ok: false; reason: "duplicate" | "limit_reached" | "invalid_preset" };

export async function createDomain(
  db: Database,
  userId: string,
  input: CreateDomainInput,
): Promise<CreateDomainResult> {
  if (input.preset !== undefined && !isPolicyPreset(input.preset)) {
    return { ok: false, reason: "invalid_preset" };
  }

  const existing = await findExistingByOrigin(db, userId, input.canonicalOrigin);
  if (existing) return { ok: false, reason: "duplicate" };

  const activeCount = await countActiveDomains(db, userId);
  if (activeCount >= input.savedDomainLimit) return { ok: false, reason: "limit_reached" };

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const preset = (input.preset ?? "maximum_ai_visibility") as PolicyPreset;

  await db.insert(schema.domains).values({
    id,
    ownerUserId: userId,
    groupId: input.groupId,
    displayName: input.displayName,
    canonicalOrigin: input.canonicalOrigin,
    originalInput: input.originalInput,
    preset,
    monitoringState: "active",
    monitoringFrequency: input.monitoringFrequency,
    consecutiveFailureCount: 0,
    createdAt: now,
    updatedAt: now,
  });

  const [row] = await db.select().from(schema.domains).where(eq(schema.domains.id, id)).limit(1);
  return { ok: true, domain: row! };
}

export type UpdateDomainInput = {
  displayName?: string;
  groupId?: string | null;
  preset?: string;
  monitoringState?: "active" | "paused";
  notes?: string | null;
};

export async function updateDomain(
  db: Database,
  userId: string,
  domainId: string,
  input: UpdateDomainInput,
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "invalid_preset" }> {
  if (input.preset !== undefined && !isPolicyPreset(input.preset)) {
    return { ok: false, reason: "invalid_preset" };
  }

  const existing = await getOwnedDomain(db, userId, domainId);
  if (!existing) return { ok: false, reason: "not_found" };

  const patch: Partial<typeof schema.domains.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };
  if (input.displayName !== undefined) patch.displayName = input.displayName;
  if (input.groupId !== undefined) patch.groupId = input.groupId;
  if (input.preset !== undefined) patch.preset = input.preset as PolicyPreset;
  if (input.monitoringState !== undefined) patch.monitoringState = input.monitoringState;
  if (input.notes !== undefined) patch.notes = input.notes;

  const result = await db
    .update(schema.domains)
    .set(patch)
    .where(
      and(
        eq(schema.domains.id, domainId),
        eq(schema.domains.ownerUserId, userId),
        isNull(schema.domains.deletedAt),
      ),
    )
    .returning({ id: schema.domains.id });

  if (result.length === 0) return { ok: false, reason: "not_found" };

  // Phase 8 (PHASE_08_POLICY_OBJECTIVE_DECISION.md): a real preset change is
  // recorded as an operational timeline event (SRS FR-POL-004, "preset
  // changes shall be recorded in account history"). Never blocks the
  // mutation itself on a timeline-write failure.
  if (input.preset !== undefined && input.preset !== existing.preset) {
    try {
      await generatePresetChangeEvent(db, {
        domainId,
        fromPreset: existing.preset,
        toPreset: input.preset,
        observedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Preset-change timeline event generation failed", { domainId, error });
    }
  }

  return { ok: true };
}

export async function softDeleteDomain(
  db: Database,
  userId: string,
  domainId: string,
): Promise<boolean> {
  const result = await db
    .update(schema.domains)
    .set({ deletedAt: new Date().toISOString() })
    .where(
      and(
        eq(schema.domains.id, domainId),
        eq(schema.domains.ownerUserId, userId),
        isNull(schema.domains.deletedAt),
      ),
    )
    .returning({ id: schema.domains.id });
  return result.length > 0;
}

/** SRS §25: manual re-scans are capped per domain per calendar month by plan. */
export async function countManualScansThisMonth(db: Database, domainId: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const [row] = await db
    .select({ value: count() })
    .from(schema.scans)
    .where(
      and(
        eq(schema.scans.domainId, domainId),
        eq(schema.scans.triggeredBy, "manual"),
        gte(schema.scans.startedAt, startOfMonth.toISOString()),
      ),
    );
  return row?.value ?? 0;
}

export type DomainScanSummary = {
  scanId: string;
  status: string;
  score: number | null;
  triggeredBy: string;
  startedAt: string;
};

/** SRS §25/§10.29: per-domain scan history for the domain detail page. */
export async function listScansForDomain(
  db: Database,
  domainId: string,
  limit = 20,
): Promise<DomainScanSummary[]> {
  const rows = await db
    .select({
      scanId: schema.scans.id,
      status: schema.scans.status,
      score: schema.scans.score,
      triggeredBy: schema.scans.triggeredBy,
      startedAt: schema.scans.startedAt,
    })
    .from(schema.scans)
    .where(eq(schema.scans.domainId, domainId))
    .orderBy(desc(schema.scans.startedAt))
    .limit(limit);
  return rows;
}

export async function recordScanOnDomain(
  db: Database,
  domainId: string,
  fields: { scanId: string; score: number | null; nextScanAt: string | null },
): Promise<void> {
  await db
    .update(schema.domains)
    .set({
      lastScanId: fields.scanId,
      lastScanAt: new Date().toISOString(),
      currentScore: fields.score,
      nextScanAt: fields.nextScanAt,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.domains.id, domainId));
}

/**
 * SRS §25: the scheduled-monitoring counterpart to `recordScanOnDomain`.
 * Unlike a manual re-scan (immediately visible, user-initiated), an
 * unattended background failure should not silently wipe out a
 * previously-good score — `currentScore` is only touched on success. A
 * transient failure backs off; reaching `FAILURE_PAUSE_THRESHOLD`
 * consecutive failures pauses monitoring outright rather than retrying
 * forever against a target that's gone.
 */
/**
 * Phase 10: three outcome shapes, not two. `platformFailure: true` is a new
 * third case — CrawlPact's own processing failed before the target was
 * meaningfully attempted (an uncaught exception, a D1 error), as opposed to
 * a completed audit run that legitimately couldn't reach/parse the target.
 * A platform failure deliberately does NOT touch `consecutiveFailureCount`,
 * `failureEpisodeId`, `nextScanAt`, or `monitoringState` — it must never
 * count toward the target-failure pause threshold or advance/delay the
 * user's actual monitoring schedule (SRS/Phase 10 §23). The domain simply
 * becomes due again once its still-in-place claim lock
 * (`apps/web/src/lib/monitoring.ts`'s `claimDueDomains`) expires, which
 * self-heals within one claim-lock window without any explicit reschedule —
 * see docs/operations/MONITORING_STATE_RECONCILIATION.md.
 */
export async function recordScheduledScanOutcome(
  db: Database,
  domainId: string,
  fields:
    | { succeeded: true; scanId: string; score: number | null; nextScanAt: string | null }
    | {
        succeeded: false;
        scanId: string;
        nextScanAt: string | null;
        pause: boolean;
        failureEpisodeId: string;
      }
    | { succeeded: false; scanId: string; platformFailure: true },
): Promise<void> {
  const now = new Date().toISOString();
  if (fields.succeeded) {
    await db
      .update(schema.domains)
      .set({
        lastScanId: fields.scanId,
        lastScanAt: now,
        currentScore: fields.score,
        nextScanAt: fields.nextScanAt,
        consecutiveFailureCount: 0,
        // A success ends any in-progress target-failure episode.
        failureEpisodeId: null,
        updatedAt: now,
      })
      .where(eq(schema.domains.id, domainId));
    return;
  }

  if ("platformFailure" in fields) {
    await db
      .update(schema.domains)
      .set({ lastScanId: fields.scanId, lastScanAt: now, updatedAt: now })
      .where(eq(schema.domains.id, domainId));
    return;
  }

  await db
    .update(schema.domains)
    .set({
      lastScanId: fields.scanId,
      lastScanAt: now,
      nextScanAt: fields.nextScanAt,
      consecutiveFailureCount: sql<number>`${schema.domains.consecutiveFailureCount} + 1`,
      failureEpisodeId: fields.failureEpisodeId,
      updatedAt: now,
      ...(fields.pause ? { monitoringState: "paused" as const } : {}),
    })
    .where(eq(schema.domains.id, domainId));
}

/**
 * SRS §29 agency batch import: "review import errors" means every row's
 * outcome (including failures) is reported back, not just a single
 * aggregate success/failure — one bad row never blocks the rest of the
 * batch. Reuses `createDomain`'s own duplicate/limit checks per row, so an
 * in-batch duplicate (the same domain listed twice) is correctly caught by
 * the second occurrence once the first has been inserted.
 */
export async function batchImportDomains(
  db: Database,
  userId: string,
  params: {
    targets: string[];
    groupId: string | null;
    savedDomainLimit: number;
    batchImportLimit: number;
    monitoringFrequency: DomainRow["monitoringFrequency"];
  },
): Promise<BatchImportResult> {
  const results: BatchImportResult["results"] = [];

  if (params.batchImportLimit <= 0) {
    for (const target of params.targets) {
      results.push({ target, ok: false, error: "Your plan does not include batch import." });
    }
    return { results, savedCount: 0, errorCount: results.length };
  }
  if (params.targets.length > params.batchImportLimit) {
    for (const target of params.targets) {
      results.push({
        target,
        ok: false,
        error: `Your plan allows importing at most ${params.batchImportLimit} domains at once (this batch has ${params.targets.length}).`,
      });
    }
    return { results, savedCount: 0, errorCount: results.length };
  }

  let savedCount = 0;
  for (const target of params.targets) {
    const normalized = normalizeTarget(target);
    if (!normalized.ok) {
      results.push({ target, ok: false, error: "Not a valid domain or URL." });
      continue;
    }

    const result = await createDomain(db, userId, {
      canonicalOrigin: normalized.normalizedOrigin,
      originalInput: target,
      displayName: normalized.hostname,
      groupId: params.groupId,
      preset: undefined,
      savedDomainLimit: params.savedDomainLimit,
      monitoringFrequency: params.monitoringFrequency,
    });

    if (!result.ok) {
      const message =
        result.reason === "duplicate"
          ? "Already saved to your account."
          : result.reason === "limit_reached"
            ? `Your plan's saved-domain limit (${params.savedDomainLimit}) has been reached.`
            : "Invalid policy preset.";
      results.push({ target, ok: false, error: message });
      continue;
    }

    results.push({ target, ok: true, domainId: result.domain.id });
    savedCount++;
  }

  return { results, savedCount, errorCount: results.length - savedCount };
}
