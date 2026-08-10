import { ApiError, fail } from "@crawlpact/core";
import { getEnv } from "./env";

export function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonResponseWithCookie(
  payload: unknown,
  status: number,
  setCookie: string,
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Set-Cookie": setCookie },
  });
}

/**
 * Maps a thrown ApiError to the standard failure envelope; anything else is
 * an internal error. Phase 13: the raw exception message is only included
 * in `details` outside production — in production it could otherwise leak
 * driver/library-generated text (e.g. D1/SQLite error strings) to the
 * client on every one of the 100+ routes that call this helper. See
 * docs/security/PHASE_13_REPOSITORY_SOURCE_EXPOSURE_THREAT_REVIEW.md
 * "Internal path/error leakage".
 */
export function jsonErrorResponse(error: unknown, requestId: string): Response {
  if (error instanceof ApiError) {
    return jsonResponse(fail(error, requestId), error.httpStatus);
  }
  const isProduction = getEnv().PUBLIC_APP_ENV === "production";
  return jsonResponse(
    fail(
      new ApiError(
        "INTERNAL_ERROR",
        "Something went wrong.",
        isProduction
          ? undefined
          : { message: error instanceof Error ? error.message : String(error) },
      ),
      requestId,
    ),
    500,
  );
}
