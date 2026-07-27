import { and, desc, eq } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { mapPriceIdToPlanId } from "./plan-mapping";
import type { PriceIdMap } from "./plan-mapping";
import { trackEvent } from "../analytics";

/**
 * Applies Paddle Billing webhook events to local state (SRS §27, Part 2
 * Step 17). Paddle remains the source of truth for billing; this only
 * caches enough to gate product entitlements without calling Paddle's API
 * on every request (`users.plan_id` is the actual enforcement point
 * elsewhere in the app — see lib/plan.ts and every plan-gated endpoint).
 *
 * Payload shapes here follow Paddle Billing v2's publicly documented
 * webhook format. The entity field names this file reads (subscription
 * status/items/scheduled_change/current_billing_period, transaction
 * status/details.totals, adjustment action, customer id/custom_data) were
 * cross-checked 2026-07-26 against this account's live Paddle API read
 * responses (products/prices/notification-settings) via the Paddle MCP
 * connection, and matched. That is read-API confirmation, not proof —
 * no real webhook delivery or live checkout has been observed against
 * this handler yet; see docs/status/KNOWN_RISKS.md.
 */

const MAX_ATTEMPTS_BEFORE_GIVING_UP = 5;

export type ParsedPaddleEvent = {
  eventId: string;
  eventType: string;
  occurredAt: string;
  data: Record<string, unknown>;
};

