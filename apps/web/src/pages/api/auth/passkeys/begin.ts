import type { APIRoute } from "astro";
import { ApiError, beginRegistrationRequestSchema, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { listActiveCredentials } from "../../../../lib/auth/credentials";
import { requireSession } from "../../../../lib/auth/require-session";
import { beginPasskeyRegistration } from "../../../../lib/auth/webauthn";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

/**
 * POST /api/auth/passkeys/begin — "Add additional passkeys" (SRS §24) for
 * an already-signed-in account. Unlike register/begin.ts, `displayName`
 * here is the label for the new device (e.g. "Work laptop"), not the
 * account's name — the account's real display name (already chosen at
 * signup) is what's shown in the browser's own passkey picker.
 */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const body = await request.json().catch(() => {
      throw new ApiError("VALIDATION_FAILED", "Request body must be valid JSON.");
    });
    const parsed = beginRegistrationRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("VALIDATION_FAILED", "Enter a label for this passkey.", {
        issues: parsed.error.issues,
      });
    }

    const existing = await listActiveCredentials(db, user.id);
    const { challengeToken, options } = await beginPasskeyRegistration(
      user.displayName,
      existing.map((row) => ({ credentialId: row.credentialId })),
      parsed.data.displayName,
    );

    return jsonResponse(
      ok({ challengeId: challengeToken, publicKeyCredentialCreationOptions: options }, requestId),
      200,
    );
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
