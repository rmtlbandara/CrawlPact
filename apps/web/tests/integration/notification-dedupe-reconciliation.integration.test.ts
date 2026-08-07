import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { createD1TestHarness } from "./d1-harness";
import { createNotificationOnce, upsertGroupedNotification } from "../../src/lib/notifications";
import { reconcileMissingPolicyChangeNotifications } from "../../src/lib/notification-reconciliation";

/**
 * Phase 10 §13 (idempotency/dedupe) and §16 (reconciliation bounds) —
 * database-level guarantees, not just application-code discipline, since
 * application-only duplicate checks are unsafe under concurrent retries.
 */

async function insertUser(db: Database, planId: string = "pro"): Promise<string> {
  const userId = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.users).values({
    id: userId,
    displayName: "Dedupe Test User",
    status: "active",
    planId,
    isAdmin: false,
    createdAt: now,
    updatedAt: now,
  });
  return userId;
}

describe("notification dedupe and reconciliation bounds (real D1)", () => {
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

  it("createNotificationOnce is idempotent under a repeated identical call — exactly one row exists", async () => {
    const userId = await insertUser(db);
    const intent = {
      userId,
      domainId: null,
      type: "critical_policy_change" as const,
      category: "policy_changes" as const,
      priority: "critical" as const,
      title: "Test",
      body: "Test body",
      sourceType: "domain_change_event" as const,
      sourceId: "event-dedupe-1",
      dedupeKey: "critical_policy_change:domain_change_event:event-dedupe-1",
      actionPath: "/app/domains/x",
    };

    const first = await createNotificationOnce(db, intent);
    const second = await createNotificationOnce(db, intent);
    const third = await createNotificationOnce(db, intent);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(third.created).toBe(false);

    const rows = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.dedupeKey, intent.dedupeKey));
    expect(rows).toHaveLength(1);
  });

  it("createNotificationOnce enforces uniqueness at the D1 level even bypassing the application check (a raw concurrent-insert simulation)", async () => {
    const userId = await insertUser(db);
    const dedupeKey = "monitoring_paused:episode-concurrent";

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        createNotificationOnce(db, {
          userId,
          domainId: null,
          type: "monitoring_paused",
          category: "monitoring_health",
          priority: "high",
          title: "Paused",
          body: "Paused body",
          sourceType: "scan_failure_episode",
          sourceId: "episode-concurrent",
          dedupeKey,
        }),
      ),
    );

    expect(results.filter((r) => r.created)).toHaveLength(1);
    const rows = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.dedupeKey, dedupeKey));
    expect(rows).toHaveLength(1);
  });

  it("upsertGroupedNotification never decreases occurrenceCount and never re-surfaces an already-current occurrence as unread", async () => {
    const userId = await insertUser(db);
    const dedupeKey = "resource_failure:episode-grouping-test";

    await upsertGroupedNotification(db, {
      userId,
      domainId: null,
      type: "resource_failure",
      category: "monitoring_health",
      priority: "normal",
      title: "Failure",
      body: "Attempt 2",
      sourceType: "scan_failure_episode",
      sourceId: "episode-grouping-test",
      dedupeKey,
      occurrenceCount: 2,
    });

    const [afterFirst] = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.dedupeKey, dedupeKey))
      .limit(1);
    // Mark it read, then simulate a retried notification for the SAME
    // occurrence count — must not re-surface as unread.
    await db
      .update(schema.notifications)
      .set({ readAt: new Date().toISOString() })
      .where(eq(schema.notifications.id, afterFirst!.id));
    await upsertGroupedNotification(db, {
      userId,
      domainId: null,
      type: "resource_failure",
      category: "monitoring_health",
      priority: "normal",
      title: "Failure",
      body: "Attempt 2 (retried)",
      sourceType: "scan_failure_episode",
      sourceId: "episode-grouping-test",
      dedupeKey,
      occurrenceCount: 2,
    });
    const [afterRetry] = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.dedupeKey, dedupeKey))
      .limit(1);
    expect(afterRetry!.readAt).not.toBeNull();
    expect(afterRetry!.occurrenceCount).toBe(2);

    // A genuinely new, higher occurrence DOES re-surface as unread.
    await upsertGroupedNotification(db, {
      userId,
      domainId: null,
      type: "resource_failure",
      category: "monitoring_health",
      priority: "normal",
      title: "Failure",
      body: "Attempt 3",
      sourceType: "scan_failure_episode",
      sourceId: "episode-grouping-test",
      dedupeKey,
      occurrenceCount: 3,
    });
    const [afterThird] = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.dedupeKey, dedupeKey))
      .limit(1);
    expect(afterThird!.readAt).toBeNull();
    expect(afterThird!.occurrenceCount).toBe(3);

    const allRows = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.dedupeKey, dedupeKey));
    expect(allRows).toHaveLength(1);
  });

  it("reconciliation respects its bounded lookback window — an old event outside the window is not recreated", async () => {
    const userId = await insertUser(db);
    const domainId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.insert(schema.domains).values({
      id: domainId,
      ownerUserId: userId,
      displayName: "reconcile-lookback.example",
      canonicalOrigin: "https://reconcile-lookback.example",
      originalInput: "reconcile-lookback.example",
      preset: "maximum_ai_visibility",
      monitoringState: "active",
      monitoringFrequency: "weekly",
      consecutiveFailureCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    const oldObservedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    await db.insert(schema.domainChangeEvents).values({
      id: crypto.randomUUID(),
      domainId,
      eventType: "website_policy_change",
      changeOrigin: "website_policy",
      attentionLevel: "high_attention",
      observedAt: oldObservedAt,
      previousScanId: null,
      currentScanId: null,
      previousRegistryVersionId: null,
      currentRegistryVersionId: null,
      affectedPurposesJson: "[]",
      findingCountsJson: "{}",
      summary: "Old event outside the reconciliation lookback window.",
      detailsJson: JSON.stringify({ findingLifecycle: [] }),
      completeness: "complete",
      fingerprint: crypto.randomUUID(),
      modelVersion: "1",
      createdAt: oldObservedAt,
    });

    const result = await reconcileMissingPolicyChangeNotifications(db, new Date(), {
      lookbackMinutes: 60,
    });
    expect(result.created).toBe(0);

    const notifications = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, userId));
    expect(notifications).toHaveLength(0);
  });

  it("reconciliation does not recreate a notification for a domain that was since deleted", async () => {
    const userId = await insertUser(db);
    const domainId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.insert(schema.domains).values({
      id: domainId,
      ownerUserId: userId,
      displayName: "reconcile-deleted.example",
      canonicalOrigin: "https://reconcile-deleted.example",
      originalInput: "reconcile-deleted.example",
      preset: "maximum_ai_visibility",
      monitoringState: "active",
      monitoringFrequency: "weekly",
      consecutiveFailureCount: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: now,
    });

    await db.insert(schema.domainChangeEvents).values({
      id: crypto.randomUUID(),
      domainId,
      eventType: "website_policy_change",
      changeOrigin: "website_policy",
      attentionLevel: "high_attention",
      observedAt: now,
      previousScanId: null,
      currentScanId: null,
      previousRegistryVersionId: null,
      currentRegistryVersionId: null,
      affectedPurposesJson: "[]",
      findingCountsJson: "{}",
      summary: "Event for a domain that is now deleted.",
      detailsJson: JSON.stringify({ findingLifecycle: [] }),
      completeness: "complete",
      fingerprint: crypto.randomUUID(),
      modelVersion: "1",
      createdAt: now,
    });

    const result = await reconcileMissingPolicyChangeNotifications(db, new Date());
    expect(result.created).toBe(0);
  });
});
