import type { APIRoute } from "astro";
import { and, eq, isNull } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import { ApiError, feedTokenIssueResponseSchema, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../lib/env";
import { requireSession } from "../../../lib/auth/require-session";
import { generateFeedToken, revokeFeedTokens } from "../../../lib/notifications";
import { getPlan } from "../../../lib/plan";
import { trackEvent } from "../../../lib/analytics";
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
      await trackEvent(db, "atom_feed_entitlement_blocked", { userId: user.id });
      throw new ApiError(
        "FORBIDDEN",
        "The private Atom feed is not available on your current plan.",
      );
    }

    // Categorical only, for the create-vs-regenerate analytics distinction —
    // no token value or id is read or sent anywhere.
    const [existingActiveToken] = await db
      .select({ id: schema.feedTokens.id })
      .from(schema.feedTokens)
      .where(and(eq(schema.feedTokens.userId, user.id), isNull(schema.feedTokens.revokedAt)))
      .limit(1);

    const token = await generateFeedToken(db, user.id);
    const feedUrl = new URL(`/feed/${token}.xml`, getEnv().PUBLIC_SITE_URL).toString();
    await trackEvent(db, existingActiveToken ? "atom_feed_regenerated" : "atom_feed_created", {
      userId: user.id,
    });

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
    await trackEvent(db, "atom_feed_revoked", { userId: user.id });
    return jsonResponse(ok({ revoked: true }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
