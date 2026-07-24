import type { APIRoute } from "astro";
import { ApiError, beginRegistrationRequestSchema, ok } from "@crawlpact/core";
import { beginPasskeyRegistration } from "../../../../lib/auth/webauthn";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

/**
 * POST /api/auth/register/begin — step 1 of account creation (SRS §24,
 * "User creates an account with a passkey"). Deliberately does not touch
 * the database or create a user row yet: the account only comes into
 * existence once register/finish.ts verifies a real WebAuthn ceremony
 * completed, so an abandoned registration attempt never leaves an orphan
 * user behind.
 */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const body = await request.json().catch(() => {
      throw new ApiError("VALIDATION_FAILED", "Request body must be valid JSON.");
    });
    const parsed = beginRegistrationRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("VALIDATION_FAILED", "Enter a display name.", {
        issues: parsed.error.issues,
      });
    }

    const { challengeToken, options } = await beginPasskeyRegistration(parsed.data.displayName, []);

    return jsonResponse(
      ok({ challengeId: challengeToken, publicKeyCredentialCreationOptions: options }, requestId),
      200,
    );
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
