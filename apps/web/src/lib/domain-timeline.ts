import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import {
  ATTRIBUTION_MODEL_VERSION,
  computeChangeOrigin,
  type ChangeOrigin,
} from "./change-attribution";
import { classifyFindingLifecycle, type FindingCounts } from "./finding-lifecycle";
import { sha256Hex } from "./persist-scan";

/**
 * Materialised domain-change-event generation and querying (Phase 8). See
 * docs/product/DOMAIN_CHANGE_TIMELINE_ARCHITECTURE.md and
 * DOMAIN_TIMELINE_EVENT_MODEL.md for the full design.
 */

export type EventType =
  | "baseline"
  | "website_policy_change"
  | "registry_driven_change"
  | "mixed_change"
  | "operational_change";

export type AttentionLevel = "informational" | "review_recommended" | "high_attention";

const ORIGIN_TO_EVENT_TYPE: Record<ChangeOrigin, EventType> = {
  baseline: "baseline",
  website_policy: "website_policy_change",
  registry_driven: "registry_driven_change",
  mixed: "mixed_change",
  operational: "operational_change",
  uncertain: "operational_change",
};

type CrawlerResultChange = { crawlerId: string; purpose: string; from: string; to: string };

async function getCrawlerResultChanges(
  db: Database,
  previousScanId: string,
  currentScanId: string,
): Promise<CrawlerResultChange[]> {
  const [previousRows, currentRows] = await Promise.all([
    db
      .select({
        crawlerId: schema.scanCrawlerResults.crawlerId,
        result: schema.scanCrawlerResults.result,
      })
      .from(schema.scanCrawlerResults)
      .where(eq(schema.scanCrawlerResults.scanId, previousScanId)),
    db
      .select({
        crawlerId: schema.scanCrawlerResults.crawlerId,
        result: schema.scanCrawlerResults.result,
        purpose: schema.crawlers.purpose,
      })
      .from(schema.scanCrawlerResults)
      .innerJoin(schema.crawlers, eq(schema.scanCrawlerResults.crawlerId, schema.crawlers.id))
      .where(eq(schema.scanCrawlerResults.scanId, currentScanId)),
  ]);

  const previousByCrawler = new Map(previousRows.map((r) => [r.crawlerId, r.result]));
  const changes: CrawlerResultChange[] = [];
  for (const current of currentRows) {
    const previous = previousByCrawler.get(current.crawlerId);
    if (previous !== undefined && previous !== current.result) {
      changes.push({
        crawlerId: current.crawlerId,
        purpose: current.purpose,
        from: previous,
        to: current.result,
      });
    }
  }
  return changes;
}

function computeAttentionLevel(
  origin: ChangeOrigin,
  findingCounts: FindingCounts,
  affectedPurposes: string[],
  hasHighSeverityAppeared: boolean,
): AttentionLevel {
  if (origin === "baseline" || origin === "operational" || origin === "uncertain") {
    return "informational";
  }
  if (hasHighSeverityAppeared || affectedPurposes.length >= 3) {
    return "high_attention";
  }
  if (findingCounts.appeared + findingCounts.changed > 0 || affectedPurposes.length > 0) {
    return "review_recommended";
  }
  return "informational";
}

function buildSummary(origin: ChangeOrigin, reason?: string): string {
  switch (origin) {
    case "baseline":
      return "This is the first saved baseline. Future scans will appear in the change timeline when a meaningful difference is detected.";
    case "website_policy":
      return "The website's published crawler-policy signals changed since the previous comparable scan.";
    case "registry_driven":
      return "The website's published signals remained unchanged, but CrawlPact's verified crawler registry changed.";
    case "mixed":
      return "Both the website's published policy and the verified crawler registry changed.";
    case "operational":
      return reason === "current_scan_incomplete"
        ? "The most recent scan did not fully complete, so this comparison is limited."
        : "The previous scan did not fully complete, so this comparison is limited.";
    case "uncertain":
      return "A change was detected, but CrawlPact could not isolate a single cause because comparable evidence from the previous scan is no longer available.";
  }
}

async function computeFingerprint(parts: string[]): Promise<string> {
  return sha256Hex(parts.join("|"));
}

export type GenerateTimelineEventParams = {
  domainId: string;
  previousScanId: string | null;
  currentScanId: string;
};

/**
 * Generates (and idempotently inserts) a timeline event for one scan
 * comparison. Returns `null` when no event was generated (a genuine
 * no-material-change scan — visible under Scan history, not the timeline,
 * per the backfill/timeline architecture's "Approach A" decision). Never
 * throws for a "nothing to report" outcome; callers wrap this in try/catch
 * regardless so a real error here can never block scan completion.
 */
