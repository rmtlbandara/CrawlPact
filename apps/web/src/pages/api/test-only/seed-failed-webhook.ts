import type { APIRoute } from "astro";
import { ok } from "@crawlpact/core";
import { createDb, schema } from "@crawlpact/database";
import { getEnv } from "../../../lib/env";
import { assertTestOnlyAccess } from "../../../lib/test-only";
import { jsonErrorResponse, jsonResponse } from "../../../lib/json-response";

export const prerender = false;

/**
 * e2e-only: seeds a `failed` webhook event so admin-flows.spec.ts's webhook
 * retry test has something real and eligible to retry, without waiting for
 * a genuine Paddle delivery to fail.
 */
export const POST: APIRoute = async ({ request }) => {
  const requestId = crypto.randomUUID();
  try {
    assertTestOnlyAccess(request);
    const db = createDb(getEnv().DB);
    const now = new Date().toISOString();
    const eventId = crypto.randomUUID();

    await db.insert(schema.webhookEvents).values({
      id: crypto.randomUUID(),
      paddleEventId: `evt_e2e_${eventId}`,
      eventType: "transaction.completed",
      status: "failed",
      payloadRedacted: "{}",
      error: "Simulated failure seeded for e2e retry test",
      attempts: 1,
      receivedAt: now,
      occurredAt: now,
    });

    return jsonResponse(ok({ seeded: true }, requestId), 200);
  } catch (error) {
    return jsonErrorResponse(error, requestId);
  }
};
