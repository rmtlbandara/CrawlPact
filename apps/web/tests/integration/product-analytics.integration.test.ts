import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { createD1TestHarness } from "./d1-harness";
import { getProductAnalyticsSnapshot } from "../../src/lib/admin/product-analytics";

/**
 * Phase 13: proves the Super Admin product-measurement dashboard's
 * aggregation queries return real, correct numbers from real D1 state —
 * never fabricated or placeholder data (CLAUDE.md).
 */
describe("product analytics snapshot (real D1)", () => {
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

  it("returns all zeros / null-safe values against an empty database", async () => {
    const snapshot = await getProductAnalyticsSnapshot(db, 30);
    expect(snapshot.executiveSummary.totalAccounts).toBe(0);
    expect(snapshot.executiveSummary.wau).toBe(0);
    expect(snapshot.executiveSummary.auditToSavedDomainConversion.percent).toBeNull();
    expect(snapshot.measurementHealth.lastEventAt).toBeNull();
  });

  it("computes real counts from seeded users, domains, subscriptions, and product events", async () => {
    const now = new Date().toISOString();

    await db.insert(schema.users).values([
      {
        id: "usr_activated",
        displayName: "Activated User",
        status: "active",
        planId: "solo",
        isAdmin: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "usr_free",
        displayName: "Free User",
        status: "active",
        planId: "free",
        isAdmin: false,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await db.insert(schema.domains).values({
      id: "dom_1",
      ownerUserId: "usr_activated",
      displayName: "example.com",
      canonicalOrigin: "https://example.com",
      originalInput: "example.com",
      preset: "maximum_ai_visibility",
      monitoringState: "active",
      monitoringFrequency: "weekly",
      lastScanId: "scan_1",
      consecutiveFailureCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(schema.billingCustomers).values({
      id: "bc_1",
      userId: "usr_activated",
      paddleCustomerId: "ctm_fake_123",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.subscriptions).values({
      id: "sub_1",
      billingCustomerId: "bc_1",
      paddleSubscriptionId: "sub_fake_123",
      planId: "solo",
      status: "active",
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(schema.productEvents).values([
      {
        eventName: "audit_started",
        userId: null,
        anonymousId: null,
        properties: null,
        createdAt: now,
      },
      {
        eventName: "audit_started",
        userId: null,
        anonymousId: null,
        properties: null,
        createdAt: now,
      },
      {
        eventName: "audit_completed",
        userId: null,
        anonymousId: null,
        properties: null,
        createdAt: now,
      },
      {
        eventName: "result_viewed",
        userId: null,
        anonymousId: null,
        properties: null,
        createdAt: now,
      },
      {
        eventName: "domain_saved",
        userId: "usr_activated",
        anonymousId: null,
        properties: null,
        createdAt: now,
      },
      {
        eventName: "saved_domain_opened",
        userId: "usr_activated",
        anonymousId: null,
        properties: null,
        createdAt: now,
      },
      {
        eventName: "analytics_consent_granted",
        userId: null,
        anonymousId: null,
        properties: null,
        createdAt: now,
      },
    ]);

    const snapshot = await getProductAnalyticsSnapshot(db, 30);

    expect(snapshot.executiveSummary.totalAccounts).toBe(2);
    expect(snapshot.executiveSummary.activatedAccounts).toBe(1);
    expect(snapshot.executiveSummary.activePaidAccounts).toBe(1);
    expect(snapshot.executiveSummary.monitoredDomains).toBe(1);
    expect(snapshot.executiveSummary.wau).toBe(1);
    expect(snapshot.executiveSummary.mau).toBe(1);

    expect(snapshot.auditFunnel.auditStarted).toBe(2);
    expect(snapshot.auditFunnel.auditCompleted).toBe(1);
    expect(snapshot.auditFunnel.resultViewed).toBe(1);
    expect(snapshot.auditFunnel.completionRate.percent).toBe(50);

    expect(snapshot.revenue.activeSubscriptionsByPlan.solo).toBe(1);
    expect(snapshot.revenue.estimatedMrrUsdCents).toBeGreaterThan(0);

    expect(snapshot.engagement.domainOpened).toBe(1);
    expect(snapshot.measurementHealth.eventsLast24h).toBe(7);
    expect(snapshot.measurementHealth.consentGrantedLast30d).toBe(1);
    expect(snapshot.measurementHealth.lastEventAt).not.toBeNull();
  });
});
