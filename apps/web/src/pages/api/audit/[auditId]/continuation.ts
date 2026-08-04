import type { APIRoute } from "astro";
import { ApiError, createAuditContinuationRequestSchema, fail, ok } from "@crawlpact/core";
import { createDb, schema } from "@crawlpact/database";
import { eq } from "drizzle-orm";
import { getEnv } from "../../../../lib/env";
import { createContinuation } from "../../../../lib/audit-continuation";
import { trackEvent } from "../../../../lib/analytics";
import { getIntConfig } from "../../../../lib/runtime-config";
import { hashIp } from "../../../../lib/ip-hash";
import { isRateLimited, recordSecurityEvent } from "../../../../lib/auth/rate-limit";

export const prerender = false;

/**
 * POST /api/audit/:auditId/continuation — Phase 5 (Anonymous Audit Result and
 * Account-Conversion Flow). Creates the opaque, expiring, single-use record a
 * "Save and monitor this domain" / "Save without monitoring" click carries
 * through sign-in — see docs/security/PHASE_05_AUDIT_CONVERSION_THREAT_REVIEW.md.
 *
 * Reachable without a session (the whole point — the CTA appears on a public,
 * anonymous report), and it performs a real DB write, so it is rate-limited by
 * IP the same way POST /api/audit itself is, using its own scope so the two
 * counters never share a budget.
 */
export const POST: APIRoute = async ({ params, request }) => {
  const requestId = crypto.randomUUID();
  const auditId = params.auditId;

  if (!auditId) {
    return jsonResponse(
      fail(new ApiError("VALIDATION_FAILED", "Missing audit id."), requestId),
      400,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      fail(new ApiError("VALIDATION_FAILED", "Request body must be valid JSON."), requestId),
      400,
    );
  }

  const parsed = createAuditContinuationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      fail(
        new ApiError("VALIDATION_FAILED", "A valid intended action is required.", {
          issues: parsed.error.issues,
        }),
        requestId,
      ),
      400,
    );
  }

  try {
    const db = createDb(getEnv().DB);

    const ipHash = await hashIp(request);
    if (ipHash) {
      const dailyLimit = await getIntConfig(db, "audit_continuation_daily_limit", 40);
      const limited = await isRateLimited(db, "rate_limit", ipHash, {
        max: dailyLimit,
        windowMs: 24 * 60 * 60 * 1000,
        scope: "audit_continuation",
      });
      if (limited) {
        return jsonResponse(
          fail(
            new ApiError("RATE_LIMITED", "Too many requests from this network. Try again later."),
            requestId,
          ),
          429,
        );
      }
      await recordSecurityEvent(db, "rate_limit", { ipHash, target: "audit_continuation" });
    }

    const [scan] = await db
      .select()
      .from(schema.scans)
      .where(eq(schema.scans.id, auditId))
      .limit(1);
    if (!scan) {
      return jsonResponse(
        fail(new ApiError("AUDIT_NOT_FOUND", "This audit does not exist."), requestId),
        404,
      );
    }

    const eligible = scan.status === "completed" || scan.status === "completed_with_warnings";
    if (!eligible) {
      return jsonResponse(
        fail(
          new ApiError(
            "VALIDATION_FAILED",
            "This audit cannot be saved yet — it did not complete successfully.",
          ),
          requestId,
        ),
        400,
      );
    }

    const continuation = await createContinuation(db, {
      scanId: scan.id,
      canonicalOrigin: scan.canonicalOrigin,
      intendedAction: parsed.data.intendedAction,
    });

    await trackEvent(db, "anonymous_conversion_cta_clicked", {
      properties: { intendedAction: parsed.data.intendedAction },
    });

    return jsonResponse(
      ok({ continuationId: continuation.id, expiresAt: continuation.expiresAt }, requestId),
      201,
    );
  } catch (error) {
    return jsonResponse(
      fail(
        new ApiError("INTERNAL_ERROR", "The continuation could not be created.", {
          message: error instanceof Error ? error.message : String(error),
        }),
        requestId,
      ),
      500,
    );
  }
};

function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
