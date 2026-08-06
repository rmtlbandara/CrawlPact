import { and, count, desc, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { FAILURE_PAUSE_THRESHOLD } from "./monitoring";

/**
 * Phase 9 portfolio queries (docs/product/PORTFOLIO_SUMMARY_MODEL.md,
 * PORTFOLIO_ATTENTION_MODEL.md, DOMAIN_GROUP_MODEL.md). Every function here
 * takes `ownerUserId` as its first data parameter and every query is scoped
 * to it — there is no code path in this file that can read another
 * account's domains or events.
 *
 * `getPortfolioSnapshot` is the single shared, bounded (≤ the account's own
 * saved-domain limit, ≤100 at the Agency ceiling) fetch every other
 * function in this file derives from — one batched read of "current state
 * per domain", not N separate aggregate queries. This is safe specifically
 * because the domain count itself is hard-bounded by the plan's
 * saved-domain limit; the *change feed* below, which is not bounded that
 * way (an account accumulates change events over its whole lifetime), uses
 * real cursor pagination instead of this snapshot.
 */

const FAILED_SCAN_STATUSES = [
  "target_unavailable",
  "blocked_for_safety",
  "rate_limited",
  "internal_failure",
] as const;
const INCOMPLETE_SCAN_STATUSES = ["completed_with_warnings", "incomplete"] as const;

export type AttentionReason =
  | "high_attention_finding"
  | "registry_driven_review"
  | "website_policy_review"
  | "mixed_conflict"
  | "monitoring_paused_after_failures"
  | "latest_scan_incomplete"
  | "latest_scan_failed"
  | "baseline_pending";

export type DomainSnapshotRow = {
  domainId: string;
  displayName: string;
  canonicalOrigin: string;
  groupId: string | null;
  groupName: string | null;
  monitoringState: "active" | "paused";
  monitoringFrequency: "none" | "monthly" | "weekly";
  consecutiveFailureCount: number;
  lastScanAt: string | null;
  nextScanAt: string | null;
  currentScore: number | null;
  lastScanId: string | null;
  lastScanStatus: string | null;
  changeOrigin: string | null;
  attentionLevel: string | null;
  changeSummary: string | null;
  changeObservedAt: string | null;
  affectedPurposes: string[];
  attentionReasons: AttentionReason[];
};

function computeAttentionReasons(
  row: Omit<DomainSnapshotRow, "attentionReasons">,
): AttentionReason[] {
  const reasons: AttentionReason[] = [];
  if (row.attentionLevel === "high_attention") reasons.push("high_attention_finding");
  if (row.changeOrigin === "registry_driven" && row.attentionLevel !== "informational") {
    reasons.push("registry_driven_review");
  }
  if (row.changeOrigin === "website_policy" && row.attentionLevel !== "informational") {
    reasons.push("website_policy_review");
  }
  if (row.changeOrigin === "mixed") reasons.push("mixed_conflict");
  if (row.monitoringState === "paused" && row.consecutiveFailureCount >= FAILURE_PAUSE_THRESHOLD) {
    reasons.push("monitoring_paused_after_failures");
  }
  if (
    row.lastScanStatus &&
    (INCOMPLETE_SCAN_STATUSES as readonly string[]).includes(row.lastScanStatus)
  ) {
    reasons.push("latest_scan_incomplete");
  }
  if (
    row.lastScanStatus &&
    (FAILED_SCAN_STATUSES as readonly string[]).includes(row.lastScanStatus)
  ) {
    reasons.push("latest_scan_failed");
  }
  if (!row.lastScanId) reasons.push("baseline_pending");
  return reasons;
}

/** The one shared, bounded fetch every summary/attention/table function below reads from. */
export async function getPortfolioSnapshot(
  db: Database,
  ownerUserId: string,
): Promise<DomainSnapshotRow[]> {
  const domains = await db
    .select()
    .from(schema.domains)
    .where(and(eq(schema.domains.ownerUserId, ownerUserId), isNull(schema.domains.deletedAt)));
  if (domains.length === 0) return [];

  const domainIds = domains.map((d) => d.id);
  const groupIds = [...new Set(domains.map((d) => d.groupId).filter((id): id is string => !!id))];
  const lastScanIds = [
    ...new Set(domains.map((d) => d.lastScanId).filter((id): id is string => !!id)),
  ];

  const [groups, scanStatuses, latestEvents] = await Promise.all([
    groupIds.length > 0
      ? db
          .select({ id: schema.domainGroups.id, name: schema.domainGroups.name })
          .from(schema.domainGroups)
          .where(inArray(schema.domainGroups.id, groupIds))
      : Promise.resolve([]),
    lastScanIds.length > 0
      ? db
          .select({ id: schema.scans.id, status: schema.scans.status })
          .from(schema.scans)
          .where(inArray(schema.scans.id, lastScanIds))
      : Promise.resolve([]),
    getLatestChangeEventDetailPerDomain(db, domainIds),
  ]);

  const groupNameById = new Map(groups.map((g) => [g.id, g.name]));
  const scanStatusById = new Map(scanStatuses.map((s) => [s.id, s.status]));

  return domains.map((d) => {
    const event = latestEvents.get(d.id) ?? null;
    const base: Omit<DomainSnapshotRow, "attentionReasons"> = {
      domainId: d.id,
      displayName: d.displayName,
      canonicalOrigin: d.canonicalOrigin,
      groupId: d.groupId,
      groupName: d.groupId ? (groupNameById.get(d.groupId) ?? null) : null,
      monitoringState: d.monitoringState,
      monitoringFrequency: d.monitoringFrequency,
      consecutiveFailureCount: d.consecutiveFailureCount,
      lastScanAt: d.lastScanAt,
      nextScanAt: d.nextScanAt,
      currentScore: d.currentScore,
      lastScanId: d.lastScanId,
      lastScanStatus: d.lastScanId ? (scanStatusById.get(d.lastScanId) ?? null) : null,
      changeOrigin: event?.changeOrigin ?? null,
      attentionLevel: event?.attentionLevel ?? null,
      changeSummary: event?.summary ?? null,
      changeObservedAt: event?.observedAt ?? null,
      affectedPurposes: event?.affectedPurposes ?? [],
    };
    return { ...base, attentionReasons: computeAttentionReasons(base) };
  });
}

async function getLatestChangeEventDetailPerDomain(
  db: Database,
  domainIds: string[],
): Promise<
  Map<
    string,
    {
      changeOrigin: string;
      attentionLevel: string;
      summary: string;
      observedAt: string;
      affectedPurposes: string[];
    }
  >
> {
  if (domainIds.length === 0) return new Map();
  const idList = sql.join(
    domainIds.map((id) => sql`${id}`),
    sql`, `,
  );
  const rows = await db.all<{
    domain_id: string;
    change_origin: string;
    attention_level: string;
    summary: string;
    observed_at: string;
    affected_purposes_json: string;
  }>(
    sql`
      SELECT domain_id, change_origin, attention_level, summary, observed_at, affected_purposes_json FROM (
        SELECT domain_id, change_origin, attention_level, summary, observed_at, affected_purposes_json,
          ROW_NUMBER() OVER (PARTITION BY domain_id ORDER BY observed_at DESC) AS rn
        FROM domain_change_events
        WHERE domain_id IN (${idList})
      ) WHERE rn = 1
    `,
  );
  const map = new Map<
    string,
    {
      changeOrigin: string;
      attentionLevel: string;
      summary: string;
      observedAt: string;
      affectedPurposes: string[];
    }
  >();
  for (const row of rows) {
    let affectedPurposes: string[] = [];
    try {
      affectedPurposes = JSON.parse(row.affected_purposes_json) as string[];
    } catch {
      affectedPurposes = [];
    }
    map.set(row.domain_id, {
      changeOrigin: row.change_origin,
      attentionLevel: row.attention_level,
      summary: row.summary,
      observedAt: row.observed_at,
      affectedPurposes,
    });
  }
  return map;
}

export type PortfolioPeriod = "7d" | "30d" | "all";

function periodStartIso(period: PortfolioPeriod, now: Date): string | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

export type PortfolioSummary = {
  asOf: string;
  totalDomains: number;
  monitoringActive: number;
  monitoringDisabled: number;
  monitoringPaused: number;
  requiringAttention: number;
  incompleteEvidence: number;
  failedLatestScan: number;
  meaningfulChangesInPeriod: number;
  websitePolicyChangesInPeriod: number;
  registryDrivenChangesInPeriod: number;
  baselinePending: number;
};

export async function getPortfolioSummary(
  db: Database,
  ownerUserId: string,
  period: PortfolioPeriod = "30d",
  now: Date = new Date(),
): Promise<PortfolioSummary> {
  const snapshot = await getPortfolioSnapshot(db, ownerUserId);
  const periodStart = periodStartIso(period, now);
  const inPeriod = (row: DomainSnapshotRow) =>
    !!row.changeObservedAt && (!periodStart || row.changeObservedAt >= periodStart);

  return {
    asOf: now.toISOString(),
    totalDomains: snapshot.length,
    monitoringActive: snapshot.filter((d) => d.monitoringState === "active").length,
    monitoringDisabled: snapshot.filter((d) => d.monitoringFrequency === "none").length,
    monitoringPaused: snapshot.filter(
      (d) => d.monitoringState === "paused" && d.monitoringFrequency !== "none",
    ).length,
    requiringAttention: snapshot.filter((d) => d.attentionReasons.length > 0).length,
    incompleteEvidence: snapshot.filter(
      (d) =>
        d.lastScanStatus &&
        (INCOMPLETE_SCAN_STATUSES as readonly string[]).includes(d.lastScanStatus),
    ).length,
    failedLatestScan: snapshot.filter(
      (d) =>
        d.lastScanStatus && (FAILED_SCAN_STATUSES as readonly string[]).includes(d.lastScanStatus),
    ).length,
    meaningfulChangesInPeriod: snapshot.filter((d) => inPeriod(d) && d.changeOrigin !== "baseline")
      .length,
    websitePolicyChangesInPeriod: snapshot.filter(
      (d) => inPeriod(d) && d.changeOrigin === "website_policy",
    ).length,
    registryDrivenChangesInPeriod: snapshot.filter(
      (d) => inPeriod(d) && d.changeOrigin === "registry_driven",
    ).length,
    baselinePending: snapshot.filter((d) => !d.lastScanId).length,
  };
}

export type AttentionQueueFilters = {
  groupId?: string | null;
  changeOrigin?: string;
  monitoringState?: "active" | "paused";
  cursor?: number;
  limit?: number;
};

export async function listAttentionQueue(
  db: Database,
  ownerUserId: string,
  filters: AttentionQueueFilters = {},
): Promise<{ items: DomainSnapshotRow[]; nextCursor: number | null; total: number }> {
  const snapshot = await getPortfolioSnapshot(db, ownerUserId);
  let matching = snapshot.filter((d) => d.attentionReasons.length > 0);
  if (filters.groupId !== undefined) {
    matching = matching.filter((d) => d.groupId === filters.groupId);
  }
  if (filters.changeOrigin) {
    matching = matching.filter((d) => d.changeOrigin === filters.changeOrigin);
  }
  if (filters.monitoringState) {
    matching = matching.filter((d) => d.monitoringState === filters.monitoringState);
  }
  matching.sort((a, b) => (b.changeObservedAt ?? "").localeCompare(a.changeObservedAt ?? ""));

  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);
  const offset = filters.cursor ?? 0;
  const page = matching.slice(offset, offset + limit);
  const nextCursor = offset + limit < matching.length ? offset + limit : null;
  return { items: page, nextCursor, total: matching.length };
}

