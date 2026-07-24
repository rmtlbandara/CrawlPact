import type { APIRoute } from "astro";
import { ok, recoveryCodeIssueResponseSchema } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../lib/env";
import { generateRecoveryCodes } from "../../../../lib/auth/recovery-codes";
import { requireRecentAuthentication, requireSession } from "../../../../lib/auth/require-session";
import { jsonErrorResponse, jsonResponse } from "../../../../lib/json-response";

export const prerender = false;

/**
 * POST /api/auth/recovery-codes/generate — "Generate/regenerate recovery
 * codes" (SRS §24). Codes are returned once, in plaintext, in this
 * response only; only their SHA-256 hashes are ever persisted. Sensitive
 * action, so it requires recent re-authentication.
 */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { session, user } = await requireSession(request, db);
    requireRecentAuthentication(session);

    const codes = await generateRecoveryCodes(db, user.id);

    return jsonResponse(
      ok(
        recoveryCodeIssueResponseSchema.parse({ codes, issuedAt: new Date().toISOString() }),
        requestId,
      ),
      200,
    );
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
