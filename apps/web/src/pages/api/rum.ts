import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../lib/env";
import { classifyRequestOrigin } from "../../lib/origin";
import { hashIp } from "../../lib/ip-hash";
import { isRateLimited, recordSecurityEvent } from "../../lib/auth/rate-limit";
import { RUM_METRIC_NAMES, RUM_RATINGS, recordRumMetrics } from "../../lib/rum";
import { jsonErrorResponse, jsonResponse } from "../../lib/json-response";

export const prerender = false;

const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_SCOPE = "rum";

const rumRequestSchema = z.object({
  route: z.string().max(500),
  device: z.enum(["mobile", "desktop"]),
  metrics: z
    .array(
      z.object({
        name: z.enum(RUM_METRIC_NAMES),
        value: z.number(),
        rating: z.enum(RUM_RATINGS).optional(),
      }),
    )
    .min(1)
    .max(RUM_METRIC_NAMES.length),
});

/**
 * POST /api/rum — anonymous Core Web Vitals beacon (Phase 1 Workstream 3).
 * `SHARED_SAME_ORIGIN_SURFACE` (route-ownership.ts): reachable from both the
 * public marketing host and the authenticated app host, same as
 * `/api/analytics/track`. Surface (`public`/`app`) is derived server-side
 * from the request's Host header, never trusted from the client body.
 *
 * Rate-limited via the existing `security_events`-backed sliding window
 * (same mechanism as `/api/domains/export.csv.ts` etc.) — the abuse-
 * prevention signal lives there deliberately, so the actual vitals data in
 * `rum_vitals` never needs to carry an IP hash at all (see lib/rum.ts).
 */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);

    const ipHash = await hashIp(request);
    if (ipHash) {
      const limited = await isRateLimited(db, "rate_limit", ipHash, {
        max: RATE_LIMIT_MAX,
        windowMs: RATE_LIMIT_WINDOW_MS,
        scope: RATE_LIMIT_SCOPE,
      });
      if (limited) throw new ApiError("RATE_LIMITED", "Too many RUM beacons — try again later.");
    }

    const body = await request.json().catch(() => {
      throw new ApiError("VALIDATION_FAILED", "Request body must be valid JSON.");
    });
    const parsed = rumRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("VALIDATION_FAILED", "Malformed RUM payload.");
    }

    const surface = classifyRequestOrigin(request) === "app" ? "app" : "public";
    const written = await recordRumMetrics(db, {
      route: parsed.data.route,
      surface,
      deviceCategory: parsed.data.device,
      metrics: parsed.data.metrics,
    });

    if (ipHash) {
      await recordSecurityEvent(db, "rate_limit", { ipHash, target: RATE_LIMIT_SCOPE });
    }

    return jsonResponse(ok({ recorded: written }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
