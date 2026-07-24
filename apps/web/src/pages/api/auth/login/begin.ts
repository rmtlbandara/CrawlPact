import type { APIRoute } from "astro";
import { ok } from "@crawlpact/core";
import { beginPasskeyAuthentication } from "../../../../lib/auth/webauthn";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

/**
 * POST /api/auth/login/begin — usernameless passkey sign-in (SRS §24: no
 * password/email). No `allowCredentials` is set, so the browser prompts
 * with every discoverable (resident-key) credential registered for this
 * origin; login/finish.ts identifies the account from the credential ID the
 * browser returns, not from anything the caller supplies here.
 */
export const POST: APIRoute = async () => {
  const requestId = crypto.randomUUID();
  try {
    const { challengeToken, options } = await beginPasskeyAuthentication();
    return jsonResponse(
      ok({ challengeId: challengeToken, publicKeyCredentialRequestOptions: options }, requestId),
      200,
    );
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
