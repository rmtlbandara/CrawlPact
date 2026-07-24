import type { APIRoute } from "astro";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { ApiError, finishRegistrationRequestSchema, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { insertCredential } from "../../../../lib/auth/credentials";
import { requireSession } from "../../../../lib/auth/require-session";
import { finishPasskeyRegistration } from "../../../../lib/auth/webauthn";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

/** POST /api/auth/passkeys/finish — attaches the newly verified credential to the caller's own account. */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

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
          ? "This attempt has expired. Please try again."
          : "The passkey could not be verified.",
      );
    }

    await insertCredential(db, user.id, outcome.label, outcome.credential);
    return jsonResponse(ok({ added: true, label: outcome.label }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
