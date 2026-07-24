import { desc, eq, sql } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";

/**
 * SRS §28.19: every sensitive administrative action must record who, what,
 * on what target, before/after state where applicable, why, and when — and
 * the log itself is never editable through the interface (no update/delete
 * function exists here on purpose).
 */
export async function writeAdminAuditLog(
  db: Database,
  entry: {
    administratorUserId: string;
    action: string;
    target: string;
    reason: string;
    requestId: string;
    previousState?: unknown;
    newState?: unknown;
  },
): Promise<void> {
  await db.insert(schema.adminAuditLogs).values({
    administratorUserId: entry.administratorUserId,
    action: entry.action,
    target: entry.target,
    reason: entry.reason,
    requestId: entry.requestId,
    previousState: entry.previousState !== undefined ? JSON.stringify(entry.previousState) : null,
    newState: entry.newState !== undefined ? JSON.stringify(entry.newState) : null,
    createdAt: new Date().toISOString(),
  });
}

export async function listAdminAuditLogs(
  db: Database,
  options: { limit?: number; offset?: number } = {},
) {
  return db
    .select()
    .from(schema.adminAuditLogs)
    .orderBy(desc(schema.adminAuditLogs.createdAt))
    .limit(options.limit ?? 50)
    .offset(options.offset ?? 0);
}

export async function countAdminAuditLogs(db: Database): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)` }).from(schema.adminAuditLogs);
  return row?.count ?? 0;
}

export async function getAdminAuditLogsForTarget(db: Database, target: string) {
  return db
    .select()
    .from(schema.adminAuditLogs)
    .where(eq(schema.adminAuditLogs.target, target))
    .orderBy(desc(schema.adminAuditLogs.createdAt));
}