export function parsePaddleWebhookBody(rawBody: string): ParsedPaddleEvent | null {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (typeof json !== "object" || json === null) return null;
  const record = json as Record<string, unknown>;
  const { event_id, event_type, occurred_at, data } = record;
  if (
    typeof event_id !== "string" ||
    typeof event_type !== "string" ||
    typeof occurred_at !== "string"
  ) {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  return {
    eventId: event_id,
    eventType: event_type,
    occurredAt: occurred_at,
    data: data as Record<string, unknown>,
  };
}

/** Strips anything not needed for support/debugging before persisting a copy of the payload (data minimisation). */
function redactPayload(data: Record<string, unknown>): Record<string, unknown> {
  const { ...rest } = data;
  delete rest.custom_data;
  return rest;
}

export const PADDLE_TO_LOCAL_STATUS: Record<
  string,
  (typeof schema.subscriptions.$inferSelect)["status"] | undefined
> = {
  active: "active",
  trialing: "trialing",
  past_due: "past_due",
  paused: "paused",
  canceled: "cancelled",
};

export type ProcessOutcome =
  "processed" | "duplicate" | "ignored_out_of_order" | "ignored_unhandled_type" | "failed";

async function findOrCreateBillingCustomer(
  db: Database,
  paddleCustomerId: string,
  userId: string | undefined,
): Promise<string | null> {
  const [existing] = await db
    .select()
    .from(schema.billingCustomers)
    .where(eq(schema.billingCustomers.paddleCustomerId, paddleCustomerId))
    .limit(1);
  if (existing) return existing.id;

  if (!userId) return null; // No linkage available yet — nothing we can create.

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.billingCustomers).values({
    id,
    userId,
    paddleCustomerId,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

async function isOutOfOrder(
  db: Database,
  subscriptionRowId: string,
  occurredAt: string,
): Promise<boolean> {
  const [latest] = await db
    .select({ occurredAt: schema.webhookEvents.occurredAt })
    .from(schema.webhookEvents)
    .where(
      and(
        eq(schema.webhookEvents.relatedSubscriptionId, subscriptionRowId),
        eq(schema.webhookEvents.status, "processed"),
      ),
    )
    .orderBy(desc(schema.webhookEvents.occurredAt))
    .limit(1);
  return latest ? latest.occurredAt > occurredAt : false;
}

async function applyPlanFromStatus(
  db: Database,
  userId: string,
  status: (typeof schema.subscriptions.$inferSelect)["status"],
  planId: string,
): Promise<void> {
  const now = new Date().toISOString();
  if (status === "active" || status === "trialing") {
    await db
      .update(schema.users)
      .set({ planId, updatedAt: now })
      .where(eq(schema.users.id, userId));
  } else if (status === "past_due") {
    // Grace period: a payment retry in progress does not revoke access —
    // deliberately leave the user's current plan untouched.
  } else {
    // cancelled / expired / paused: no active entitlement.
    await db
      .update(schema.users)
      .set({ planId: "free", updatedAt: now })
      .where(eq(schema.users.id, userId));
  }
}

async function handleSubscriptionEvent(
  db: Database,
  event: ParsedPaddleEvent,
  priceIdMap: PriceIdMap,
): Promise<{ outcome: ProcessOutcome; billingCustomerId?: string; subscriptionRowId?: string }> {
  const data = event.data;
  const paddleSubscriptionId = data.id as string | undefined;
  const paddleCustomerId = data.customer_id as string | undefined;
  const paddleStatus = data.status as string | undefined;
  const items = data.items as { price?: { id?: string } }[] | undefined;
  const priceId = items?.[0]?.price?.id;
  const customData = data.custom_data as { userId?: string } | null | undefined;
  const scheduledChange = data.scheduled_change as { action?: string } | null | undefined;
  const currentBillingPeriod = data.current_billing_period as
    { ends_at?: string } | null | undefined;

  if (!paddleSubscriptionId || !paddleCustomerId || !paddleStatus) {
    return { outcome: "failed" };
  }

  const billingCustomerId = await findOrCreateBillingCustomer(
    db,
    paddleCustomerId,
    customData?.userId,
  );
  if (!billingCustomerId) return { outcome: "failed" };

  const [billingCustomer] = await db
    .select()
    .from(schema.billingCustomers)
    .where(eq(schema.billingCustomers.id, billingCustomerId))
    .limit(1);
  if (!billingCustomer) return { outcome: "failed" };

  const localStatus = PADDLE_TO_LOCAL_STATUS[paddleStatus];
  if (!localStatus) return { outcome: "failed" };

  const planId = priceId ? mapPriceIdToPlanId(priceIdMap, priceId) : null;

  const [existingSub] = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.paddleSubscriptionId, paddleSubscriptionId))
    .limit(1);

  if (existingSub && (await isOutOfOrder(db, existingSub.id, event.occurredAt))) {
    return {
      outcome: "ignored_out_of_order",
      billingCustomerId,
      subscriptionRowId: existingSub.id,
    };
  }

  const now = new Date().toISOString();
  const resolvedPlanId = planId ?? existingSub?.planId ?? "free";

  let subscriptionRowId: string;
  if (existingSub) {
    subscriptionRowId = existingSub.id;
    await db
      .update(schema.subscriptions)
      .set({
        planId: resolvedPlanId,
        status: localStatus,
        currentPeriodEnd: currentBillingPeriod?.ends_at ?? existingSub.currentPeriodEnd,
        cancelAtPeriodEnd: scheduledChange?.action === "cancel",
        lastPaddleEventId: event.eventId,
        updatedAt: now,
      })
      .where(eq(schema.subscriptions.id, existingSub.id));
  } else {
    subscriptionRowId = crypto.randomUUID();
    await db.insert(schema.subscriptions).values({
      id: subscriptionRowId,
      billingCustomerId,
      paddleSubscriptionId,
      planId: resolvedPlanId,
      status: localStatus,
      currentPeriodEnd: currentBillingPeriod?.ends_at ?? null,
      cancelAtPeriodEnd: scheduledChange?.action === "cancel",
      lastPaddleEventId: event.eventId,
      createdAt: now,
      updatedAt: now,
    });
  }

  // `billingCustomer.userId` can be null if the account was deleted after
  // this billing customer was created (SET NULL on delete, see migration
  // 0013 — the billing/transaction trail intentionally outlives the
  // account). A delayed/retried webhook arriving after that point has no
  // local user left to update, but the subscription/transaction rows above
  // are still recorded correctly either way.
  if (billingCustomer.userId) {
    await applyPlanFromStatus(db, billingCustomer.userId, localStatus, resolvedPlanId);

    const wasActive = existingSub?.status === "active" || existingSub?.status === "trialing";
    const isNowActive = localStatus === "active" || localStatus === "trialing";
    if (!wasActive && isNowActive) {
      await trackEvent(db, "subscription_activated", {
        userId: billingCustomer.userId,
        properties: { planId: resolvedPlanId, status: localStatus },
      });
    }
  }

  return { outcome: "processed", billingCustomerId, subscriptionRowId };
}

async function handleTransactionEvent(
  db: Database,
  event: ParsedPaddleEvent,
): Promise<{ outcome: ProcessOutcome; billingCustomerId?: string; subscriptionRowId?: string }> {
  const data = event.data;
  const paddleTransactionId = data.id as string | undefined;
  const paddleCustomerId = data.customer_id as string | undefined;
  const paddleSubscriptionId = data.subscription_id as string | null | undefined;
  const status = data.status as string | undefined;
  const currencyCode = data.currency_code as string | undefined;
  const details = data.details as { totals?: { grand_total?: string; tax?: string } } | undefined;
  const customData = data.custom_data as { userId?: string } | null | undefined;

  if (!paddleTransactionId || !paddleCustomerId || !status) return { outcome: "failed" };

  const billingCustomerId = await findOrCreateBillingCustomer(
    db,
    paddleCustomerId,
    customData?.userId,
  );
  if (!billingCustomerId) return { outcome: "failed" };

  let subscriptionRowId: string | undefined;
  if (paddleSubscriptionId) {
    const [sub] = await db
      .select({ id: schema.subscriptions.id })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.paddleSubscriptionId, paddleSubscriptionId))
      .limit(1);
    subscriptionRowId = sub?.id;
  }

  const [existingTxn] = await db
    .select({ id: schema.transactions.id })
    .from(schema.transactions)
    .where(eq(schema.transactions.paddleTransactionId, paddleTransactionId))
    .limit(1);

  const now = new Date().toISOString();
  if (existingTxn) {
    await db
      .update(schema.transactions)
      .set({ status })
      .where(eq(schema.transactions.id, existingTxn.id));
  } else {
    await db.insert(schema.transactions).values({
      id: crypto.randomUUID(),
      paddleTransactionId,
      billingCustomerId,
      subscriptionId: subscriptionRowId ?? null,
      currency: currencyCode ?? "USD",
      grossAmountCents: Number(details?.totals?.grand_total ?? 0),
      taxAmountCents: details?.totals?.tax ? Number(details.totals.tax) : null,
      status,
      occurredAt: event.occurredAt,
      createdAt: now,
    });
  }

  return { outcome: "processed", billingCustomerId, subscriptionRowId };
}

