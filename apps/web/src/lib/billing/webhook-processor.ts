import { and, eq, isNull, lt, or } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { resolvePriceToPlan } from "./plan-catalog";
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
 * connection, and matched. On 2026-07-28, a real Paddle webhook simulation
 * delivered genuinely signed events to this handler in production —
 * signature verification, parsing, dispatch, and idempotent audit logging
 * all confirmed working against real traffic. See
 * docs/status/PADDLE_WEBHOOK_LIVE_DELIVERY_VERIFICATION.md. Still open: a
 * real paid checkout lifecycle (real `custom_data.userId` linkage through
 * to a plan grant) has not been run — see docs/status/KNOWN_RISKS.md.
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

/**
 * The D1/Drizzle driver wraps the real SQLite error (e.g. "UNIQUE constraint
 * failed: ...") in `.cause` rather than `.message`, so `error.message` alone
 * ("Failed query: ... params: ...") doesn't say *why* a query failed. Include
 * both so a stored failure is diagnosable without re-deriving it from timing.
 */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause instanceof Error ? error.cause.message : undefined;
  return cause ? `${error.message}\ncause: ${cause}` : error.message;
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
  | "processed"
  | "duplicate"
  | "ignored_out_of_order"
  | "ignored_unhandled_type"
  | "ignored_no_customer_yet"
  | "failed";

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
  const inserted = await db
    .insert(schema.billingCustomers)
    .values({ id, userId, paddleCustomerId, createdAt: now, updatedAt: now })
    // Paddle commonly fires customer.created alongside the first
    // transaction/subscription event for a brand-new customer within
    // milliseconds of each other, and Workers can process both deliveries
    // concurrently. Without this, the loser of that race hits
    // billing_customers' UNIQUE constraint (on paddle_customer_id, or on
    // user_id if this account already has a row) and the event is wrongly
    // recorded as failed even though the customer now exists.
    .onConflictDoNothing()
    .returning({ id: schema.billingCustomers.id });
  if (inserted[0]) return inserted[0].id;

  const [winner] = await db
    .select()
    .from(schema.billingCustomers)
    .where(eq(schema.billingCustomers.paddleCustomerId, paddleCustomerId))
    .limit(1);
  return winner?.id ?? null;
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

  // Resolves against every known price — current and legacy alike — so an existing
  // subscriber's events keep resolving to a plan forever, even after a newer price supersedes
  // theirs for new checkout. See docs/billing/LEGACY_PRICE_AND_SUBSCRIBER_POLICY.md.
  const resolvedPrice = priceId ? await resolvePriceToPlan(db, priceId) : null;

  const [existingSub] = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.paddleSubscriptionId, paddleSubscriptionId))
    .limit(1);

  const now = new Date().toISOString();
  const resolvedPlanId = resolvedPrice?.planId ?? existingSub?.planId ?? "free";

  let subscriptionRowId: string;
  if (existingSub) {
    subscriptionRowId = existingSub.id;
    // Compare-and-swap: the WHERE clause re-checks `last_applied_occurred_at`
    // against the row's *current* committed value at UPDATE time, not a
    // value read earlier in this function — so two related, near-concurrent
    // deliveries can never both believe they're the newest. Previously this
    // was a separate SELECT-then-decide check against `webhook_events`,
    // which left a real window where the slower request's update could land
    // after the faster one had already been marked "processed" elsewhere but
    // before its own row write's effects were visible to that check — see
    // docs/status/BILLING_WEBHOOK_RACE_TEST_FLAKE.md.
    const updated = await db
      .update(schema.subscriptions)
      .set({
        planId: resolvedPlanId,
        status: localStatus,
        currentPeriodEnd: currentBillingPeriod?.ends_at ?? existingSub.currentPeriodEnd,
        cancelAtPeriodEnd: scheduledChange?.action === "cancel",
        lastPaddleEventId: event.eventId,
        lastAppliedOccurredAt: event.occurredAt,
        paddlePriceId: priceId ?? existingSub.paddlePriceId,
        billingInterval: resolvedPrice?.interval ?? existingSub.billingInterval,
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.subscriptions.id, existingSub.id),
          or(
            isNull(schema.subscriptions.lastAppliedOccurredAt),
            lt(schema.subscriptions.lastAppliedOccurredAt, event.occurredAt),
          ),
        ),
      )
      .returning({ id: schema.subscriptions.id });

    if (!updated[0]) {
      return {
        outcome: "ignored_out_of_order",
        billingCustomerId,
        subscriptionRowId: existingSub.id,
      };
    }
  } else {
    const inserted = await db
      .insert(schema.subscriptions)
      .values({
        id: crypto.randomUUID(),
        billingCustomerId,
        paddleSubscriptionId,
        planId: resolvedPlanId,
        status: localStatus,
        currentPeriodEnd: currentBillingPeriod?.ends_at ?? null,
        cancelAtPeriodEnd: scheduledChange?.action === "cancel",
        lastPaddleEventId: event.eventId,
        lastAppliedOccurredAt: event.occurredAt,
        paddlePriceId: priceId ?? null,
        billingInterval: resolvedPrice?.interval ?? null,
        createdAt: now,
        updatedAt: now,
      })
      // Paddle fires related subscription events (e.g. subscription.created
      // and subscription.activated) within milliseconds of each other, so a
      // concurrent delivery can insert this row between our SELECT above and
      // this INSERT. Re-run the handler now that the row exists — it will
      // take the `existingSub` branch above and apply this event as an
      // update (subject to the same compare-and-swap), instead of
      // surfacing a UNIQUE-constraint failure for an otherwise-valid event.
      .onConflictDoNothing({ target: schema.subscriptions.paddleSubscriptionId })
      .returning({ id: schema.subscriptions.id });

    if (!inserted[0]) {
      return handleSubscriptionEvent(db, event);
    }
    subscriptionRowId = inserted[0].id;
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

  if (!paddleTransactionId || !status) return { outcome: "failed" };
  // Paddle sends transaction.created/transaction.updated for a transaction
  // still in "draft" status while checkout is in progress, before a
  // customer is attached — customer_id is genuinely null at that point, not
  // a malformed payload. Nothing to sync yet; a later event on the same
  // transaction id will carry the customer once checkout completes.
  if (!paddleCustomerId) return { outcome: "ignored_no_customer_yet" };

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
    const inserted = await db
      .insert(schema.transactions)
      .values({
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
      })
      // Paddle fires related transaction events (e.g. transaction.created
      // and transaction.ready) within milliseconds of each other, so a
      // concurrent delivery can insert this row between our SELECT above and
      // this INSERT. Re-run the handler now that the row exists — it will
      // take the `existingTxn` branch above and apply this event's status as
      // an update, instead of surfacing a UNIQUE-constraint failure for an
      // otherwise-valid event.
      .onConflictDoNothing({ target: schema.transactions.paddleTransactionId })
      .returning({ id: schema.transactions.id });

    if (!inserted[0]) {
      return handleTransactionEvent(db, event);
    }
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
      result = await handleSubscriptionEvent(db, event);
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
        error: describeError(error),
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
