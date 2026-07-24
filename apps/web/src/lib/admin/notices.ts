import { desc, eq } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";

/** SRS §28.15: system notices (maintenance messages, announcements). Long-form
 * guides/articles stay repository-managed by design — this is only for
 * short, structured operational notices, deliberately not a full CMS. */
export async function listSystemNotices(db: Database) {
  return db.select().from(schema.systemNotices).orderBy(desc(schema.systemNotices.createdAt));
}

export async function createSystemNotice(
  db: Database,
  params: {
    title: string;
    body: string;
    severity: "information" | "warning" | "critical";
    createdByUserId: string;
  },
): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(schema.systemNotices).values({
    id,
    title: params.title,
    body: params.body,
    severity: params.severity,
    isPublished: false,
    createdByUserId: params.createdByUserId,
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function setNoticePublished(
  db: Database,
  noticeId: string,
  published: boolean,
): Promise<void> {
  await db
    .update(schema.systemNotices)
    .set({ isPublished: published, publishedAt: published ? new Date().toISOString() : null })
    .where(eq(schema.systemNotices.id, noticeId));
}
