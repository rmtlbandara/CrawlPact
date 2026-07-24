import { and, desc, eq, gte, isNull, like, or, sql } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";

export type UserSearchFilters = {
  query?: string;
  planId?: string;
  status?: "active" | "suspended" | "pending_deletion";
};

/** SRS §28.3: search by user ID, display name, Paddle customer/subscription ID, domain, plan, status. */
export async function searchUsers(db: Database, filters: UserSearchFilters, limit = 50) {
  const conditions = [];

  if (filters.query) {
    const q = `%${filters.query}%`;
    // A single free-text query matches across the fields SRS §28.3 lists as
    // separate search axes — id/name are on `users` directly; Paddle IDs and
    // domain need a join, done as a correlated EXISTS subquery so this stays
    // one query rather than N+1.
    conditions.push(
      or(
        like(schema.users.id, q),
        like(schema.users.displayName, q),
        sql`exists (select 1 from billing_customers bc where bc.user_id = ${schema.users.id} and bc.paddle_customer_id like ${q})`,
        sql`exists (select 1 from billing_customers bc join subscriptions s on s.billing_customer_id = bc.id where bc.user_id = ${schema.users.id} and s.paddle_subscription_id like ${q})`,
        sql`exists (select 1 from domains d where d.owner_user_id = ${schema.users.id} and d.deleted_at is null and (d.canonical_origin like ${q} or d.display_name like ${q}))`,
      ),
    );
  }
  if (filters.planId) conditions.push(eq(schema.users.planId, filters.planId as never));
  if (filters.status) conditions.push(eq(schema.users.status, filters.status));

  return db
    .select()
    .from(schema.users)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.users.createdAt))
    .limit(limit);
}

/** SRS §28.3: the full user detail view. Never includes recovery codes, session
 * tokens, passkey private material, or Paddle secrets — only counts/metadata. */
export async function getUserDetail(db: Database, userId: string) {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) return null;

  const [
    passkeyCount,
    activeSessionCount,
    savedDomainCount,
    manualScansThisMonth,
    notifications,
    notes,
  ] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)` })
      .from(schema.passkeyCredentials)
      .where(
        and(
          eq(schema.passkeyCredentials.userId, userId),
          isNull(schema.passkeyCredentials.removedAt),
        ),
      ),
    db
      .select({ n: sql<number>`count(*)` })
      .from(schema.sessions)
      .where(and(eq(schema.sessions.userId, userId), isNull(schema.sessions.revokedAt))),
    db
      .select({ n: sql<number>`count(*)` })
      .from(schema.domains)
      .where(and(eq(schema.domains.ownerUserId, userId), isNull(schema.domains.deletedAt))),
    db
      .select({ n: sql<number>`count(*)` })
      .from(schema.scans)
      .innerJoin(schema.domains, eq(schema.scans.domainId, schema.domains.id))
      .where(
        and(
          eq(schema.domains.ownerUserId, userId),
          eq(schema.scans.triggeredBy, "manual"),
          gte(
            schema.scans.startedAt,
            new Date(
              Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1),
            ).toISOString(),
          ),
        ),
      ),
    db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, userId))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(10),
    db
      .select({ note: schema.internalUserNotes, authorName: schema.users.displayName })
      .from(schema.internalUserNotes)
      .leftJoin(schema.users, eq(schema.internalUserNotes.authorUserId, schema.users.id))
      .where(eq(schema.internalUserNotes.userId, userId))
      .orderBy(desc(schema.internalUserNotes.createdAt)),
  ]);

  const [billingCustomer] = await db
    .select()
    .from(schema.billingCustomers)
    .where(eq(schema.billingCustomers.userId, userId))
    .limit(1);

  let subscription = null;
  if (billingCustomer) {
    const [sub] = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.billingCustomerId, billingCustomer.id))
      .orderBy(desc(schema.subscriptions.updatedAt))
      .limit(1);
    subscription = sub ?? null;
  }

  const domainsList = await db
    .select({
      id: schema.domains.id,
      canonicalOrigin: schema.domains.canonicalOrigin,
      monitoringState: schema.domains.monitoringState,
      currentScore: schema.domains.currentScore,
    })
    .from(schema.domains)
    .where(and(eq(schema.domains.ownerUserId, userId), isNull(schema.domains.deletedAt)));

  return {
    user,
    passkeyCount: passkeyCount[0]?.n ?? 0,
    activeSessionCount: activeSessionCount[0]?.n ?? 0,
    savedDomainCount: savedDomainCount[0]?.n ?? 0,
    monitoredDomainCount: domainsList.filter((d) => d.monitoringState === "active").length,
    manualScansThisMonth: manualScansThisMonth[0]?.n ?? 0,
    billingCustomer: billingCustomer ?? null,
    subscription,
    domains: domainsList,
    recentNotifications: notifications,
    internalNotes: notes,
  };
}

export async function suspendUser(db: Database, userId: string): Promise<void> {
  await db
    .update(schema.users)
    .set({ status: "suspended", updatedAt: new Date().toISOString() })
    .where(eq(schema.users.id, userId));
  await db
    .update(schema.sessions)
    .set({ revokedAt: new Date().toISOString() })
    .where(and(eq(schema.sessions.userId, userId), isNull(schema.sessions.revokedAt)));
}

export async function restoreUser(db: Database, userId: string): Promise<void> {
  await db
    .update(schema.users)
    .set({ status: "active", updatedAt: new Date().toISOString() })
    .where(eq(schema.users.id, userId));
}

export async function revokeAllSessionsForUser(db: Database, userId: string): Promise<void> {
  await db
    .update(schema.sessions)
    .set({ revokedAt: new Date().toISOString() })
    .where(and(eq(schema.sessions.userId, userId), isNull(schema.sessions.revokedAt)));
}

export async function pauseMonitoringForUser(db: Database, userId: string): Promise<void> {
  await db
    .update(schema.domains)
    .set({ monitoringState: "paused", updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(schema.domains.ownerUserId, userId),
        isNull(schema.domains.deletedAt),
        eq(schema.domains.monitoringState, "active"),
      ),
    );
}

export async function revokeAllSharedReportsForUser(db: Database, userId: string): Promise<void> {
  await db
    .update(schema.sharedReports)
    .set({ revokedAt: new Date().toISOString() })
    .where(
      and(eq(schema.sharedReports.ownerUserId, userId), isNull(schema.sharedReports.revokedAt)),
    );
}

export async function addInternalNote(
  db: Database,
  params: { userId: string; authorUserId: string; note: string },
): Promise<void> {
  await db.insert(schema.internalUserNotes).values({
    id: crypto.randomUUID(),
    userId: params.userId,
    authorUserId: params.authorUserId,
    note: params.note,
    createdAt: new Date().toISOString(),
  });
}
