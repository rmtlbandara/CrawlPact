import { and, eq, gte } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";

type SecurityEventType = (typeof schema.securityEvents.$inferInsert)["eventType"];

export async function recordSecurityEvent(
  db: Database,
  eventType: SecurityEventType,
  fields: {
    userId?: string | null;
    ipHash?: string | null;
    target?: string | null;
    details?: unknown;
  } = {},
): Promise<void> {
  await db.insert(schema.securityEvents).values({
    eventType,
    userId: fields.userId ?? null,
    ipHash: fields.ipHash ?? null,
    target: fields.target ?? null,
    details: fields.details !== undefined ? JSON.stringify(fields.details) : null,
    createdAt: new Date().toISOString(),
  });
}

/**
 * D1-backed sliding-window counter (no KV/Durable Object binding exists in
 * this deployment — see apps/web/wrangler.jsonc). Adequate for the volumes
 * this endpoint class sees; revisit with a dedicated store if abuse volume
 * ever makes the extra query per request a real cost.
 */
export async function isRateLimited(
  db: Database,
  eventType: SecurityEventType,
  ipHash: string,
  options: { max: number; windowMs: number; scope?: string },
): Promise<boolean> {
  const cutoff = new Date(Date.now() - options.windowMs).toISOString();
  const conditions = [
    eq(schema.securityEvents.eventType, eventType),
    eq(schema.securityEvents.ipHash, ipHash),
    gte(schema.securityEvents.createdAt, cutoff),
  ];
  // `scope` keeps unrelated callers of the same eventType (e.g. anonymous
  // audit rate limiting vs. admin-action rate limiting, both "rate_limit")
  // from sharing one counter — see require-admin.ts for the admin usage.
  if (options.scope) conditions.push(eq(schema.securityEvents.target, options.scope));
  const rows = await db
    .select({ id: schema.securityEvents.id })
    .from(schema.securityEvents)
    .where(and(...conditions));
  return rows.length >= options.max;
}
