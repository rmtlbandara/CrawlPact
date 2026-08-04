import { sql } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";

const PAID_PLAN_IDS = ["solo", "pro", "agency"] as const;
const INTERVALS = ["month", "year"] as const;

export type PlanPriceCatalogRow = {
  id: string;
  planId: string;
  environment: "sandbox" | "production";
  interval: "month" | "year";
  amountUsdCents: number;
  paddleProductId: string;
  paddlePriceId: string;
  activeForNewCheckout: boolean;
  legacy: boolean;
  effectiveDate: string;
  archivedAt: string | null;
  lastVerifiedAt: string | null;
  subscriberCount: number;
};

/** Every `plan_prices` row, joined with a live count of subscribers currently on that exact
 * Paddle price (active/trialing/past_due) — SRS §28's Super Admin billing/catalog visibility
 * requirement. Read-only; catalog writes only ever happen through the Paddle MCP preflight
 * process documented in docs/billing/PADDLE_LIVE_PREFLIGHT_CHANGE_MANIFEST.md. */
export async function getPlanPriceCatalog(db: Database): Promise<PlanPriceCatalogRow[]> {
  const [rows, counts] = await Promise.all([
    db
      .select()
      .from(schema.planPrices)
      .orderBy(schema.planPrices.planId, schema.planPrices.interval),
    db
      .select({
        paddlePriceId: schema.subscriptions.paddlePriceId,
        count: sql<number>`count(*)`,
      })
      .from(schema.subscriptions)
      .where(sql`${schema.subscriptions.status} in ('active', 'trialing', 'past_due')`)
      .groupBy(schema.subscriptions.paddlePriceId),
  ]);

  const countByPriceId = new Map(counts.map((c) => [c.paddlePriceId, c.count]));

  return rows.map((row) => ({
    ...row,
    subscriberCount: countByPriceId.get(row.paddlePriceId) ?? 0,
  }));
}

export type CatalogStatusFlag = {
  level: "error" | "warning";
  message: string;
};

/**
 * Read-only reconciliation flags for the current runtime environment — the same status
 * vocabulary `pnpm paddle:catalog:verify` uses, surfaced directly in the Super Admin UI so a
 * drift doesn't require shelling into a script to notice. Never mutates anything.
 */
export function computeCatalogStatusFlags(
  rows: PlanPriceCatalogRow[],
  currentEnvironment: "sandbox" | "production",
): CatalogStatusFlag[] {
  const flags: CatalogStatusFlag[] = [];

  for (const planId of PAID_PLAN_IDS) {
    for (const interval of INTERVALS) {
      const active = rows.filter(
        (r) =>
          r.planId === planId &&
          r.environment === currentEnvironment &&
          r.interval === interval &&
          r.activeForNewCheckout &&
          !r.archivedAt,
      );
      if (active.length === 0) {
        flags.push({
          level: "error",
          message: `Missing mapping: no active ${currentEnvironment} ${interval}ly price for plan "${planId}" — checkout will reject this combination.`,
        });
      } else if (active.length > 1) {
        flags.push({
          level: "error",
          message: `Duplicate mapping: ${active.length} active ${currentEnvironment} ${interval}ly prices for plan "${planId}" (${active
            .map((a) => a.paddlePriceId)
            .join(", ")}) — checkout resolution is ambiguous.`,
        });
      }
    }
  }

  const seenPriceIds = new Map<string, number>();
  for (const row of rows) {
    seenPriceIds.set(row.paddlePriceId, (seenPriceIds.get(row.paddlePriceId) ?? 0) + 1);
  }
  for (const [priceId, count] of seenPriceIds) {
    if (count > 1) {
      flags.push({
        level: "error",
        message: `Paddle price ID ${priceId} appears in ${count} plan_prices rows — should be unique per row.`,
      });
    }
  }

  for (const row of rows) {
    if (
      row.legacy &&
      row.activeForNewCheckout &&
      row.environment === currentEnvironment &&
      !row.archivedAt
    ) {
      flags.push({
        level: "warning",
        message: `Legacy price ${row.paddlePriceId} (plan "${row.planId}", ${row.interval}ly) is still marked active for new checkout — legacy prices should be retired from new checkout, only kept for existing subscribers.`,
      });
    }
    if (row.archivedAt && row.subscriberCount > 0) {
      flags.push({
        level: "error",
        message: `Price ${row.paddlePriceId} (plan "${row.planId}", ${row.interval}ly) is archived but still has ${row.subscriberCount} subscriber(s) on it.`,
      });
    }
  }

  return flags;
}
