import type { APIRoute } from "astro";
import { z } from "zod";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../lib/env";
import { getSessionAndUser, readSessionToken } from "../../../lib/auth/session";
import { isProductEventName, trackEvent } from "../../../lib/analytics";
import { jsonErrorResponse, jsonResponse } from "../../../lib/json-response";

export const prerender = false;

const trackRequestSchema = z.object({
  eventName: z.string(),
  properties: z
    .record(z.string(), z.union([z.string().max(200), z.number(), z.boolean()]))
    .optional(),
});

/**
 * POST /api/analytics/track — client-side beacon for page-view-style
 * events (landing/pricing/result viewed, account creation started) that
 * have no natural server-side mutation to hang tracking off of. Never
 * accepts an arbitrary event name (see PRODUCT_EVENT_NAMES) and never
 * accepts nested/oversized property values — this is aggregate product
 * analytics, not a general-purpose logging sink.
 */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);

    const body = await request.json().catch(() => {
      throw new ApiError("VALIDATION_FAILED", "Request body must be valid JSON.");
    });
    const parsed = trackRequestSchema.safeParse(body);
    if (!parsed.success || !isProductEventName(parsed.data.eventName)) {
      throw new ApiError("VALIDATION_FAILED", "Unrecognised event.");
    }

    const token = readSessionToken(request);
    const session = token ? await getSessionAndUser(db, token) : null;

    await trackEvent(db, parsed.data.eventName, {
      userId: session?.user.id ?? null,
      properties: parsed.data.properties,
    });

    return jsonResponse(ok({ tracked: true }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
