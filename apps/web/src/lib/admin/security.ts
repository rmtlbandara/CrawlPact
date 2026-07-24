import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";

export type SecurityEventFilters = { eventType?: string; unresolvedOnly?: boolean };

/** SRS §28.14: security dashboard — unsafe targets, rate limits, auth/recovery
 * failures, suspicious sessions, invalid Paddle signatures, replayed
 * webhooks, and administrator security actions are all `security_events`
 * rows already (Part 2 Step 19), just not previously surfaced in an admin view. */
export async function listSecurityEvents(db: Database, filters: SecurityEventFilters = {}) {
  const conditions = [];
  if (filters.eventType)
    conditions.push(eq(schema.securityEvents.eventType, filters.eventType as never));
  if (filters.unresolvedOnly) conditions.push(isNull(schema.securityEvents.resolvedAt));

  return db
    .select({
      event: schema.securityEvents,
      user: { displayName: schema.users.displayName },
    })
    .from(schema.securityEvents)
    .leftJoin(schema.users, eq(schema.securityEvents.userId, schema.users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.securityEvents.createdAt))
    .limit(200);
}

export async function resolveSecurityEvent(
  db: Database,
  eventId: number,
  params: { resolvedByUserId: string; note: string },
): Promise<void> {
  await db
    .update(schema.securityEvents)
    .set({
      resolvedAt: new Date().toISOString(),
      resolvedByUserId: params.resolvedByUserId,
      resolutionNote: params.note,
    })
    .where(eq(schema.securityEvents.id, eventId));
}

/** SRS §28.14 "high-volume scanning accounts": users whose owned domains
 * triggered the most manual/scheduled scans in the window. */
export async function getHighVolumeAccounts(db: Database, sinceIso: string, limit = 20) {
  return db
    .select({
      userId: schema.users.id,
      displayName: schema.users.displayName,
      scanCount: sql<number>`count(*)`,
    })
    .from(schema.scans)
    .innerJoin(schema.domains, eq(schema.scans.domainId, schema.domains.id))
    .innerJoin(schema.users, eq(schema.domains.ownerUserId, schema.users.id))
    .where(gte(schema.scans.startedAt, sinceIso))
    .groupBy(schema.users.id)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}

/** SRS §28.14 "frequently scanned targets": distinct from Step 6's
 * "high-failure hosts" — this counts *all* scans (successful or not) per
 * host, since the security lens cares about scan volume against one
 * target regardless of outcome (the abuse pattern named in
 * docs/security/THREAT_MODEL.md: "many different callers scanning the same
 * target"). */
export async function getFrequentlyScannedHosts(db: Database, sinceIso: string, limit = 20) {
  return db
    .select({ canonicalOrigin: schema.scans.canonicalOrigin, count: sql<number>`count(*)` })
    .from(schema.scans)
    .where(gte(schema.scans.startedAt, sinceIso))
    .groupBy(schema.scans.canonicalOrigin)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}

export const SECURITY_EVENT_TYPES = [
  "unsafe_scan_attempt",
  "rate_limit",
  "auth_failure",
  "recovery_code_failure",
  "suspicious_session",
  "invalid_paddle_signature",
  "replayed_webhook",
  "admin_security_action",
] as const;
