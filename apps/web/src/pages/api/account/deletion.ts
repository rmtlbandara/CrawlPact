import type { APIRoute } from "astro";
import { ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../lib/env";
import { cancelAccountDeletion, requestAccountDeletion } from "../../../lib/account";
import { requireRecentAuthentication, requireSession } from "../../../lib/auth/require-session";
import { jsonErrorResponse, jsonResponse } from "../../../lib/json-response";

export const prerender = false;

/**
 * POST /api/account/deletion — "Delete the account" (SRS §24). A sensitive
 * action: requires recent re-authentication. Soft-deletes (status becomes
 * `pending_deletion`) — see lib/account.ts for why sessions are left
 * intact. The actual data purge after the grace period
 * (`ACCOUNT_DELETION_GRACE_PERIOD_DAYS`) is a Step 19 data-retention job,
 * not this endpoint.
 */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { session, user } = await requireSession(request, db);
    requireRecentAuthentication(session);

    await requestAccountDeletion(db, user.id);
    return jsonResponse(ok({ deletionRequested: true }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};

/** DELETE /api/account/deletion — cancels a pending deletion request while still within the grace period. */
export const DELETE: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    await cancelAccountDeletion(db, user.id);
    return jsonResponse(ok({ deletionCancelled: true }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
