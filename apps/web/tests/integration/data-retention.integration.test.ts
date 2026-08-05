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

  it("purges an expired scan referenced by a scan_diffs row without throwing, and the diff survives with a null-safe reference (RISK-005, Phase 11)", async () => {
    const now = new Date().toISOString();
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({
      id: userId,
      displayName: "Scan Diff Retention User",
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
      displayName: "scan-diff-retention.example",
      canonicalOrigin: "https://scan-diff-retention.example",
      originalInput: "scan-diff-retention.example",
      preset: "maximum_ai_visibility",
      monitoringState: "active",
      monitoringFrequency: "none",
      consecutiveFailureCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    // The diff's *previous* scan is old enough to be purged by Free's 30-day
    // retention; the *current* scan is the domain's live baseline, so it must
    // survive untouched regardless of age (mirrors the real monitoring path:
    // a scan_diffs row is written comparing the domain's prior baseline
    // against its new one — see handleScanSuccess in lib/monitoring.ts).
    await insertScan(db, { id: "diff_scan_expired", domainId, startedAt: daysAgo(40) });
    await insertScan(db, { id: "diff_scan_current", domainId, startedAt: daysAgo(1) });
    await db
      .update(schema.domains)
      .set({ lastScanId: "diff_scan_current" })
      .where(eq(schema.domains.id, domainId));

    const scanDiffId = crypto.randomUUID();
    await db.insert(schema.scanDiffs).values({
      id: scanDiffId,
      domainId,
      previousScanId: "diff_scan_expired",
      currentScanId: "diff_scan_current",
      diffType: "website_drift",
      summary: "1 crawler result changed",
      details: "[]",
      createdAt: now,
    });

    // Before the RISK-005 fix, this purge would throw
    // SQLITE_CONSTRAINT_FOREIGNKEY here, because scan_diffs.previous_scan_id
    // had no ON DELETE clause and still pointed at diff_scan_expired.
    const result = await runDataRetentionPurge(db);
    expect(result.domainScansDeleted).toBeGreaterThanOrEqual(1);

    const remainingScans = await db
      .select({ id: schema.scans.id })
      .from(schema.scans)
      .where(eq(schema.scans.domainId, domainId));
    const remainingIds = remainingScans.map((r) => r.id);
    expect(remainingIds).not.toContain("diff_scan_expired");
    // The domain's current baseline is protected regardless of age.
    expect(remainingIds).toContain("diff_scan_current");

    const [survivingDiff] = await db
      .select()
      .from(schema.scanDiffs)
      .where(eq(schema.scanDiffs.id, scanDiffId))
      .limit(1);
    expect(survivingDiff).toBeDefined();
    expect(survivingDiff!.previousScanId).toBeNull();
    expect(survivingDiff!.currentScanId).toBe("diff_scan_current");
    expect(survivingDiff!.summary).toBe("1 crawler result changed");
  });

  it("purges an expired anonymous scan that still has a lingering audit_continuations row, cascading it away rather than throwing (Phase 11)", async () => {
    await insertScan(db, {
      id: "anon_scan_with_continuation",
      domainId: null,
      startedAt: daysAgo(8),
    });
    // Continuations expire after 60 minutes (audit-continuation.ts) but
    // nothing deletes the row on expiry -- this reproduces a real
    // long-lingering, already-expired, never-consumed continuation still
    // pointing at a scan that's now old enough to be purged.
    await db.insert(schema.auditContinuations).values({
      id: "cont_orphan_candidate",
      scanId: "anon_scan_with_continuation",
      canonicalOrigin: "https://example.com",
      intendedAction: "save_only",
      createdAt: daysAgo(8),
      expiresAt: daysAgo(7.9), // long expired
    });

    // Before this fix, this purge would throw SQLITE_CONSTRAINT_FOREIGNKEY,
    // because audit_continuations.scan_id had no ON DELETE clause.
    const result = await runDataRetentionPurge(db);
    expect(result.anonymousScansDeleted).toBe(1);

    const [survivingScan] = await db
      .select({ id: schema.scans.id })
      .from(schema.scans)
      .where(eq(schema.scans.id, "anon_scan_with_continuation"))
      .limit(1);
    expect(survivingScan).toBeUndefined();

    const [survivingContinuation] = await db
      .select()
      .from(schema.auditContinuations)
      .where(eq(schema.auditContinuations.id, "cont_orphan_candidate"))
      .limit(1);
    expect(survivingContinuation).toBeUndefined();
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

  it("dry-run mode reports the real, exact count of eligible rows without deleting anything (Phase 11, Stage 11D)", async () => {
    await insertScan(db, { id: "dryrun_scan_old_anon", domainId: null, startedAt: daysAgo(8) });
    await insertScan(db, { id: "dryrun_scan_recent_anon", domainId: null, startedAt: daysAgo(1) });

    const result = await runDataRetentionPurge(db, new Date(), { dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(result.categories.anonymous_scans.wouldAffect).toBeGreaterThanOrEqual(1);
    expect(result.categories.anonymous_scans.affected).toBe(0);
    // Every flat count stays 0 in dry-run mode — nothing was actually deleted.
    expect(result.anonymousScansDeleted).toBe(0);

    const remaining = await db.select({ id: schema.scans.id }).from(schema.scans);
    expect(remaining.map((r) => r.id)).toContain("dryrun_scan_old_anon");

    // A real (non-dry-run) run afterwards actually deletes it — proves the
    // dry run didn't just fail to count.
    const realResult = await runDataRetentionPurge(db);
    expect(realResult.anonymousScansDeleted).toBeGreaterThanOrEqual(1);
    const afterReal = await db.select({ id: schema.scans.id }).from(schema.scans);
    expect(afterReal.map((r) => r.id)).not.toContain("dryrun_scan_old_anon");
  });

  it("chunks deletes and reports backlogRemaining when more eligible rows exist than the per-run cap, then finishes them on the next run (Phase 11, Stage 11D)", async () => {
    const statements = Array.from({ length: 9 }, (_, i) =>
      db.insert(schema.scans).values({
        id: `chunk_scan_${i}`,
        domainId: null,
        triggeredBy: "anonymous",
        targetInput: "https://example.com",
        canonicalOrigin: "https://example.com",
        status: "completed",
        scoreState: "scored",
        score: 80,
        externalRequestCount: 1,
        startedAt: daysAgo(8),
        completedAt: daysAgo(8),
      }),
    );
    await db.batch(statements as [(typeof statements)[number], ...(typeof statements)[number][]]);

    // A tiny chunk size/max-chunks pair (3 rows/chunk, 1 chunk/run) makes a
    // 9-row backlog take exactly 3 runs to fully clear, without needing
    // thousands of real rows to exercise the same cap-then-resume logic
    // production uses at chunkSize=500/maxChunks=20.
    const run1 = await runDataRetentionPurge(db, new Date(), { chunkSize: 3, maxChunks: 1 });
    expect(run1.categories.anonymous_scans.affected).toBe(3);
    expect(run1.categories.anonymous_scans.backlogRemaining).toBe(true);
    expect(run1.hasBacklog).toBe(true);

    const run2 = await runDataRetentionPurge(db, new Date(), { chunkSize: 3, maxChunks: 1 });
    expect(run2.categories.anonymous_scans.affected).toBe(3);
    expect(run2.categories.anonymous_scans.backlogRemaining).toBe(true);

    const run3 = await runDataRetentionPurge(db, new Date(), { chunkSize: 3, maxChunks: 1 });
    expect(run3.categories.anonymous_scans.affected).toBe(3);
    expect(run3.categories.anonymous_scans.backlogRemaining).toBe(false);

    const remaining = await db.select({ id: schema.scans.id }).from(schema.scans);
    expect(remaining.filter((r) => r.id.startsWith("chunk_scan_"))).toHaveLength(0);
  });

  it("isolates a category failure — other categories still run and report their real results (Phase 11, Stage 11D)", async () => {
    // A dedicated, throwaway harness (not the shared `db` used by every
    // other test in this file) so a genuinely broken table doesn't corrupt
    // any other test. Dropping audit_continuations forces a real SQL error
    // specifically inside purgeExpiredAuditContinuations, while leaving
    // every other table — and therefore every other category — intact.
    const harness = await createD1TestHarness();
    const isolatedDb = createDb(harness.db);
    try {
      await insertScan(isolatedDb, {
        id: "isolation_scan_old_anon",
        domainId: null,
        startedAt: daysAgo(8),
      });
      await harness.db.prepare("DROP TABLE audit_continuations").run();

      const result = await runDataRetentionPurge(isolatedDb);
      expect(result.hasErrors).toBe(true);
      expect(result.categories.expired_audit_continuations.error).not.toBeNull();
      // The broken category contributes 0, not a crash of the whole run.
      expect(result.expiredContinuationsDeleted).toBe(0);
      // Every other category still ran and produced a real result, not an error —
      // proven by the anonymous scan actually being deleted despite the failure above.
      expect(result.categories.anonymous_scans.error).toBeNull();
      expect(result.anonymousScansDeleted).toBeGreaterThanOrEqual(1);
      expect(result.categories.domain_scans.error).toBeNull();
      expect(result.categories.deleted_accounts.error).toBeNull();
      expect(result.categories.expired_entitlements.error).toBeNull();
    } finally {
      await harness.dispose();
    }
  });
});
