import type { APIRoute } from "astro";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { ApiError, finishRegistrationRequestSchema, ok } from "@crawlpact/core";
import { createDb, schema } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { insertCredential } from "../../../../lib/auth/credentials";
import { generateRecoveryCodes } from "../../../../lib/auth/recovery-codes";
import { buildSessionCookie, createSession } from "../../../../lib/auth/session";
import { finishPasskeyRegistration } from "../../../../lib/auth/webauthn";
import { trackEvent } from "../../../../lib/analytics";
import { jsonErrorResponse, jsonResponseWithCookie } from "../../../../lib/json-response";

export const prerender = false;

/**
 * POST /api/auth/register/finish — step 2 of account creation. Only here,
 * once `verifyRegistrationResponse` has actually verified a real
 * authenticator ceremony, does a `users` row get created (see begin.ts for
 * why this ordering matters: no orphan accounts from abandoned attempts).
 * Also issues the one-time recovery-code set immediately, matching the SRS
 * §10.38 onboarding order (register passkey, then save recovery codes).
 */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const body = await request.json().catch(() => {
      throw new ApiError("VALIDATION_FAILED", "Request body must be valid JSON.");
    });
    const parsed = finishRegistrationRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("VALIDATION_FAILED", "Malformed registration response.", {
        issues: parsed.error.issues,
      });
    }

    const outcome = await finishPasskeyRegistration(
      parsed.data.challengeId,
      parsed.data.credential as unknown as RegistrationResponseJSON,
    );
    if (!outcome.ok) {
      throw new ApiError(
        "AUTH_CHALLENGE_EXPIRED",
        outcome.reason === "challenge_invalid"
          ? "This registration attempt has expired. Please try again."
          : "The passkey could not be verified.",
      );
    }

    const db = createDb(getEnv().DB);
    const now = new Date().toISOString();
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({
      id: userId,
      displayName: outcome.displayName,
      status: "active",
      planId: "free",
      isAdmin: false,
      createdAt: now,
      updatedAt: now,
    });
    await insertCredential(db, userId, outcome.label, outcome.credential);
    const recoveryCodes = await generateRecoveryCodes(db, userId);
    const { token, expiresAt } = await createSession(db, userId, {
      userAgent: request.headers.get("user-agent"),
    });
    await trackEvent(db, "account_created", { userId });

    return jsonResponseWithCookie(
      ok({ user: { id: userId, displayName: outcome.displayName }, recoveryCodes }, requestId),
      200,
      buildSessionCookie(token, expiresAt),
    );
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
