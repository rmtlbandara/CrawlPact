import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { plans } from "./plans";
import { users } from "./identity";

// Mirrors packages/database/migrations/0003_billing.sql.
export const billingCustomers = sqliteTable("billing_customers", {
  id: text("id").primaryKey(),
  // Nullable since migration 0013: survives account deletion (SET NULL, not
  // CASCADE) so the billing/transaction trail is preserved independent of
  // the owning account's lifecycle (SRS §34).
  userId: text("user_id").references(() => users.id),
  paddleCustomerId: text("paddle_customer_id").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  billingCustomerId: text("billing_customer_id")
    .notNull()
    .references(() => billingCustomers.id),
  paddleSubscriptionId: text("paddle_subscription_id").notNull(),
  planId: text("plan_id")
    .notNull()
    .references(() => plans.id),
  status: text("status")
    .notNull()
    .$type<"active" | "trialing" | "past_due" | "paused" | "cancelled" | "expired">(),
  currentPeriodEnd: text("current_period_end"),
  cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" }).notNull().default(false),
  lastPaddleEventId: text("last_paddle_event_id"),
  syncError: text("sync_error"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  paddleTransactionId: text("paddle_transaction_id").notNull(),
  billingCustomerId: text("billing_customer_id")
    .notNull()
    .references(() => billingCustomers.id),
  subscriptionId: text("subscription_id").references(() => subscriptions.id),
  currency: text("currency").notNull(),
  grossAmountCents: integer("gross_amount_cents").notNull(),
  taxAmountCents: integer("tax_amount_cents"),
  status: text("status").notNull(),
  refundStatus: text("refund_status"),
  chargebackStatus: text("chargeback_status"),
  occurredAt: text("occurred_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const webhookEvents = sqliteTable("webhook_events", {
  id: text("id").primaryKey(),
  paddleEventId: text("paddle_event_id").notNull(),
  eventType: text("event_type").notNull(),
  status: text("status")
    .notNull()
    .$type<"pending" | "processed" | "ignored" | "failed" | "retrying" | "permanently_failed">(),
  relatedBillingCustomerId: text("related_billing_customer_id").references(
    () => billingCustomers.id,
  ),
  relatedSubscriptionId: text("related_subscription_id").references(() => subscriptions.id),
  payloadRedacted: text("payload_redacted").notNull(),
  error: text("error"),
  attempts: integer("attempts").notNull().default(0),
  receivedAt: text("received_at").notNull(),
  occurredAt: text("occurred_at").notNull(),
  processedAt: text("processed_at"),
  lastRetryAt: text("last_retry_at"),
});

export const temporaryEntitlements = sqliteTable("temporary_entitlements", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  grantedPlanId: text("granted_plan_id")
    .notNull()
    .references(() => plans.id),
  reason: text("reason").notNull(),
  // Nullable since migration 0015: survives the granting admin's account
  // being deleted (SET NULL, not left dangling) — the entitlement grant
  // itself remains a real audit record.
  grantedByUserId: text("granted_by_user_id").references(() => users.id),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  revokedAt: text("revoked_at"),
});
