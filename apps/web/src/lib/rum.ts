import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";

/**
 * Phase 1 Workstream 3: first-party Real User Monitoring for Core Web
 * Vitals — the interim field-performance source while CrUX reports
 * NO_DATA (this origin is below its eligibility threshold, per
 * `../lib/google/crux.ts`'s own doc comment). Deliberately separate from
 * `product_events`/GA4: this is anonymous, high-frequency, non-authoritative
 * telemetry, never product/commercial truth.
 *
 * Privacy: never accepts or stores a raw pathname, IP address, user id, or
 * session id. `normalizeRumRoute` collapses every route into one of a small,
 * fixed set of buckets so cardinality stays bounded and no dynamic
 * slug/query value (which could carry a token, email fragment, or other
 * sensitive value pasted into a URL) ever reaches storage.
 */

export const RUM_METRIC_NAMES = ["LCP", "INP", "CLS", "FCP", "TTFB"] as const;
export type RumMetricName = (typeof RUM_METRIC_NAMES)[number];

export const RUM_RATINGS = ["good", "needs-improvement", "poor"] as const;
export type RumRating = (typeof RUM_RATINGS)[number];

export type RumDeviceCategory = "mobile" | "desktop";
export type RumSurface = "public" | "app";

/** Sane upper bounds per metric, in the metric's own unit (ms, or a unitless
 * ratio for CLS). Anything beyond this is treated as an impossible/malformed
 * value and dropped rather than stored — never trust a browser-supplied
 * number blindly (directive §11). Generous on purpose: this rejects garbage,
 * not merely "slow" real experiences. */
const METRIC_MAX_VALUE: Record<RumMetricName, number> = {
  LCP: 60_000,
  INP: 60_000,
  FCP: 60_000,
  TTFB: 60_000,
  CLS: 100,
};

export function isValidMetricValue(name: RumMetricName, value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= METRIC_MAX_VALUE[name];
}

/** Route templates this function recognizes, checked longest-prefix-first
 * implicitly by iteration order. A dynamic segment (crawler/guide/platform/
 * vertical slug) collapses to its template, e.g. `/crawlers/gptbot/` ->
 * `/crawlers/:slug/` — enough to distinguish page *kinds* for a performance
 * baseline without an unbounded number of distinct route values. */
const ROUTE_BUCKETS: Array<{ prefix: string; bucket: string }> = [
  { prefix: "/crawlers/", bucket: "/crawlers/:slug/" },
  { prefix: "/guides/", bucket: "/guides/:slug/" },
  { prefix: "/platforms/", bucket: "/platforms/:slug/" },
  { prefix: "/for/", bucket: "/for/:slug/" },
  { prefix: "/tools/", bucket: "/tools/:slug/" },
  { prefix: "/observatory/", bucket: "/observatory/:slug/" },
  { prefix: "/audit/", bucket: "/audit/:id/" },
  { prefix: "/shared/", bucket: "/shared/:token/" },
];

const EXACT_ROUTES = new Set([
  "/",
  "/pricing/",
  "/sample-report/",
  "/crawlers/",
  "/tools/",
  "/guides/",
  "/platforms/",
  "/observatory/",
  "/methodology/",
  "/scoring/",
  "/security/",
  "/status/",
  "/changelog/",
  "/about/",
  "/contact/",
  "/sign-in",
  "/app",
  "/app-shell",
  "/admin",
  "/admin/growth",
]);

/**
 * Normalizes a client-reported pathname into a bounded route bucket. Strips
 * any query string/fragment first (defence in depth — the client is never
 * supposed to send one), and falls back to `"other"` for anything not
 * explicitly recognized, rather than ever storing an arbitrary raw value.
 */
export function normalizeRumRoute(rawPath: string): string {
  const path = rawPath.split("?")[0]?.split("#")[0] ?? "";
  if (EXACT_ROUTES.has(path)) return path;
  for (const { prefix, bucket } of ROUTE_BUCKETS) {
    if (path.startsWith(prefix)) return bucket;
  }
  if (path.startsWith("/app/")) return "/app/:section/";
  if (path.startsWith("/admin/")) return "/admin/:section/";
  return "other";
}

export type RumMetricInput = {
  name: RumMetricName;
  value: number;
  rating?: RumRating;
};

export type RecordRumMetricsParams = {
  route: string;
  surface: RumSurface;
  deviceCategory: RumDeviceCategory;
  metrics: RumMetricInput[];
};

/** Inserts one row per valid metric; an individual malformed metric in a
 * batch is silently dropped rather than failing the whole request (a
 * partially-useful beacon is still useful). Returns the count actually
 * written, for the endpoint to report back. */
export async function recordRumMetrics(
  db: Database,
  params: RecordRumMetricsParams,
): Promise<number> {
  const route = normalizeRumRoute(params.route);
  const now = new Date().toISOString();

  const rows = params.metrics
    .filter((m) => RUM_METRIC_NAMES.includes(m.name) && isValidMetricValue(m.name, m.value))
    .slice(0, RUM_METRIC_NAMES.length) // never more than one of each kind's worth of rows per beacon
    .map((m) => ({
      metricName: m.name,
      metricValue: m.value,
      rating: m.rating && RUM_RATINGS.includes(m.rating) ? m.rating : null,
      route,
      surface: params.surface,
      deviceCategory: params.deviceCategory,
      recordedAt: now,
    }));

  if (rows.length === 0) return 0;
  await db.insert(schema.rumVitals).values(rows);
  return rows.length;
}
