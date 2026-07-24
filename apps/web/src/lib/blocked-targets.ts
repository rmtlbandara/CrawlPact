import { desc, eq, isNull } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";

/** Active admin-maintained target blocklist (SRS §28.8) — fed into the scanner's own `validateTarget` blocklist check. */
export async function getBlockedTargetPatterns(db: Database): Promise<string[]> {
  const rows = await db
    .select({ pattern: schema.blockedTargets.targetPattern })
    .from(schema.blockedTargets)
    .where(isNull(schema.blockedTargets.removedAt));
  return rows.map((r) => r.pattern);
}

/** SRS §28.8/§28.14: Super Admin block/unblock actions. */
export async function listBlockedTargets(db: Database) {
  return db
    .select({
      target: schema.blockedTargets,
      blockedBy: { displayName: schema.users.displayName },
    })
    .from(schema.blockedTargets)
    .leftJoin(schema.users, eq(schema.blockedTargets.blockedByUserId, schema.users.id))
    .orderBy(desc(schema.blockedTargets.createdAt));
}

export async function blockTarget(
  db: Database,
  params: { targetPattern: string; reason: string; blockedByUserId: string },
): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(schema.blockedTargets).values({
    id,
    targetPattern: params.targetPattern,
    reason: params.reason,
    blockedByUserId: params.blockedByUserId,
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function unblockTarget(db: Database, blockedTargetId: string): Promise<void> {
  await db
    .update(schema.blockedTargets)
    .set({ removedAt: new Date().toISOString() })
    .where(eq(schema.blockedTargets.id, blockedTargetId));
}
