import { and, eq, isNull, lte, or } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";

/**
 * Short-lived claim preventing a manual rescan from racing a concurrent
 * manual rescan or the scheduled sweep for the same domain (Phase 8; see
 * migration 0028). Same conditional-UPDATE pattern as `claimDueDomains` in
 * monitoring.ts: D1 serialises writes to a single database, so a second
 * concurrent claim's UPDATE (same WHERE clause) affects zero rows once the
 * first claim has committed — no separate lock table needed.
 */
const SCAN_LOCK_MINUTES = 5;

export async function tryClaimScanLock(
  db: Database,
  domainId: string,
  lockMinutes: number = SCAN_LOCK_MINUTES,
): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const lockUntil = new Date(Date.now() + lockMinutes * 60 * 1000).toISOString();
  const result = await db
    .update(schema.domains)
    .set({ scanLockUntil: lockUntil })
    .where(
      and(
        eq(schema.domains.id, domainId),
        or(isNull(schema.domains.scanLockUntil), lte(schema.domains.scanLockUntil, nowIso)),
      ),
    )
    .returning({ id: schema.domains.id });
  return result.length > 0;
}

export async function releaseScanLock(db: Database, domainId: string): Promise<void> {
  await db
    .update(schema.domains)
    .set({ scanLockUntil: null })
    .where(eq(schema.domains.id, domainId));
}
