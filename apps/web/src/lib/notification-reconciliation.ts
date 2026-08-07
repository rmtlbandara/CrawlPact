import { and, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { createNotificationOnce } from "./notifications";
import { buildPolicyChangeNotificationIntent } from "./notification-intents";

/**
 * Phase 10 notification reconciliation (§16, §58-59). Recovers a
 * policy-change notification that should exist but doesn't because
 * `safeNotifyPolicyChange` (monitoring.ts) failed *after* the underlying
 * domain_change_events row had already committed. Deliberately narrow in
 * scope — it repairs missing *notifications* derived from an already-valid
 * event; it never reruns a scan, never recreates monitoring state, and never
 * touches `resource_failure`/`monitoring_paused` (those are keyed off live
 * domain state — `domains.failure_episode_id`/`consecutiveFailureCount` —
 * which is already authoritative and self-consistent by construction, so
 * there is nothing separate to reconcile for them).
 *
 * Bounded and idempotent by design:
 * - `lookbackMinutes` bounds the scan to recent history only — never a full
 *   table scan, never a re-send of old notifications
 *   (docs/product/PHASE_10_NOTIFICATION_RECONCILIATION_BACKFILL_POLICY.md).
 * - `batchSize` bounds the amount of work done per run.
 * - Each candidate event is checked against `notifications` by
 *   (sourceType, sourceId) before attempting an insert, and the insert
 *   itself is idempotent via `createNotificationOnce`'s dedupe-key unique
 *   index — safe under concurrent/repeated execution.
 */
export type ReconciliationResult = {
  scanned: number;
  created: number;
};

const DEFAULT_LOOKBACK_MINUTES = 180;
const DEFAULT_BATCH_SIZE = 200;

export async function reconcileMissingPolicyChangeNotifications(
  db: Database,
  now: Date,
  options: { lookbackMinutes?: number; batchSize?: number } = {},
): Promise<ReconciliationResult> {
  const lookbackMinutes = options.lookbackMinutes ?? DEFAULT_LOOKBACK_MINUTES;
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const since = new Date(now.getTime() - lookbackMinutes * 60 * 1000).toISOString();

  const candidateEvents = await db
    .select()
    .from(schema.domainChangeEvents)
    .where(
      and(
        gte(schema.domainChangeEvents.observedAt, since),
        inArray(schema.domainChangeEvents.eventType, [
          "website_policy_change",
          "registry_driven_change",
          "mixed_change",
        ]),
        eq(schema.domainChangeEvents.attentionLevel, "high_attention"),
      ),
    )
    .limit(batchSize);

  let created = 0;
  for (const event of candidateEvents) {
    const [existing] = await db
      .select({ id: schema.notifications.id })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.sourceType, "domain_change_event"),
          eq(schema.notifications.sourceId, event.id),
        ),
      )
      .limit(1);
    if (existing) continue;

    const [domain] = await db
      .select({
        id: schema.domains.id,
        displayName: schema.domains.displayName,
        ownerUserId: schema.domains.ownerUserId,
        deletedAt: schema.domains.deletedAt,
      })
      .from(schema.domains)
      .where(eq(schema.domains.id, event.domainId))
      .limit(1);
    // Don't recreate a notification for a domain the owner has since
    // deleted — the event is still valid history, but there's no active
    // domain to notify about (`docs/product/...RECONCILIATION_BACKFILL_POLICY.md`
    // §"Do not: recreate deliberately suppressed low-signal events" applies
    // by the same logic to a since-removed subject).
    if (!domain || domain.deletedAt) continue;

    const intent = buildPolicyChangeNotificationIntent(domain, event);
    if (!intent) continue;

    const { created: wasCreated } = await createNotificationOnce(db, {
      userId: domain.ownerUserId,
      domainId: domain.id,
      ...intent,
    });
    if (wasCreated) created++;
  }

  return { scanned: candidateEvents.length, created };
}

/**
 * Operational diagnostic only (§26, §54-56) — not an auto-repair job. See
 * docs/operations/MONITORING_STATE_RECONCILIATION.md for why this codebase's
 * atomic single-UPDATE mutation pattern combined with the claim-lock design
 * means the domain-state inconsistencies §58 anticipates cannot arise from
 * normal operation, so no proactive repair exists — this function only
 * measures whether the intended self-healing is actually happening.
 */
export async function countLongOverdueActiveDomains(
  db: Database,
  now: Date,
  overdueThresholdHours = 48,
): Promise<number> {
  const threshold = new Date(now.getTime() - overdueThresholdHours * 60 * 60 * 1000).toISOString();
  const rows = await db
    .select({ id: schema.domains.id })
    .from(schema.domains)
    .where(
      and(
        eq(schema.domains.monitoringState, "active"),
        isNull(schema.domains.deletedAt),
        lt(schema.domains.nextScanAt, threshold),
      ),
    );
  return rows.length;
}