export async function generateTimelineEvent(
  db: Database,
  params: GenerateTimelineEventParams,
): Promise<{ id: string } | null> {
  const [currentScan] = await db
    .select()
    .from(schema.scans)
    .where(eq(schema.scans.id, params.currentScanId))
    .limit(1);
  if (!currentScan) return null;

  const currentScanSucceeded =
    currentScan.status === "completed" || currentScan.status === "completed_with_warnings";
  const completeness: "complete" | "partial" = currentScanSucceeded ? "complete" : "partial";

  if (!params.previousScanId) {
    // A failed first scan has no previous scan to compare against and did
    // not itself succeed — nothing timeline-worthy exists yet; the failed
    // attempt remains visible in Scan history. Only a genuinely successful
    // first scan earns a real "baseline" event.
    if (!currentScanSucceeded) return null;
    return insertEvent(db, {
      domainId: params.domainId,
      eventType: "baseline",
      changeOrigin: "baseline",
      attentionLevel: "informational",
      observedAt: currentScan.startedAt,
      previousScanId: null,
      currentScanId: params.currentScanId,
      previousRegistryVersionId: null,
      currentRegistryVersionId: currentScan.registryVersionId,
      affectedPurposes: [],
      findingCounts: { appeared: 0, persisting: 0, changed: 0, resolved: 0 },
      summary: buildSummary("baseline"),
      details: {},
      completeness,
      fingerprintParts: [
        params.domainId,
        "baseline",
        params.currentScanId,
        ATTRIBUTION_MODEL_VERSION,
      ],
    });
  }

  const attribution = await computeChangeOrigin(db, params.previousScanId, params.currentScanId);
  if (attribution.origin === "no_change") return null;

  const [previousScan] = await db
    .select()
    .from(schema.scans)
    .where(eq(schema.scans.id, params.previousScanId))
    .limit(1);

  const currentScanComparable = completeness === "complete";
  const { entries, counts } = await classifyFindingLifecycle(db, {
    previousScanId: params.previousScanId,
    currentScanId: params.currentScanId,
    currentScanComparable,
  });

  let crawlerChanges: CrawlerResultChange[] = [];
  if (attribution.origin !== "operational" && attribution.origin !== "uncertain") {
    crawlerChanges = await getCrawlerResultChanges(db, params.previousScanId, params.currentScanId);
  }
  const affectedPurposes = [...new Set(crawlerChanges.map((c) => c.purpose))];
  const hasHighSeverityAppeared = entries.some(
    (e) => e.state === "appeared" && (e.severity === "critical" || e.severity === "high"),
  );

  const eventType = ORIGIN_TO_EVENT_TYPE[attribution.origin];
  const reason = "reason" in attribution ? attribution.reason : undefined;

  return insertEvent(db, {
    domainId: params.domainId,
    eventType,
    changeOrigin: attribution.origin,
    attentionLevel: computeAttentionLevel(
      attribution.origin,
      counts,
      affectedPurposes,
      hasHighSeverityAppeared,
    ),
    observedAt: currentScan.startedAt,
    previousScanId: params.previousScanId,
    currentScanId: params.currentScanId,
    previousRegistryVersionId: previousScan?.registryVersionId ?? null,
    currentRegistryVersionId: currentScan.registryVersionId,
    affectedPurposes,
    findingCounts: counts,
    summary: buildSummary(attribution.origin, reason),
    details: {
      crawlerResultChanges: crawlerChanges,
      findingLifecycle: entries,
      reason,
    },
    completeness,
    fingerprintParts: [
      params.domainId,
      eventType,
      params.previousScanId,
      params.currentScanId,
      ATTRIBUTION_MODEL_VERSION,
    ],
  });
}

/** Independent of scan comparison — see PHASE_08_POLICY_OBJECTIVE_DECISION.md. */
export async function generatePresetChangeEvent(
  db: Database,
  params: { domainId: string; fromPreset: string; toPreset: string; observedAt: string },
): Promise<{ id: string } | null> {
  if (params.fromPreset === params.toPreset) return null;
  const minuteBucket = params.observedAt.slice(0, 16); // ISO up to minute precision
  return insertEvent(db, {
    domainId: params.domainId,
    eventType: "operational_change",
    changeOrigin: "operational",
    attentionLevel: "informational",
    observedAt: params.observedAt,
    previousScanId: null,
    currentScanId: null,
    previousRegistryVersionId: null,
    currentRegistryVersionId: null,
    affectedPurposes: [],
    findingCounts: { appeared: 0, persisting: 0, changed: 0, resolved: 0 },
    summary: `The policy preset changed from "${params.fromPreset}" to "${params.toPreset}". This is a configuration change, not a website or registry update.`,
    details: { fromPreset: params.fromPreset, toPreset: params.toPreset },
    completeness: "complete",
    fingerprintParts: [
      params.domainId,
      "preset_changed",
      params.fromPreset,
      params.toPreset,
      minuteBucket,
    ],
  });
}