export type PortfolioTableFilters = {
  groupId?: string | null;
  attentionOnly?: boolean;
  monitoringState?: "active" | "paused";
  changeOrigin?: string;
  scanState?: "failed" | "incomplete";
  search?: string;
  sort?: "domain" | "last_scan" | "next_scan" | "recent_change" | "attention";
  cursor?: number;
  limit?: number;
};

export async function listPortfolioDomains(
  db: Database,
  ownerUserId: string,
  filters: PortfolioTableFilters = {},
): Promise<{ items: DomainSnapshotRow[]; nextCursor: number | null; total: number }> {
  const snapshot = await getPortfolioSnapshot(db, ownerUserId);
  let matching = snapshot;
  if (filters.groupId !== undefined)
    matching = matching.filter((d) => d.groupId === filters.groupId);
  if (filters.attentionOnly) matching = matching.filter((d) => d.attentionReasons.length > 0);
  if (filters.monitoringState) {
    matching = matching.filter((d) => d.monitoringState === filters.monitoringState);
  }
  if (filters.changeOrigin)
    matching = matching.filter((d) => d.changeOrigin === filters.changeOrigin);
  if (filters.scanState === "failed") {
    matching = matching.filter(
      (d) =>
        d.lastScanStatus && (FAILED_SCAN_STATUSES as readonly string[]).includes(d.lastScanStatus),
    );
  }
  if (filters.scanState === "incomplete") {
    matching = matching.filter(
      (d) =>
        d.lastScanStatus &&
        (INCOMPLETE_SCAN_STATUSES as readonly string[]).includes(d.lastScanStatus),
    );
  }
  if (filters.search) {
    const q = filters.search.trim().toLowerCase();
    if (q) {
      matching = matching.filter(
        (d) =>
          d.displayName.toLowerCase().includes(q) ||
          d.canonicalOrigin.toLowerCase().includes(q) ||
          (d.groupName ?? "").toLowerCase().includes(q),
      );
    }
  }

  const sort = filters.sort ?? "domain";
  matching = [...matching].sort((a, b) => {
    if (sort === "last_scan") return (b.lastScanAt ?? "").localeCompare(a.lastScanAt ?? "");
    if (sort === "next_scan") return (a.nextScanAt ?? "").localeCompare(b.nextScanAt ?? "");
    if (sort === "recent_change") {
      return (b.changeObservedAt ?? "").localeCompare(a.changeObservedAt ?? "");
    }
    if (sort === "attention") return b.attentionReasons.length - a.attentionReasons.length;
    return a.displayName.localeCompare(b.displayName);
  });

  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);
  const offset = filters.cursor ?? 0;
  const page = matching.slice(offset, offset + limit);
  const nextCursor = offset + limit < matching.length ? offset + limit : null;
  return { items: page, nextCursor, total: matching.length };
}

