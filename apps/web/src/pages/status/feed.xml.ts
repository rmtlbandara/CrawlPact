import type { APIRoute } from "astro";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../lib/env";
import { getPublicStatus } from "../../lib/status/public-status";

export const prerender = false;

const FEED_ITEM_LIMIT = 30;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * GET /status/feed.xml — Phase 14 (§88-91). A public status Atom feed,
 * distinct from the private per-account notification feed
 * (`/feed/[token].xml`) — no token, no entitlement, intentionally public.
 * Reuses `getPublicStatus()` directly (the exact same data `/status`
 * itself renders) rather than a second query path, so this feed
 * structurally cannot expose anything the HTML page couldn't — see
 * `docs/operations/PUBLIC_INTERNAL_STATUS_BOUNDARY.md`.
 *
 * Content is limited to public incidents, their updates, scheduled
 * maintenance, and recently-resolved incidents — never security events,
 * monitoring backlog, internal alerts, customer domains, D1 status, Worker
 * errors, or admin-only data (§89), because `PublicIncident`'s own type
 * shape has no field for any of those.
 */
export const GET: APIRoute = async ({ site }) => {
  const db = createDb(getEnv().DB);
  const report = await getPublicStatus(db);
  const base = site ?? new URL(getEnv().PUBLIC_SITE_URL);
  const feedUrl = new URL("/status/feed.xml", base).toString();
  const statusPageUrl = new URL("/status/", base).toString();

  const allIncidents = [
    ...report.currentIncidents,
    ...report.scheduledMaintenance,
    ...report.recentlyResolved,
  ].slice(0, FEED_ITEM_LIMIT);

  const updated = allIncidents[0]
    ? (allIncidents[0].updates[allIncidents[0].updates.length - 1]?.createdAt ??
      allIncidents[0].startsAt)
    : report.checkedAt;

  const entries = allIncidents
    .map((incident) => {
      const latestUpdate = incident.updates[incident.updates.length - 1];
      const entryUpdated = latestUpdate?.createdAt ?? incident.startsAt;
      const kind = incident.isScheduledMaintenance ? "Scheduled maintenance" : "Incident";
      return [
        "  <entry>",
        `    <title>${escapeXml(`${kind}: ${incident.title}`)}</title>`,
        `    <id>urn:crawlpact:status-incident:${escapeXml(incident.id)}</id>`,
        `    <updated>${entryUpdated}</updated>`,
        `    <published>${incident.startsAt}</published>`,
        `    <link href="${escapeXml(statusPageUrl)}" />`,
        `    <content type="text">${escapeXml(
          `${incident.publicSummary} (status: ${incident.status})`,
        )}</content>`,
        "  </entry>",
      ].join("\n");
    })
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    "  <title>CrawlPact status</title>",
    "  <id>urn:crawlpact:status-feed</id>",
    `  <updated>${updated}</updated>`,
    `  <link href="${escapeXml(feedUrl)}" rel="self" />`,
    `  <link href="${escapeXml(statusPageUrl)}" />`,
    entries,
    "</feed>",
  ]
    .filter(Boolean)
    .join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      // §91: the feed itself stays out of search results (its content is a
      // duplicate, machine-consumption view of /status); the human-readable
      // /status page itself may remain indexable per existing SEO policy.
      "X-Robots-Tag": "noindex",
      // Intentionally public (not private/no-store like the per-account
      // feed) — same short TTL as /status itself.
      "Cache-Control": "public, max-age=30",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
};
