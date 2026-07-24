import { eq } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";

export type Plan = typeof schema.plans.$inferSelect;

/** Every entitlement check (domain limits, groups, exports, monitoring frequency) reads from here — never hard-code a limit inline. */
export async function getPlan(db: Database, planId: string): Promise<Plan> {
  const [plan] = await db
    .select()
    .from(schema.plans)
    .where(eq(schema.plans.id, planId as Plan["id"]))
    .limit(1);
  if (!plan) throw new Error(`Unknown plan id: ${planId}`);
  return plan;
}
