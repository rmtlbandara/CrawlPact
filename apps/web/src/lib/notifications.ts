import { and, count, desc, eq, inArray, isNull, lt } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import type { Notification } from "@crawlpact/core";
import { bytesToBase64Url } from "./base64url";
import { trackEvent } from "./analytics";
import { getPlan } from "./plan";

type NotificationType = (typeof schema.notifications.$inferInsert)["type"];
type NotificationCategory = (typeof schema.notifications.$inferInsert)["category"];
type NotificationPriority = (typeof schema.notifications.$inferInsert)["priority"];
type NotificationSourceType = (typeof schema.notifications.$inferInsert)["sourceType"];
type NotificationRow = typeof schema.notifications.$inferSelect;

export type NotificationIntent = {
  userId: string;
  domainId: string | null;
  type: NotificationType;
  category: NotificationCategory;
  priority?: NotificationPriority;
  title: string;
  body: string;
  sourceType: NotificationSourceType;
  sourceId: string;
  dedupeKey: string;
  actionPath?: string;
  modelVersion?: string;
};

/**
 * Phase 10: idempotent insert for a notification with exactly one logical
 * source event (every implemented type except the failure-episode-grouped
 * `resource_failure`/`monitoring_paused` pair — see `upsertGroupedNotification`
 * below). A retried/concurrent call with the same `dedupeKey` for the same
 * user is a true no-op, enforced at the D1 level by
 * `idx_notifications_user_dedupe` (migration 0030), not just in application
 * code — required because application-only duplicate checks are unsafe under
 * concurrent retries. Returns whether a new row was actually created, so
 * reconciliation and tests can distinguish "created" from "already existed".
 */
export async function createNotificationOnce(
  db: Database,
  intent: NotificationIntent,
): Promise<{ created: boolean }> {
  const now = new Date().toISOString();
  const result = await db
    .insert(schema.notifications)
    .values({
      id: crypto.randomUUID(),
      userId: intent.userId,
      domainId: intent.domainId,
      type: intent.type,
      category: intent.category,
      priority: intent.priority ?? "normal",
      title: intent.title,
      body: intent.body,
      sourceType: intent.sourceType,
      sourceId: intent.sourceId,
      dedupeKey: intent.dedupeKey,
      actionPath: intent.actionPath ?? null,
      occurrenceCount: 1,
      lastOccurredAt: now,
      modelVersion: intent.modelVersion ?? null,
      createdAt: now,
    })
    .onConflictDoNothing()
    .returning({ id: schema.notifications.id });
  return { created: result.length > 0 };
}

/**
 * Phase 10: upsert for a failure-episode-grouped notification
 * (`resource_failure`, `monitoring_paused`) — `dedupeKey` is stable for the
 * domain's *entire* current failure streak (see
 * `domains.failure_episode_id`), and `occurrenceCount` is always the
 * authoritative current value (`domain.consecutiveFailureCount`), never an
 * incremented delta. This makes the write idempotent under retry without
 * needing to distinguish "a genuinely new failure" from "the same failure's
 * notification retried" at the call site: re-applying the same
 * `occurrenceCount` is a no-op (no re-surfacing as unread), and a strictly
 * higher `occurrenceCount` updates the row and clears `readAt` — a real new
 * occurrence is worth re-surfacing even if the user already read the
 * previous one (docs/product/NOTIFICATION_FATIGUE_AND_GROUPING_POLICY.md).
 */
export async function upsertGroupedNotification(
  db: Database,
  intent: NotificationIntent & { occurrenceCount: number },
): Promise<{ created: boolean; updated: boolean }> {
  const now = new Date().toISOString();
  const [existing] = await db
    .select({ id: schema.notifications.id, occurrenceCount: schema.notifications.occurrenceCount })
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.userId, intent.userId),
        eq(schema.notifications.dedupeKey, intent.dedupeKey),
      ),
    )
    .limit(1);

  if (!existing) {
    await db
      .insert(schema.notifications)
      .values({
        id: crypto.randomUUID(),
        userId: intent.userId,
        domainId: intent.domainId,
        type: intent.type,
        category: intent.category,
        priority: intent.priority ?? "normal",
        title: intent.title,
        body: intent.body,
        sourceType: intent.sourceType,
        sourceId: intent.sourceId,
        dedupeKey: intent.dedupeKey,
        actionPath: intent.actionPath ?? null,
        occurrenceCount: intent.occurrenceCount,
        lastOccurredAt: now,
        modelVersion: intent.modelVersion ?? null,
        createdAt: now,
      })
      // Concurrent-retry safety net: if another call already won the race
      // and inserted this dedupeKey first, this becomes a harmless no-op —
      // the row already reflects (at least) the same information.
      .onConflictDoNothing();
    return { created: true, updated: false };
  }

  if (intent.occurrenceCount <= existing.occurrenceCount) {
    // A retry of an occurrence count already recorded — no-op, including no
    // re-surfacing as unread.
    return { created: false, updated: false };
  }

  await db
    .update(schema.notifications)
    .set({
      title: intent.title,
      body: intent.body,
      occurrenceCount: intent.occurrenceCount,
      lastOccurredAt: now,
      readAt: null,
    })
    .where(eq(schema.notifications.id, existing.id));
  return { created: false, updated: true };
}