type InsertEventParams = {
  domainId: string;
  eventType: EventType;
  changeOrigin: ChangeOrigin;
  attentionLevel: AttentionLevel;
  observedAt: string;
  previousScanId: string | null;
  currentScanId: string | null;
  previousRegistryVersionId: string | null;
  currentRegistryVersionId: string | null;
  affectedPurposes: string[];
  findingCounts: FindingCounts;
  summary: string;
  details: unknown;
  completeness: "complete" | "partial";
  fingerprintParts: string[];
};

async function insertEvent(db: Database, params: InsertEventParams): Promise<{ id: string }> {
  const fingerprint = await computeFingerprint(params.fingerprintParts);
  const id = crypto.randomUUID();
  await db
    .insert(schema.domainChangeEvents)
    .values({
      id,
      domainId: params.domainId,
      eventType: params.eventType,
      changeOrigin: params.changeOrigin,
      attentionLevel: params.attentionLevel,
      observedAt: params.observedAt,
      previousScanId: params.previousScanId,
      currentScanId: params.currentScanId,
      previousRegistryVersionId: params.previousRegistryVersionId,
      currentRegistryVersionId: params.currentRegistryVersionId,
      affectedPurposesJson: JSON.stringify(params.affectedPurposes),
      findingCountsJson: JSON.stringify(params.findingCounts),
      summary: params.summary,
      detailsJson: JSON.stringify(params.details),
      completeness: params.completeness,
      fingerprint,
      modelVersion: ATTRIBUTION_MODEL_VERSION,
      createdAt: new Date().toISOString(),
    })
    .onConflictDoNothing();

  // onConflictDoNothing means `id` may not be the row that actually exists
  // if this fingerprint was already inserted by a concurrent/retried call —
  // look the real row up by fingerprint so callers always get a valid id.
  const [row] = await db
    .select({ id: schema.domainChangeEvents.id })
    .from(schema.domainChangeEvents)
    .where(eq(schema.domainChangeEvents.fingerprint, fingerprint))
    .limit(1);
  return row ?? { id };
}

/**
 * One query, not N — for the saved-domain list's "recent change" column.
 * SQLite window functions (D1 supports them) pick exactly the latest row
 * per domain_id in a single indexed scan of
 * idx_domain_change_events_domain_observed, rather than one query per
 * domain (which the Phase 8 prompt's own query-architecture rules
 * explicitly prohibit as an N+1 pattern).
 */
export async function getLatestChangeEventPerDomain(
  db: Database,
  domainIds: string[],
): Promise<Map<string, { changeOrigin: string; summary: string; observedAt: string }>> {
  if (domainIds.length === 0) return new Map();
  const idList = sql.join(
    domainIds.map((id) => sql`${id}`),
    sql`, `,
  );
  const rows = await db.all<{
    domain_id: string;
    change_origin: string;
    summary: string;
    observed_at: string;
  }>(
    sql`
      SELECT domain_id, change_origin, summary, observed_at FROM (
        SELECT domain_id, change_origin, summary, observed_at,
          ROW_NUMBER() OVER (PARTITION BY domain_id ORDER BY observed_at DESC) AS rn
        FROM domain_change_events
        WHERE domain_id IN (${idList})
      ) WHERE rn = 1
    `,
  );
  const map = new Map<string, { changeOrigin: string; summary: string; observedAt: string }>();
  for (const row of rows) {
    map.set(row.domain_id, {
      changeOrigin: row.change_origin,
      summary: row.summary,
      observedAt: row.observed_at,
    });
  }
  return map;
}

export type DomainChangeEventRow = typeof schema.domainChangeEvents.$inferSelect;

export type TimelineCursor = { observedAt: string; id: string };

export async function listDomainChangeEvents(
  db: Database,
  domainId: string,
  options: { limit?: number; cursor?: TimelineCursor | null } = {},
): Promise<{ events: DomainChangeEventRow[]; nextCursor: TimelineCursor | null }> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  const conditions = [eq(schema.domainChangeEvents.domainId, domainId)];
  if (options.cursor) {
    conditions.push(
      or(
        lt(schema.domainChangeEvents.observedAt, options.cursor.observedAt),
        and(
          eq(schema.domainChangeEvents.observedAt, options.cursor.observedAt),
          lt(schema.domainChangeEvents.id, options.cursor.id),
        ),
      )!,
    );
  }

  const rows = await db
    .select()
    .from(schema.domainChangeEvents)
    .where(and(...conditions))
    .orderBy(desc(schema.domainChangeEvents.observedAt), desc(schema.domainChangeEvents.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const events = hasMore ? rows.slice(0, limit) : rows;
  const last = events.at(-1);
  return {
    events,
    nextCursor: hasMore && last ? { observedAt: last.observedAt, id: last.id } : null,
  };
}
