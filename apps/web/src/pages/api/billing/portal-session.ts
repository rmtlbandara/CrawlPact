import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { ApiError, ok } from "@crawlpact/core";
import { createDb, schema } from "@crawlpact/database";
import { getEnv } from "../../../lib/env";
import { requireSession } from "../../../lib/auth/require-session";
import { createCustomerPortalSession } from "../../../lib/billing/paddle-api";
import { jsonErrorResponse, jsonResponse } from "../../../lib/json-response";

export const prerender = false;

/**
 * POST /api/billing/portal-session — a Paddle-hosted customer portal URL
 * for managing payment methods/invoices/cancellation (SRS §10.40: "The
 * user shall be directed to Paddle's portal for supported billing
 * actions"). Calls Paddle's real API — see lib/billing/paddle-api.ts for
 * why that call is unverified in this environment.
 */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const db = createDb(getEnv().DB);
    const { user } = await requireSession(request, db);

    const [billingCustomer] = await db
      .select()
      .from(schema.billingCustomers)
      .where(eq(schema.billingCustomers.userId, user.id))
      .limit(1);
    if (!billingCustomer) {
      throw new ApiError("NOT_FOUND", "No billing account exists yet — subscribe to a plan first.");
    }

    const env = getEnv();
    const result = await createCustomerPortalSession(
      { PADDLE_API_KEY: env.PADDLE_API_KEY, PADDLE_ENVIRONMENT: env.PADDLE_ENVIRONMENT },
      billingCustomer.paddleCustomerId,
    );

    if (!result.ok) {
      throw new ApiError(
        "SERVICE_UNAVAILABLE",
        "The billing portal is temporarily unavailable. Please try again shortly.",
      );
    }

    return jsonResponse(ok({ url: result.url }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