function toNotification(row: NotificationRow): Notification {
  return {
    notificationId: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    domainId: row.domainId,
    isRead: row.readAt !== null,
    createdAt: row.createdAt,
    groupCount: row.occurrenceCount > 1 ? row.occurrenceCount : undefined,
    category: row.category ?? undefined,
    priority: row.priority ?? undefined,
    actionPath: row.actionPath ?? undefined,
    lastOccurredAt: row.lastOccurredAt ?? undefined,
  };
}

export type ListNotificationsOptions = {
  cursor?: string;
  limit?: number;
  type?: NotificationType;
  category?: NotificationCategory;
  domainId?: string;
  /** Pro/Agency domain-group filter — resolved to a domainId IN (...) list by the caller (apps/web/src/pages/api/notifications/index.ts), which already owns the group-membership query used elsewhere in the workspace. */
  domainIds?: string[];
  unreadOnly?: boolean;
};

export async function listNotifications(
  db: Database,
  userId: string,
  options: ListNotificationsOptions = {},
): Promise<{ items: Notification[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 50);
  const conditions = [eq(schema.notifications.userId, userId)];
  if (options.type) conditions.push(eq(schema.notifications.type, options.type));
  if (options.category) conditions.push(eq(schema.notifications.category, options.category));
  if (options.domainId) conditions.push(eq(schema.notifications.domainId, options.domainId));
  if (options.domainIds) conditions.push(inArray(schema.notifications.domainId, options.domainIds));
  if (options.unreadOnly) conditions.push(isNull(schema.notifications.readAt));
  if (options.cursor) conditions.push(lt(schema.notifications.createdAt, options.cursor));

  const rows = await db
    .select()
    .from(schema.notifications)
    .where(and(...conditions))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);

  // Grouping (repeated resource_failure/monitoring_paused) is now done at
  // write time (occurrenceCount, upsertGroupedNotification) — one row per
  // failure episode — rather than by collapsing adjacent rows here, which
  // broke down at page boundaries. toNotification() already surfaces
  // occurrenceCount as groupCount.
  return {
    items: page.map(toNotification),
    nextCursor: hasMore ? page[page.length - 1]!.createdAt : null,
  };
}

export async function getUnreadCount(db: Database, userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(schema.notifications)
    .where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)));
  return row?.value ?? 0;
}

export async function markNotificationsRead(
  db: Database,
  userId: string,
  notificationIds: string[],
): Promise<void> {
  await trackEvent(db, "notification_opened", {
    userId,
    properties: { count: notificationIds.length },
  });
  await db
    .update(schema.notifications)
    .set({ readAt: new Date().toISOString() })
    .where(
      and(
        eq(schema.notifications.userId, userId),
        inArray(schema.notifications.id, notificationIds),
      ),
    );
}

export async function markAllNotificationsRead(db: Database, userId: string): Promise<void> {
  await db
    .update(schema.notifications)
    .set({ readAt: new Date().toISOString() })
    .where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)));
}

async function hashFeedToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Regenerating always revokes every prior token first — only one private feed URL is ever valid at a time (SRS §26). */
export async function generateFeedToken(db: Database, userId: string): Promise<string> {
  await db
    .update(schema.feedTokens)
    .set({ revokedAt: new Date().toISOString() })
    .where(and(eq(schema.feedTokens.userId, userId), isNull(schema.feedTokens.revokedAt)));

  const token = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  await db.insert(schema.feedTokens).values({
    id: crypto.randomUUID(),
    userId,
    tokenHash: await hashFeedToken(token),
    createdAt: new Date().toISOString(),
  });
  return token;
}

export async function revokeFeedTokens(db: Database, userId: string): Promise<void> {
  await db
    .update(schema.feedTokens)
    .set({ revokedAt: new Date().toISOString() })
    .where(and(eq(schema.feedTokens.userId, userId), isNull(schema.feedTokens.revokedAt)));
}

/**
 * Phase 10: looks up the owning user from a raw feed token AND re-verifies
 * current plan entitlement — a token alone must never bypass entitlement
 * (SRS §35). Checked on every feed request, not just at token-issuance time,
 * so a downgraded account's feed stops working even if token revocation on
 * downgrade were ever skipped or failed. Returns `null` for every denial
 * reason (invalid token, revoked token, deleted/suspended account, lost
 * entitlement) with no distinguishing detail — the caller (the feed route)
 * always responds with the same generic 404, so the response itself can
 * never be used to probe which reason applied.
 */
export async function getFeedAccessByToken(
  db: Database,
  token: string,
): Promise<{ userId: string } | null> {
  const tokenHash = await hashFeedToken(token);
  const [tokenRow] = await db
    .select({ userId: schema.feedTokens.userId })
    .from(schema.feedTokens)
    .where(and(eq(schema.feedTokens.tokenHash, tokenHash), isNull(schema.feedTokens.revokedAt)))
    .limit(1);
  if (!tokenRow) return null;

  const [user] = await db
    .select({
      status: schema.users.status,
      planId: schema.users.planId,
      deletedAt: schema.users.deletedAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, tokenRow.userId))
    .limit(1);
  if (!user || user.deletedAt || user.status !== "active") return null;

  const plan = await getPlan(db, user.planId);
  if (!plan.privateAtomFeedEnabled) return null;

  return { userId: tokenRow.userId };
}
