import { eq } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";

/** SRS §24/§33: deletion is a soft, cancellable request — a background job (Step 19/data retention) does the actual purge after the grace period. */
export const ACCOUNT_DELETION_GRACE_PERIOD_DAYS = 30;

export async function updateDisplayName(
  db: Database,
  userId: string,
  displayName: string,
): Promise<void> {
  await db
    .update(schema.users)
    .set({ displayName, updatedAt: new Date().toISOString() })
    .where(eq(schema.users.id, userId));
}

/**
 * Deliberately does not revoke existing sessions: `pending_deletion` is a
 * cancellable countdown, not an immediate access cut-off, so the account
 * stays reachable long enough for the user to change their mind via
 * `cancelAccountDeletion`. Login remains possible too — see login/finish.ts,
 * which only rejects `suspended` accounts, not `pending_deletion` ones.
 */
export async function requestAccountDeletion(db: Database, userId: string): Promise<void> {
  const now = new Date().toISOString();
  await db
    .update(schema.users)
    .set({ status: "pending_deletion", deletionRequestedAt: now, updatedAt: now })
    .where(eq(schema.users.id, userId));
}

export async function cancelAccountDeletion(db: Database, userId: string): Promise<void> {
  await db
    .update(schema.users)
    .set({ status: "active", deletionRequestedAt: null, updatedAt: new Date().toISOString() })
    .where(eq(schema.users.id, userId));
}