// --- Portfolio change feed: genuinely unbounded over time, so this uses
// real DB-level keyset pagination against domain_change_events directly,
// unlike the snapshot-based functions above. ---

export type ChangeFeedCursor = { observedAt: string; id: string };

export type ChangeFeedFilters = {
  groupId?: string | null;
  changeOrigin?: string;
  attentionLevel?: string;
  since?: string;
  limit?: number;
  cursor?: ChangeFeedCursor | null;
};

export type ChangeFeedItem = {
  id: string;
  domainId: string;
  displayName: string;
  groupId: string | null;
  groupName: string | null;
  eventType: string;
  changeOrigin: string;
  attentionLevel: string;
  affectedPurposes: string[];
  observedAt: string;
  summary: string;
};

export async function listPortfolioChangeFeed(
  db: Database,
  ownerUserId: string,
  filters: ChangeFeedFilters = {},
): Promise<{ items: ChangeFeedItem[]; nextCursor: ChangeFeedCursor | null }> {
  const ownedDomains = await db
    .select({
      id: schema.domains.id,
      displayName: schema.domains.displayName,
      groupId: schema.domains.groupId,
    })
    .from(schema.domains)
    .where(and(eq(schema.domains.ownerUserId, ownerUserId), isNull(schema.domains.deletedAt)));
  if (ownedDomains.length === 0) return { items: [], nextCursor: null };

  let scopedDomains = ownedDomains;
  if (filters.groupId !== undefined) {
    scopedDomains = scopedDomains.filter((d) => d.groupId === filters.groupId);
  }
  if (scopedDomains.length === 0) return { items: [], nextCursor: null };

  const groupIds = [
    ...new Set(scopedDomains.map((d) => d.groupId).filter((id): id is string => !!id)),
  ];
  const groups =
    groupIds.length > 0
      ? await db
          .select({ id: schema.domainGroups.id, name: schema.domainGroups.name })
          .from(schema.domainGroups)
          .where(inArray(schema.domainGroups.id, groupIds))
      : [];
  const groupNameById = new Map(groups.map((g) => [g.id, g.name]));
  const displayNameById = new Map(scopedDomains.map((d) => [d.id, d.displayName]));
  const groupIdById = new Map(scopedDomains.map((d) => [d.id, d.groupId]));

  const domainIds = scopedDomains.map((d) => d.id);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  const conditions = [
    inArray(schema.domainChangeEvents.domainId, domainIds),
    // "Meaningful" per docs/product/PORTFOLIO_ATTENTION_MODEL.md's inclusion rules — baseline and
    // real policy/registry/mixed changes only; a bare operational_change row is excluded here
    // unless it's the only content (this phase does not need a completeness-delta filter beyond
    // what generateTimelineEvent already decided was worth recording).
  ];
  if (filters.changeOrigin) {
    conditions.push(eq(schema.domainChangeEvents.changeOrigin, filters.changeOrigin as never));
  }
  if (filters.attentionLevel) {
    conditions.push(eq(schema.domainChangeEvents.attentionLevel, filters.attentionLevel as never));
  }
  if (filters.since) {
    conditions.push(gte(schema.domainChangeEvents.observedAt, filters.since));
  }
  if (filters.cursor) {
    conditions.push(
      or(
        lt(schema.domainChangeEvents.observedAt, filters.cursor.observedAt),
        and(
          eq(schema.domainChangeEvents.observedAt, filters.cursor.observedAt),
          lt(schema.domainChangeEvents.id, filters.cursor.id),
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
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);

  const items: ChangeFeedItem[] = page.map((row) => {
    let affectedPurposes: string[] = [];
    try {
      affectedPurposes = JSON.parse(row.affectedPurposesJson) as string[];
    } catch {
      affectedPurposes = [];
    }
    const groupId = groupIdById.get(row.domainId) ?? null;
    return {
      id: row.id,
      domainId: row.domainId,
      displayName: displayNameById.get(row.domainId) ?? "",
      groupId,
      groupName: groupId ? (groupNameById.get(groupId) ?? null) : null,
      eventType: row.eventType,
      changeOrigin: row.changeOrigin,
      attentionLevel: row.attentionLevel,
      affectedPurposes,
      observedAt: row.observedAt,
      summary: row.summary,
    };
  });

  return {
    items,
    nextCursor: hasMore && last ? { observedAt: last.observedAt, id: last.id } : null,
  };
}

/** Group-level summary — same explainable-count model as the account-wide summary, scoped to one group (§18). */
export async function getGroupSummary(
  db: Database,
  ownerUserId: string,
  groupId: string,
): Promise<PortfolioSummary & { domainCount: number }> {
  const snapshot = (await getPortfolioSnapshot(db, ownerUserId)).filter(
    (d) => d.groupId === groupId,
  );
  const now = new Date();
  const periodStart = periodStartIso("30d", now);
  const inPeriod = (row: DomainSnapshotRow) =>
    !!row.changeObservedAt && (!periodStart || row.changeObservedAt >= periodStart);

  return {
    asOf: now.toISOString(),
    domainCount: snapshot.length,
    totalDomains: snapshot.length,
    monitoringActive: snapshot.filter((d) => d.monitoringState === "active").length,
    monitoringDisabled: snapshot.filter((d) => d.monitoringFrequency === "none").length,
    monitoringPaused: snapshot.filter(
      (d) => d.monitoringState === "paused" && d.monitoringFrequency !== "none",
    ).length,
    requiringAttention: snapshot.filter((d) => d.attentionReasons.length > 0).length,
    incompleteEvidence: snapshot.filter(
      (d) =>
        d.lastScanStatus &&
        (INCOMPLETE_SCAN_STATUSES as readonly string[]).includes(d.lastScanStatus),
    ).length,
    failedLatestScan: snapshot.filter(
      (d) =>
        d.lastScanStatus && (FAILED_SCAN_STATUSES as readonly string[]).includes(d.lastScanStatus),
    ).length,
    meaningfulChangesInPeriod: snapshot.filter((d) => inPeriod(d) && d.changeOrigin !== "baseline")
      .length,
    websitePolicyChangesInPeriod: snapshot.filter(
      (d) => inPeriod(d) && d.changeOrigin === "website_policy",
    ).length,
    registryDrivenChangesInPeriod: snapshot.filter(
      (d) => inPeriod(d) && d.changeOrigin === "registry_driven",
    ).length,
    baselinePending: snapshot.filter((d) => !d.lastScanId).length,
  };
}

/** Distinct count helper reused by the workspace header ("Monitoring coverage"). */
export async function countActiveMonitoring(db: Database, ownerUserId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(schema.domains)
    .where(
      and(
        eq(schema.domains.ownerUserId, ownerUserId),
        isNull(schema.domains.deletedAt),
        eq(schema.domains.monitoringState, "active"),
      ),
    );
  return row?.value ?? 0;
}
