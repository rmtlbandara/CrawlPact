import { gte, lt, sql } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { bytesToBase64Url } from "./base64url";
import { getEnv } from "./env";

/**
 * RISK-022: only per-caller (per-IP) rate limits existed on the anonymous
 * audit endpoint — a distributed set of callers (many different IPs) could
 * still direct many small, individually in-bounds scans at one target with
 * nothing detecting the aggregate pattern. This module adds detection-only
 * visibility (Super Admin capacity view), never an auto-block: no code path
 * anywhere reads `target_abuse_observations` to reject a request. See
 * docs/security/TARGET_ABUSE_MONITORING_DESIGN.md.
 *
 * `hashTarget` uses a dedicated `ABUSE_MONITORING_SECRET` — deliberately not
 * `SESSION_SIGNING_SECRET` (which keys `hashIp()`/`caller_key` here) — so a
 * compromise of one key doesn't also expose the other's correlation.
 */
export async function hashTarget(canonicalOrigin: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getEnv().ABUSE_MONITORING_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(canonicalOrigin),
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function recordTargetAbuseObservation(
  db: Database,
  targetKey: string,
  callerKey: string,
): Promise<void> {
  await db.insert(schema.targetAbuseObservations).values({
    targetKey,
    callerKey,
    observedAt: new Date().toISOString(),
  });
}

/** Default detection thresholds — deliberately conservative (flags, never
 * blocks): a target seen by at least 10 distinct HMAC'd callers within an
 * hour is unusual enough for a Super Admin to look at, without being so
 * sensitive that ordinary shared/CDN-fronted or well-known target traffic
 * would routinely trip it. */
export const DEFAULT_ABUSE_DETECTION_WINDOW_MS = 60 * 60 * 1000;
export const DEFAULT_ABUSE_DETECTION_MIN_DISTINCT_CALLERS = 10;

export type HighFrequencyTarget = {
  targetKey: string;
  distinctCallerCount: number;
  observationCount: number;
};

/**
 * Detection query only — returns opaque target keys (never a raw domain;
 * looking one up requires deliberately re-hashing a specific candidate
 * origin and comparing, not a reverse lookup this table supports). A target
 * is flagged when at least `minDistinctCallers` different HMAC'd callers
 * observed it within the window — the exact pattern a single caller's own
 * rate limit cannot see.
 */
export async function getHighFrequencyTargets(
  db: Database,
  options: { windowMs: number; minDistinctCallers: number },
): Promise<HighFrequencyTarget[]> {
  const cutoff = new Date(Date.now() - options.windowMs).toISOString();
  const rows = await db
    .select({
      targetKey: schema.targetAbuseObservations.targetKey,
      distinctCallerCount: sql<number>`count(distinct ${schema.targetAbuseObservations.callerKey})`,
      observationCount: sql<number>`count(*)`,
    })
    .from(schema.targetAbuseObservations)
    .where(gte(schema.targetAbuseObservations.observedAt, cutoff))
    .groupBy(schema.targetAbuseObservations.targetKey)
    .having(
      sql`count(distinct ${schema.targetAbuseObservations.callerKey}) >= ${options.minDistinctCallers}`,
    );
  return rows;
}

/**
 * Routine pruning — this table exists purely for a bounded recent-window
 * detection query, so rows older than any window a caller might reasonably
 * ask for have no further use. Not required for correctness (every real
 * query already filters by `observedAt`), only for bounded table growth.
 */
export async function pruneOldTargetAbuseObservations(
  db: Database,
  olderThanMs: number,
): Promise<void> {
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  await db
    .delete(schema.targetAbuseObservations)
    .where(lt(schema.targetAbuseObservations.observedAt, cutoff));
}
