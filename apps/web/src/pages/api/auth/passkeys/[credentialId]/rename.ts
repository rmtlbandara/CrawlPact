import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../../../lib/env";
import { renameCredential } from "../../../../../lib/auth/credentials";
import { requireSession } from "../../../../../lib/auth/require-session";
import { jsonErrorResponse, jsonResponse } from "../../../../../lib/json-response";

export const prerender = false;

const renameRequestSchema = z.object({ label: z.string().trim().min(1).max(80) });

/** POST /api/auth/passkeys/:credentialId/rename — "Rename passkeys" (SRS §24). */
export const POST: APIRoute = async ({ request, params }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const credentialId = params.credentialId;
    if (!credentialId) throw new ApiError("VALIDATION_FAILED", "Missing passkey id.");

    const body = await request.json().catch(() => {
      throw new ApiError("VALIDATION_FAILED", "Request body must be valid JSON.");
    });
    const parsed = renameRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("VALIDATION_FAILED", "Enter a label.", { issues: parsed.error.issues });
    }

    const renamed = await renameCredential(db, user.id, credentialId, parsed.data.label);
    if (!renamed) throw new ApiError("NOT_FOUND", "This passkey does not exist.");

    return jsonResponse(ok({ renamed: true }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
