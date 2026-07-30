import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { ApiError, ok } from "@crawlpact/core";
import { createDb, schema } from "@crawlpact/database";
import { getEnv } from "../../../lib/env";
import { assertTestOnlyAccess } from "../../../lib/test-only";
import { jsonErrorResponse, jsonResponse } from "../../../lib/json-response";

export const prerender = false;

const RATE_LIMIT_EVENT_TYPES = {
  anonymous_audit: "rate_limit",
  recovery_code: "recovery_code_failure",
} as const;

type RateLimitKind = keyof typeof RATE_LIMIT_EVENT_TYPES;

/**
 * e2e-only: clears a `security_events` rate-limit counter so a repeated
 * local/CI run doesn't trip the real, correctly-working lockout instead of
 * reaching the behaviour under test. Not user-scoped (these counters are
 * keyed by IP hash, not account), so no session is required beyond the
 * shared api/test-only gate.
 */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    assertTestOnlyAccess(request);
    const body = (await request.json().catch(() => null)) as { kind?: string } | null;
    const kind = body?.kind as RateLimitKind | undefined;
    if (!kind || !(kind in RATE_LIMIT_EVENT_TYPES)) {
      throw new ApiError(
        "VALIDATION_FAILED",
        "kind must be one of: anonymous_audit, recovery_code.",
      );
    }

    const db = createDb(getEnv().DB);
    await db
      .delete(schema.securityEvents)
      .where(eq(schema.securityEvents.eventType, RATE_LIMIT_EVENT_TYPES[kind]));

    return jsonResponse(ok({ cleared: kind }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
