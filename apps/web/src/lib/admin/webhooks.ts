import { desc, eq } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { processPaddleWebhookEvent } from "../billing/webhook-processor";
import type { ParsedPaddleEvent, ProcessOutcome } from "../billing/webhook-processor";
import type { PriceIdMap } from "../billing/plan-mapping";

export type WebhookEventFilters = { status?: string };

/** SRS §28.7: webhook operations view. */
export async function listWebhookEvents(db: Database, filters: WebhookEventFilters = {}) {
  const rows = await db
    .select()
    .from(schema.webhookEvents)
    .orderBy(desc(schema.webhookEvents.receivedAt))
    .limit(200);
  return filters.status ? rows.filter((r) => r.status === filters.status) : rows;
}

const ELIGIBLE_RETRY_STATUSES = new Set(["failed", "retrying"]);

export type RetryResult = { ok: true; outcome: ProcessOutcome } | { ok: false; reason: string };

/**
 * SRS §28.7 "safe retry, remains idempotent". Re-runs the exact same
 * `processPaddleWebhookEvent` idempotency-checked path a live webhook
 * delivery would take — never a bespoke "just mark it processed" shortcut,
 * so a retry can never fabricate success.
 *
 * Known, disclosed limitation: `custom_data` is stripped from
 * `payload_redacted` at storage time (data minimisation). For the rare case
 * of a brand-new customer's very first subscription webhook failing before
 * any local billing-customer row exists, `custom_data.user_id` is the only
 * way to link the new Paddle customer to a CrawlPact account — a retry from
 * stored data alone cannot recover that specific linkage. It will still
 * fail safely (marked `failed`/`permanently_failed` again, not silently
 * wrong) rather than fabricate a result. See docs/security/BILLING_SECURITY.md.
 */
export async function retryWebhookEvent(
  db: Database,
  priceIdMap: PriceIdMap,
  webhookEventId: string,
): Promise<RetryResult> {
  const [row] = await db
    .select()
    .from(schema.webhookEvents)
    .where(eq(schema.webhookEvents.id, webhookEventId))
    .limit(1);
  if (!row) return { ok: false, reason: "Webhook event not found." };
  if (!ELIGIBLE_RETRY_STATUSES.has(row.status)) {
    return {
      ok: false,
      reason: `Only "failed" or "retrying" events are eligible for retry (this one is "${row.status}").`,
    };
  }

  const event: ParsedPaddleEvent = {
    eventId: row.paddleEventId,
    eventType: row.eventType,
    occurredAt: row.occurredAt,
    data: JSON.parse(row.payloadRedacted) as Record<string, unknown>,
  };

  const outcome = await processPaddleWebhookEvent(db, priceIdMap, event);
  return { ok: true, outcome };
}
