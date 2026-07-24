import type { APIRoute } from "astro";
import { createDb, schema } from "@crawlpact/database";
import { eq } from "drizzle-orm";
import { getEnv } from "../../lib/env";
import { getUserIdByFeedToken, listNotifications } from "../../lib/notifications";

export const prerender = false;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * GET /feed/:token.xml — a private, per-user Atom feed of notifications
 * (SRS §26). The high-entropy token in the URL *is* the credential — there
 * is no session cookie here, since feed readers can't do a WebAuthn
 * ceremony. An invalid/revoked token gets a generic 404, never a message
 * distinguishing "wrong token" from "right token, wrong shape", so the
 * response itself can't be used to probe for valid tokens.
 */
export const GET: APIRoute = async ({ params, site }) => {
  const token = params.token;
  if (!token) return new Response("Not found", { status: 404 });

  const db = createDb(getEnv().DB);
  const userId = await getUserIdByFeedToken(db, token);
  if (!userId) return new Response("Not found", { status: 404 });

  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) return new Response("Not found", { status: 404 });

  const { items } = await listNotifications(db, userId, { limit: 50 });
  const base = site ?? new URL(getEnv().PUBLIC_SITE_URL);
  const feedUrl = new URL(`/feed/${token}.xml`, base).toString();
  const updated = items[0]?.createdAt ?? new Date().toISOString();

  const entries = items
    .map((item) => {
      const link = item.domainId
        ? new URL(`/app/domains/${item.domainId}`, base).toString()
        : undefined;
      return [
        "  <entry>",
        `    <title>${escapeXml(item.title)}</title>`,
        `    <id>urn:crawlpact:notification:${escapeXml(item.notificationId)}</id>`,
        `    <updated>${item.createdAt}</updated>`,
        `    <published>${item.createdAt}</published>`,
        link ? `    <link href="${escapeXml(link)}" />` : "",
        `    <content type="text">${escapeXml(item.body)}</content>`,
        "  </entry>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <title>CrawlPact notifications for ${escapeXml(user.displayName)}</title>`,
    `  <id>urn:crawlpact:feed:${escapeXml(userId)}</id>`,
    `  <updated>${updated}</updated>`,
    `  <link href="${escapeXml(feedUrl)}" rel="self" />`,
    entries,
    "</feed>",
  ]
    .filter(Boolean)
    .join("\n");

  return new Response(xml, {
    headers: { "Content-Type": "application/atom+xml; charset=utf-8", "X-Robots-Tag": "noindex" },
  });
};
