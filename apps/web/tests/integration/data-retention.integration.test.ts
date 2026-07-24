import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { createD1TestHarness } from "./d1-harness";
import { ACCOUNT_DELETION_GRACE_PERIOD_DAYS } from "../../src/lib/account";
import { runDataRetentionPurge } from "../../src/lib/data-retention";

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function insertScan(
  db: Database,
  fields: { id: string; domainId: string | null; startedAt: string },
): Promise<void> {
  await db.insert(schema.scans).values({
    id: fields.id,
    domainId: fields.domainId,
    triggeredBy: fields.domainId ? "manual" : "anonymous",
    targetInput: "https://example.com",
    canonicalOrigin: "https://example.com",
    status: "completed",
    scoreState: "scored",
    score: 80,
    externalRequestCount: 1,
    startedAt: fields.startedAt,
    completedAt: fields.startedAt,
  });
}

describe("data retention purge (real D1)", () => {
  let db: Database;
  let dispose: () => Promise<void>;

  beforeAll(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    db = createDb(harness.db);
  });

  afterAll(async () => {
    await dispose();
  });

  it("purges anonymous scans older than 7 days but keeps recent ones", async () => {
    await insertScan(db, { id: "scan_old_anon", domainId: null, startedAt: daysAgo(8) });
    await insertScan(db, { id: "scan_recent_anon", domainId: null, startedAt: daysAgo(1) });

    const result = await runDataRetentionPurge(db);
    expect(result.anonymousScansDeleted).toBe(1);

    const remaining = await db.select({ id: schema.scans.id }).from(schema.scans);
    const ids = remaining.map((r) => r.id);
    expect(ids).not.toContain("scan_old_anon");
    expect(ids).toContain("scan_recent_anon");
  });

  it("purges a domain's expired scan history per the owner's plan, but never the domain's current lastScanId", async () => {
    const now = new Date().toISOString();
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({
      id: userId,
      displayName: "Retention Test User",
      status: "active",
      planId: "free", // 30-day retention
      isAdmin: false,
      createdAt: now,
      updatedAt: now,
    });

    const domainId = crypto.randomUUID();
    await db.insert(schema.domains).values({
      id: domainId,
      ownerUserId: userId,
      displayName: "retention-test.example",
      canonicalOrigin: "https://retention-test.example",
      originalInput: "retention-test.example",
      preset: "maximum_ai_visibility",
      monitoringState: "active",
      monitoringFrequency: "none",
      consecutiveFailureCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    await insertScan(db, { id: "scan_over_30d", domainId, startedAt: daysAgo(40) });
    await insertScan(db, { id: "scan_under_30d", domainId, startedAt: daysAgo(10) });
    // This is the domain's current baseline — older than retention, but must survive.
    await insertScan(db, { id: "scan_current_baseline_old", domainId, startedAt: daysAgo(400) });
    await db
      .update(schema.domains)
      .set({ lastScanId: "scan_current_baseline_old" })
      .where(eq(schema.domains.id, domainId));

    const result = await runDataRetentionPurge(db);
    expect(result.domainScansDeleted).toBeGreaterThanOrEqual(1);

    const remainingScans = await db
      .select({ id: schema.scans.id })
      .from(schema.scans)
      .where(eq(schema.scans.domainId, domainId));
    const ids = remainingScans.map((r) => r.id);
    expect(ids).not.toContain("scan_over_30d");
    expect(ids).toContain("scan_under_30d");
    expect(ids).toContain("scan_current_baseline_old");
  });

  it("hard-deletes an account past the cancellable grace period, cascading its owned data away", async () => {
    const now = new Date().toISOString();
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({
      id: userId,
      displayName: "Overdue Deletion User",
      status: "pending_deletion",
      planId: "free",
      isAdmin: false,
      deletionRequestedAt: daysAgo(ACCOUNT_DELETION_GRACE_PERIOD_DAYS + 1),
      createdAt: now,
      updatedAt: now,
    });
    const domainId = crypto.randomUUID();
    await db.insert(schema.domains).values({
      id: domainId,
      ownerUserId: userId,
      displayName: "overdue-user-domain.example",
      canonicalOrigin: "https://overdue-user-domain.example",
      originalInput: "overdue-user-domain.example",
      preset: "maximum_ai_visibility",
      monitoringState: "active",
      monitoringFrequency: "none",
      consecutiveFailureCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    const stillWithinGraceUserId = crypto.randomUUID();
    await db.insert(schema.users).values({
      id: stillWithinGraceUserId,
      displayName: "Recently Requested Deletion",
      status: "pending_deletion",
      planId: "free",
      isAdmin: false,
      deletionRequestedAt: daysAgo(1),
      createdAt: now,
      updatedAt: now,
    });

    const result = await runDataRetentionPurge(db);
    expect(result.accountsPurged).toBe(1);

    const [overdueUser] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    expect(overdueUser).toBeUndefined();
    const [overdueDomain] = await db
      .select()
      .from(schema.domains)
      .where(eq(schema.domains.id, domainId))
      .limit(1);
    expect(overdueDomain).toBeUndefined();

    const [stillPending] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, stillWithinGraceUserId))
      .limit(1);
    expect(stillPending).toBeDefined();
  });

  it("deletes a user's account without destroying their billing/transaction history (SRS §34's 'as legally and operationally required' billing exception)", async () => {
    const now = new Date().toISOString();
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({
      id: userId,
      displayName: "Billing Retention User",
      status: "pending_deletion",
      planId: "pro",
      isAdmin: false,
      deletionRequestedAt: daysAgo(ACCOUNT_DELETION_GRACE_PERIOD_DAYS + 1),
      createdAt: now,
      updatedAt: now,
    });

    // Every real signup writes an `account_created` product_events row with
    // this user's id (see pages/api/auth/register/finish.ts) — a realistic
    // fixture, not a contrived one.
    await db.insert(schema.productEvents).values({
      eventName: "account_created",
      userId,
      createdAt: now,
    });

    const billingCustomerId = crypto.randomUUID();
    await db.insert(schema.billingCustomers).values({
      id: billingCustomerId,
      userId,
      paddleCustomerId: "ctm_billing_retention_test",
      createdAt: now,
      updatedAt: now,
    });

    const subscriptionId = crypto.randomUUID();
    await db.insert(schema.subscriptions).values({
      id: subscriptionId,
      billingCustomerId,
      paddleSubscriptionId: "sub_billing_retention_test",
      planId: "pro",
      status: "cancelled",
      createdAt: now,
      updatedAt: now,
    });

    const transactionId = crypto.randomUUID();
    await db.insert(schema.transactions).values({
      id: transactionId,
      paddleTransactionId: "txn_billing_retention_test",
      billingCustomerId,
      subscriptionId,
      currency: "USD",
      grossAmountCents: 17900,
      status: "completed",
      occurredAt: now,
      createdAt: now,
    });

    const webhookEventId = crypto.randomUUID();
    await db.insert(schema.webhookEvents).values({
      id: webhookEventId,
      paddleEventId: "evt_billing_retention_test",
      eventType: "transaction.completed",
      status: "processed",
      relatedBillingCustomerId: billingCustomerId,
      relatedSubscriptionId: subscriptionId,
      payloadRedacted: "{}",
      receivedAt: now,
      occurredAt: now,
    });

    const result = await runDataRetentionPurge(db);
    expect(result.accountsPurged).toBe(1);

    const [deletedUser] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    expect(deletedUser).toBeUndefined();

    // The billing/financial trail must survive account deletion — only its
    // link to the (now-deleted) user is severed.
    const [survivingCustomer] = await db
      .select()
      .from(schema.billingCustomers)
      .where(eq(schema.billingCustomers.id, billingCustomerId))
      .limit(1);
    expect(survivingCustomer).toBeDefined();
    expect(survivingCustomer!.userId).toBeNull();

    const [survivingSubscription] = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.id, subscriptionId))
      .limit(1);
    expect(survivingSubscription).toBeDefined();

    const [survivingTransaction] = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, transactionId))
      .limit(1);
    expect(survivingTransaction).toBeDefined();
    expect(survivingTransaction!.grossAmountCents).toBe(17900);

    const [survivingWebhookEvent] = await db
      .select()
      .from(schema.webhookEvents)
      .where(eq(schema.webhookEvents.id, webhookEventId))
      .limit(1);
    expect(survivingWebhookEvent).toBeDefined();

    // First-party analytics (SRS §28.13 minimisation): the aggregate event
    // survives for product metrics, but its link to the deleted user is
    // severed, not left dangling.
    const [survivingEvent] = await db
      .select()
      .from(schema.productEvents)
      .where(eq(schema.productEvents.eventName, "account_created"));
    expect(survivingEvent).toBeDefined();
    expect(survivingEvent!.userId).toBeNull();
  });
});