async function handleAdjustmentEvent(
  db: Database,
  event: ParsedPaddleEvent,
): Promise<{ outcome: ProcessOutcome }> {
  const data = event.data;
  const paddleTransactionId = data.transaction_id as string | undefined;
  const action = data.action as string | undefined; // "refund" | "chargeback" | "credit" (best-effort field name)
  if (!paddleTransactionId || !action) return { outcome: "failed" };

  const [txn] = await db
    .select({ id: schema.transactions.id })
    .from(schema.transactions)
    .where(eq(schema.transactions.paddleTransactionId, paddleTransactionId))
    .limit(1);
  if (!txn) return { outcome: "failed" };

  const patch: Partial<typeof schema.transactions.$inferInsert> = {};
  if (action === "refund") patch.refundStatus = "refunded";
  if (action === "chargeback") patch.chargebackStatus = "chargeback";
  if (Object.keys(patch).length === 0) return { outcome: "ignored_unhandled_type" };

  await db.update(schema.transactions).set(patch).where(eq(schema.transactions.id, txn.id));
  return { outcome: "processed" };
}

async function handleCustomerEvent(
  db: Database,
  event: ParsedPaddleEvent,
): Promise<{ outcome: ProcessOutcome; billingCustomerId?: string }> {
  const data = event.data;
  const paddleCustomerId = data.id as string | undefined;
  const customData = data.custom_data as { userId?: string } | null | undefined;
  if (!paddleCustomerId) return { outcome: "failed" };

  const billingCustomerId = await findOrCreateBillingCustomer(
    db,
    paddleCustomerId,
    customData?.userId,
  );
  if (!billingCustomerId) return { outcome: "ignored_unhandled_type" }; // No linkage yet; a later subscription/transaction event will create it.
  return { outcome: "processed", billingCustomerId };
}

