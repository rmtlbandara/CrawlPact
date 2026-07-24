import { and, count, desc, eq, inArray, isNull, lt } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import type { Notification } from "@crawlpact/core";
import { bytesToBase64Url } from "./base64url";
import { trackEvent } from "./analytics";

type NotificationType = (typeof schema.notifications.$inferInsert)["type"];
type NotificationRow = typeof schema.notifications.$inferSelect;

/** SRS §26: the single write path for in-app notifications — monitoring (Step 15) is the main producer today. */
export async function createNotification(
  db: Database,
  userId: string,
  domainId: string | null,
  type: NotificationType,
  title: string,
  body: string,
): Promise<void> {
  await db.insert(schema.notifications).values({
    id: crypto.randomUUID(),
    userId,
    domainId,
    type,
    title,
    body,
    createdAt: new Date().toISOString(),
  });
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
  };
}

/** SRS §10.41: repeated resource_failure notifications for the same domain collapse into one grouped row. */
function groupRepeatedFailures(rows: NotificationRow[]): Notification[] {
  const result: Notification[] = [];
  for (const row of rows) {
    const mapped = toNotification(row);
    const last = result[result.length - 1];
    if (
      mapped.type === "resource_failure" &&
      last?.type === "resource_failure" &&
      last.domainId === mapped.domainId &&
      last.isRead === mapped.isRead
    ) {
      last.groupCount = (last.groupCount ?? 1) + 1;
      continue;
    }
    result.push(mapped);
  }
  return result;
}

export type ListNotificationsOptions = {
  cursor?: string;
  limit?: number;
  type?: NotificationType;
  domainId?: string;
  unreadOnly?: boolean;
};

export async function listNotifications(
  db: Database,
  userId: string,
  options: ListNotificationsOptions = {},
): Promise<{ items: Notification[]; nextCursor: string | null }> {
  const limit = options.limit ?? 25;
  const conditions = [eq(schema.notifications.userId, userId)];
  if (options.type) conditions.push(eq(schema.notifications.type, options.type));
  if (options.domainId) conditions.push(eq(schema.notifications.domainId, options.domainId));
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

  return {
    items: groupRepeatedFailures(page),
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

/** Looks up the owning user from a raw feed token — the token itself is the only credential the public feed endpoint has. */
export async function getUserIdByFeedToken(db: Database, token: string): Promise<string | null> {
  const tokenHash = await hashFeedToken(token);
  const [row] = await db
    .select({ userId: schema.feedTokens.userId })
    .from(schema.feedTokens)
    .where(and(eq(schema.feedTokens.tokenHash, tokenHash), isNull(schema.feedTokens.revokedAt)))
    .limit(1);
  return row?.userId ?? null;
}
