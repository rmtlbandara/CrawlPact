import type { APIRoute } from "astro";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../lib/env";
import { getFeedAccessByToken, listNotifications } from "../../lib/notifications";
import { sha256Hex } from "../../lib/persist-scan";

export const prerender = false;

const FEED_ITEM_LIMIT = 50;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const NOT_FOUND_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

/**
 * GET /feed/:token.xml — a private, per-user Atom feed of notifications
 * (SRS §26; Phase 10 hardening). The high-entropy token in the URL *is* the
 * credential — there is no session cookie here, since feed readers can't do
 * a WebAuthn ceremony. An invalid token, a revoked token, a deleted/suspended
 * account, and a downgraded-off-entitlement account all produce the exact
 * same generic 404 (`getFeedAccessByToken` collapses every denial reason)
 * so the response itself can never be used to probe which reason applied.
 */
export const GET: APIRoute = async ({ params, site }) => {
  const token = params.token;
  if (!token) return new Response("Not found", { status: 404, headers: NOT_FOUND_HEADERS });

  const db = createDb(getEnv().DB);
  const access = await getFeedAccessByToken(db, token);
  if (!access) return new Response("Not found", { status: 404, headers: NOT_FOUND_HEADERS });

  const { items } = await listNotifications(db, access.userId, { limit: FEED_ITEM_LIMIT });
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

  // Phase 10 (§37): minimise feed metadata — no personal display name, no
  // raw internal user id. The feed <id> must stay stable across token
  // regeneration (it identifies the *feed*, not the *credential*), so it's a
  // one-way hash of the user id rather than the token itself.
  const opaqueFeedId = await sha256Hex(access.userId);

  const xml = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    "  <title>CrawlPact notifications</title>",
    `  <id>urn:crawlpact:feed:${opaqueFeedId.slice(0, 32)}</id>`,
    `  <updated>${updated}</updated>`,
    `  <link href="${escapeXml(feedUrl)}" rel="self" />`,
    entries,
    "</feed>",
  ]
    .filter(Boolean)
    .join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
};