export async function processPaddleWebhookEvent(
  db: Database,
  priceIdMap: PriceIdMap,
  event: ParsedPaddleEvent,
): Promise<ProcessOutcome> {
  const now = new Date().toISOString();

  const [existing] = await db
    .select()
    .from(schema.webhookEvents)
    .where(eq(schema.webhookEvents.paddleEventId, event.eventId))
    .limit(1);

  if (
    existing &&
    (existing.status === "processed" ||
      existing.status === "ignored" ||
      existing.status === "permanently_failed")
  ) {
    return "duplicate";
  }

  let webhookEventRowId: string;
  if (existing) {
    webhookEventRowId = existing.id;
    await db
      .update(schema.webhookEvents)
      .set({ status: "retrying", attempts: existing.attempts + 1, lastRetryAt: now })
      .where(eq(schema.webhookEvents.id, existing.id));
  } else {
    webhookEventRowId = crypto.randomUUID();
    await db.insert(schema.webhookEvents).values({
      id: webhookEventRowId,
      paddleEventId: event.eventId,
      eventType: event.eventType,
      status: "pending",
      payloadRedacted: JSON.stringify(redactPayload(event.data)),
      attempts: 1,
      receivedAt: now,
      occurredAt: event.occurredAt,
    });
  }

  let result: { outcome: ProcessOutcome; billingCustomerId?: string; subscriptionRowId?: string };
  try {
    if (event.eventType.startsWith("subscription.")) {
      result = await handleSubscriptionEvent(db, event, priceIdMap);
    } else if (event.eventType.startsWith("transaction.")) {
      result = await handleTransactionEvent(db, event);
    } else if (event.eventType.startsWith("adjustment.")) {
      result = await handleAdjustmentEvent(db, event);
    } else if (event.eventType.startsWith("customer.")) {
      result = await handleCustomerEvent(db, event);
    } else {
      result = { outcome: "ignored_unhandled_type" };
    }
  } catch (error) {
    const attempts = (existing?.attempts ?? 0) + 1;
    await db
      .update(schema.webhookEvents)
      .set({
        status: attempts >= MAX_ATTEMPTS_BEFORE_GIVING_UP ? "permanently_failed" : "failed",
        error: error instanceof Error ? error.message : String(error),
      })
      .where(eq(schema.webhookEvents.id, webhookEventRowId));
    return "failed";
  }

  if (result.outcome === "failed") {
    const attempts = (existing?.attempts ?? 0) + 1;
    await db
      .update(schema.webhookEvents)
      .set({
        status: attempts >= MAX_ATTEMPTS_BEFORE_GIVING_UP ? "permanently_failed" : "failed",
        error: "Handler could not process this event (see payload_redacted).",
      })
      .where(eq(schema.webhookEvents.id, webhookEventRowId));
    return "failed";
  }

  await db
    .update(schema.webhookEvents)
    .set({
      status: result.outcome === "processed" ? "processed" : "ignored",
      processedAt: now,
      relatedBillingCustomerId: result.billingCustomerId ?? null,
      relatedSubscriptionId: result.subscriptionRowId ?? null,
    })
    .where(eq(schema.webhookEvents.id, webhookEventRowId));

  return result.outcome;
}
