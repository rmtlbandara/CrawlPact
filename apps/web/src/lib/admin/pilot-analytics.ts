import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { ratio, type RatioMetric } from "./product-analytics";
import type { PilotParticipantRow } from "./pilots";

/**
 * Phase 17 pilot cohort metrics — every number is derived live from
 * existing authoritative tables (`domains`, `subscriptions`,
 * `billing_customers`, `product_events`), never duplicated into pilot rows
 * (§75, "Pilot Dashboard Must Use Authoritative Sources"). Mirrors
 * `admin/product-analytics.ts`'s exact activation/monitoring/conversion
 * queries rather than inventing new derivation logic.
 */

export type PilotCohortMetrics = {
  cohortId: string;
  totalParticipants: number;
  segmentCounts: Record<PilotParticipantRow["segment"], number>;
  statusCounts: Record<PilotParticipantRow["participationStatus"], number>;
  activated: RatioMetric;
  monitoringEnabled: RatioMetric;
  paidConversion: RatioMetric;
  totalHumanHelpInterventions: number;
};

/**
 * "Activated" mirrors product-analytics.ts's own definition exactly:
 * at least one owned, non-deleted domain with a completed scan
 * (`domains.last_scan_id IS NOT NULL AND domains.deleted_at IS NULL`).
 * "Paid conversion" mirrors `resolveRealEntitledPlan`'s definition: a real
 * Paddle-backed subscription in an active/trialing/past_due state — never
 * `users.plan_id` alone, which can reflect a temporary admin grant.
 */
export async function getPilotCohortMetrics(
  db: Database,
  cohortId: string,
): Promise<PilotCohortMetrics> {
  const participants = await db
    .select()
    .from(schema.pilotParticipants)
    .where(eq(schema.pilotParticipants.pilotCohortId, cohortId));

  const userIds = participants.map((p) => p.userId);
  const segmentCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  let totalHumanHelpInterventions = 0;
  for (const p of participants) {
    segmentCounts[p.segment] = (segmentCounts[p.segment] ?? 0) + 1;
    statusCounts[p.participationStatus] = (statusCounts[p.participationStatus] ?? 0) + 1;
    totalHumanHelpInterventions += p.humanHelpCount;
  }

  if (userIds.length === 0) {
    return {
      cohortId,
      totalParticipants: 0,
      segmentCounts: segmentCounts as PilotCohortMetrics["segmentCounts"],
      statusCounts: statusCounts as PilotCohortMetrics["statusCounts"],
      activated: ratio(0, 0),
      monitoringEnabled: ratio(0, 0),
      paidConversion: ratio(0, 0),
      totalHumanHelpInterventions: 0,
    };
  }

  const [activatedRow] = await db
    .select({ n: sql<number>`count(distinct ${schema.domains.ownerUserId})` })
    .from(schema.domains)
    .where(
      and(
        inArray(schema.domains.ownerUserId, userIds),
        sql`${schema.domains.lastScanId} is not null`,
        isNull(schema.domains.deletedAt),
      ),
    );

  const [monitoringRow] = await db
    .select({ n: sql<number>`count(distinct ${schema.domains.ownerUserId})` })
    .from(schema.domains)
    .where(
      and(
        inArray(schema.domains.ownerUserId, userIds),
        eq(schema.domains.monitoringState, "active"),
        isNull(schema.domains.deletedAt),
      ),
    );

  const [paidRow] = await db
    .select({ n: sql<number>`count(distinct ${schema.billingCustomers.userId})` })
    .from(schema.subscriptions)
    .innerJoin(
      schema.billingCustomers,
      eq(schema.subscriptions.billingCustomerId, schema.billingCustomers.id),
    )
    .where(
      and(
        inArray(schema.billingCustomers.userId, userIds),
        sql`${schema.subscriptions.status} in ('active', 'trialing', 'past_due')`,
      ),
    );

  return {
    cohortId,
    totalParticipants: participants.length,
    segmentCounts: segmentCounts as PilotCohortMetrics["segmentCounts"],
    statusCounts: statusCounts as PilotCohortMetrics["statusCounts"],
    activated: ratio(Number(activatedRow?.n ?? 0), userIds.length),
    monitoringEnabled: ratio(Number(monitoringRow?.n ?? 0), userIds.length),
    paidConversion: ratio(Number(paidRow?.n ?? 0), userIds.length),
    totalHumanHelpInterventions,
  };
}
