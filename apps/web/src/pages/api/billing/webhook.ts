import type { APIRoute } from "astro";
import { ApiError, ok } from "@crawlpact/core";
import { createDb } from "@crawlpact/database";
import { getEnv } from "../../../lib/env";
import { hashIp } from "../../../lib/ip-hash";
import { recordSecurityEvent } from "../../../lib/auth/rate-limit";
import { verifyPaddleWebhookSignature } from "../../../lib/billing/paddle-webhook";
import {
  parsePaddleWebhookBody,
  processPaddleWebhookEvent,
} from "../../../lib/billing/webhook-processor";
import { jsonErrorResponse, jsonResponse } from "../../../lib/json-response";

export const prerender = false;

/**
 * POST /api/billing/webhook — Paddle Billing webhook receiver (SRS §27).
 * Signature verification runs against the raw request body — see
 * lib/billing/paddle-webhook.ts's docstring for why that matters. Every
 * outcome that isn't an invalid signature returns 200 (Paddle treats any
 * non-2xx as "please retry"; a duplicate or an event type we don't handle
 * is not a delivery failure, so it must not be retried forever).
 */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    const env = getEnv();
    const db = createDb(env.DB);
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("Paddle-Signature");

    const verification = await verifyPaddleWebhookSignature(
      rawBody,
      signatureHeader,
      env.PADDLE_WEBHOOK_SECRET,
    );
    if (!verification.valid) {
      const ipHash = await hashIp(request);
      await recordSecurityEvent(db, "invalid_paddle_signature", {
        ipHash,
        details: { reason: verification.reason },
      });
      throw new ApiError(
        "BILLING_WEBHOOK_SIGNATURE_INVALID",
        "Webhook signature verification failed.",
      );
    }

    const event = parsePaddleWebhookBody(rawBody);
    if (!event) {
      throw new ApiError("VALIDATION_FAILED", "Malformed webhook payload.");
    }

    const outcome = await processPaddleWebhookEvent(db, event);

    // A duplicate or an unhandled event type is still acknowledged with 200 —
    // only signature failure and malformed payloads above are real errors.
    return jsonResponse(ok({ outcome }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
