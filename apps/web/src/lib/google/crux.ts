import { fetchGoogleJson } from "./http";
import type { GoogleReadResult } from "./http";

/**
 * Read-only Chrome UX Report (CrUX) client (Step 6). Authenticates with a
 * dedicated, API-restricted API key (`CRUX_API_KEY`) rather than an OAuth
 * token — CrUX's `records:queryRecord` endpoint takes the key as a `?key=`
 * query parameter. That URL is never included in anything this module
 * returns, throws, or would let a caller log.
 *
 * CrawlPact may not yet meet Chrome UX Report's minimum traffic threshold
 * for its origin. Google's documented response for that case is a 404
 * `NOT_FOUND`, mapped here to `{ status: "no_data" }` — but a 200 response
 * whose body carries no usable record (no `record` field, or a `metrics`
 * object with none of the three requested metrics present) is treated the
 * same way, rather than assuming 404 is the only shape a legitimate
 * no-data response can take. Either way this is never treated as an
 * authentication failure or a broken integration.
 */

const CRUX_METRICS = [
  "largest_contentful_paint",
  "interaction_to_next_paint",
  "cumulative_layout_shift",
] as const;

export type CruxMetricSummary = {
  p75: string | null;
};

export type CruxReport = {
  metrics: {
    largestContentfulPaint: CruxMetricSummary | null;
    interactionToNextPaint: CruxMetricSummary | null;
    cumulativeLayoutShift: CruxMetricSummary | null;
  };
};

export type CruxQueryParams = {
  apiKey: string;
  origin: string;
};

function extractPercentileP75(metric: unknown): CruxMetricSummary | null {
  if (typeof metric !== "object" || metric === null) return null;
  const record = metric as Record<string, unknown>;
  const percentiles = record.percentiles;
  if (typeof percentiles !== "object" || percentiles === null) return null;
  const p75 = (percentiles as Record<string, unknown>).p75;
  return { p75: typeof p75 === "string" || typeof p75 === "number" ? String(p75) : null };
}

/**
 * Queries CrUX for origin-level Core Web Vitals. Never logs `params.apiKey`
 * or the constructed request URL (which embeds it) — only this function
 * constructs that URL, and it stays local to this call.
 */
export async function queryCrux(params: CruxQueryParams): Promise<GoogleReadResult<CruxReport>> {
  const url = `https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${encodeURIComponent(params.apiKey)}`;

  const result = await fetchGoogleJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin: params.origin,
      metrics: [...CRUX_METRICS],
    }),
  });
  if (!result.ok) {
    // A 404 is CrUX's documented "no data for this origin" response —
    // distinct from every other failure the shared classifier produces.
    if (result.httpStatus === 404) return { status: "no_data" };
    return { status: result.status };
  }

  const record = result.body as Record<string, unknown>;
  const recordField = record.record;
  const metrics =
    typeof recordField === "object" && recordField !== null
      ? ((recordField as Record<string, unknown>).metrics as Record<string, unknown> | undefined)
      : undefined;

  // A 200 response is only a real success if at least one of the three
  // requested metrics actually came back. A response with no `record` at
  // all, or a `record` whose `metrics` object is empty, is a legitimate
  // no-data outcome expressed a different way than the documented 404 —
  // never fabricate an "ok" result with every metric null.
  const hasAnyMetric = Boolean(
    metrics &&
    (metrics.largest_contentful_paint ||
      metrics.interaction_to_next_paint ||
      metrics.cumulative_layout_shift),
  );
  if (!hasAnyMetric) {
    return { status: "no_data" };
  }

  return {
    status: "ok",
    data: {
      metrics: {
        largestContentfulPaint: extractPercentileP75(metrics?.largest_contentful_paint),
        interactionToNextPaint: extractPercentileP75(metrics?.interaction_to_next_paint),
        cumulativeLayoutShift: extractPercentileP75(metrics?.cumulative_layout_shift),
      },
    },
  };
}
