import { desc, eq, gte, sql } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";

/**
 * SRS §28.12 finding/ruleset analytics. One SRS item — "findings frequently
 * marked accepted"/"high dismissal or dispute rates" — has no real data
 * behind it: there is no dismiss/accept/dispute mechanism anywhere in the
 * product (no such column on `findings`, no customer-facing UI for it).
 * Rather than invent a plausible-looking rate, `dismissalTrackingAvailable`
 * is always `false` here so the UI can say so honestly. See
 * docs/status/KNOWN_RISKS.md.
 */
export async function getFindingAnalytics(db: Database, sinceIso: string) {
  const [mostFrequent, bySeverity, byCrawler, byPreset, byPlan, newlyIntroduced] =
    await Promise.all([
      db
        .select({ code: schema.findings.findingCode, count: sql<number>`count(*)` })
        .from(schema.findings)
        .where(gte(schema.findings.createdAt, sinceIso))
        .groupBy(schema.findings.findingCode)
        .orderBy(desc(sql`count(*)`))
        .limit(20),
      db
        .select({ severity: schema.findings.severity, count: sql<number>`count(*)` })
        .from(schema.findings)
        .where(gte(schema.findings.createdAt, sinceIso))
        .groupBy(schema.findings.severity),
      db
        .select({
          crawlerId: schema.findings.affectedCrawlerId,
          crawlerName: schema.crawlers.name,
          count: sql<number>`count(*)`,
        })
        .from(schema.findings)
        .leftJoin(schema.crawlers, eq(schema.findings.affectedCrawlerId, schema.crawlers.id))
        .where(gte(schema.findings.createdAt, sinceIso))
        .groupBy(schema.findings.affectedCrawlerId)
        .orderBy(desc(sql`count(*)`))
        .limit(20),
      db
        .select({ preset: schema.scans.preset, count: sql<number>`count(*)` })
        .from(schema.findings)
        .innerJoin(schema.scans, eq(schema.findings.scanId, schema.scans.id))
        .where(gte(schema.findings.createdAt, sinceIso))
        .groupBy(schema.scans.preset),
      db
        .select({ planId: schema.users.planId, count: sql<number>`count(*)` })
        .from(schema.findings)
        .innerJoin(schema.scans, eq(schema.findings.scanId, schema.scans.id))
        .innerJoin(schema.domains, eq(schema.scans.domainId, schema.domains.id))
        .innerJoin(schema.users, eq(schema.domains.ownerUserId, schema.users.id))
        .where(gte(schema.findings.createdAt, sinceIso))
        .groupBy(schema.users.planId),
      db
        .select({
          code: schema.findings.findingCode,
          firstSeenAt: sql<string>`min(${schema.findings.createdAt})`,
        })
        .from(schema.findings)
        .groupBy(schema.findings.findingCode)
        .having(sql`min(${schema.findings.createdAt}) >= ${sinceIso}`),
    ]);

  return {
    mostFrequent,
    bySeverity,
    byCrawler,
    byPreset,
    byPlan,
    newlyIntroduced,
    dismissalTrackingAvailable: false,
    dismissalTrackingNote:
      "No dismiss/accept/dispute mechanism exists in the product yet — this metric cannot be computed honestly and is intentionally omitted rather than estimated.",
  };
}
