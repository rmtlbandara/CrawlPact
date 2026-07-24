import type { APIRoute } from "astro";
import { ApiError, feedTokenIssueResponseSchema, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../lib/env";
import { requireSession } from "../../../lib/auth/require-session";
import { generateFeedToken, revokeFeedTokens } from "../../../lib/notifications";
import { getPlan } from "../../../lib/plan";
import { jsonErrorResponse, jsonResponse } from "../../../lib/json-response";

export const prerender = false;

/** POST /api/notifications/feed-token — issues (or reissues) the caller's private Atom feed URL; requires the plan's `privateAtomFeedEnabled` entitlement. */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const plan = await getPlan(db, user.planId);
    if (!plan.privateAtomFeedEnabled) {
      throw new ApiError(
        "FORBIDDEN",
        "The private Atom feed is not available on your current plan.",
      );
    }

    const token = await generateFeedToken(db, user.id);
    const feedUrl = new URL(`/feed/${token}.xml`, getEnv().PUBLIC_SITE_URL).toString();

    return jsonResponse(ok(feedTokenIssueResponseSchema.parse({ token, feedUrl }), requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};

/** DELETE /api/notifications/feed-token — revokes the caller's private feed URL without issuing a new one. */
export const DELETE: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);
    await revokeFeedTokens(db, user.id);
    return jsonResponse(ok({ revoked: true }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
