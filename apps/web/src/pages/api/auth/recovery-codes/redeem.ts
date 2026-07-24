import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { isRateLimited, recordSecurityEvent } from "../../../../lib/auth/rate-limit";
import { redeemRecoveryCode } from "../../../../lib/auth/recovery-codes";
import { buildSessionCookie, createSession } from "../../../../lib/auth/session";
import { hashIp } from "../../../../lib/ip-hash";
import { jsonErrorResponse, jsonResponseWithCookie } from "../../../../lib/json-response";

export const prerender = false;

const redeemRequestSchema = z.object({ code: z.string().trim().min(1).max(64) });

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

/**
 * POST /api/auth/recovery-codes/redeem — signs in with a one-time recovery
 * code when a passkey is unavailable (SRS §24). Codes are looked up
 * globally by hash (not per-user) since there is no username/email to
 * scope the lookup to in this passkey-only design — see recovery-codes.ts.
 * Brute-force guarded by a D1-backed per-IP rate limit, logged to
 * `security_events` either way.
 */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const ipHash = await hashIp(request);

    if (
      ipHash &&
      (await isRateLimited(db, "recovery_code_failure", ipHash, {
        max: RATE_LIMIT_MAX_ATTEMPTS,
        windowMs: RATE_LIMIT_WINDOW_MS,
      }))
    ) {
      throw new ApiError(
        "RATE_LIMITED",
        "Too many recovery code attempts. Please try again later.",
      );
    }

    const body = await request.json().catch(() => {
      throw new ApiError("VALIDATION_FAILED", "Request body must be valid JSON.");
    });
    const parsed = redeemRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("VALIDATION_FAILED", "Enter a recovery code.", {
        issues: parsed.error.issues,
      });
    }

    const result = await redeemRecoveryCode(db, parsed.data.code);
    if (!result.ok) {
      await recordSecurityEvent(db, "recovery_code_failure", { ipHash });
      throw new ApiError(
        "AUTH_RECOVERY_CODE_INVALID",
        "This recovery code is invalid or already used.",
      );
    }

    const { token, expiresAt } = await createSession(db, result.userId, {
      userAgent: request.headers.get("user-agent"),
      ipHash,
    });

    return jsonResponseWithCookie(
      ok({ signedIn: true }, requestId),
      200,
      buildSessionCookie(token, expiresAt),
    );
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
