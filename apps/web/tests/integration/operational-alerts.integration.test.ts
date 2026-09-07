import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { createDb, schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { createD1TestHarness } from "./d1-harness";
import { createFakeR2Bucket } from "./fake-r2-bucket";

// operational-alerts.ts -> capacity.ts -> target-abuse.ts -> env.ts imports
// `cloudflare:workers`, unavailable outside a real Workers runtime — same
// shim admin-capacity.integration.test.ts uses.
let mockEnv: Cloudflare.Env;
vi.mock("../../src/lib/env", () => ({ getEnv: () => mockEnv }));

const {
  acknowledgeOperationalAlert,
  computeAlertCandidates,
  evaluateOperationalAlerts,
  listActiveOperationalAlerts,
  listRecentOperationalAlerts,
} = await import("../../src/lib/admin/operational-alerts");

/**
 * Phase 14: proves the first-party operational-alert model actually
 * deduplicates (one row per persistent condition, not one row per
 * evaluation), correctly resolves when a condition clears, and derives
 * every candidate from real D1 state — never a simulated/fabricated alert.
 */
describe("operational alerts (real D1)", () => {
  let dispose: () => Promise<void>;
  let db: Database;
  let rawDb: D1Database;
  const agencyLogos = createFakeR2Bucket();

  beforeAll(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    rawDb = harness.db as unknown as D1Database;
    db = createDb(harness.db);
    mockEnv = {
      DB: rawDb,
      AGENCY_LOGOS: agencyLogos,
      PUBLIC_APP_ENV: "local",
      PUBLIC_SITE_URL: "http://localhost:4321",
      SESSION_SIGNING_SECRET: "integration-test-secret-value-long-enough",
      ABUSE_MONITORING_SECRET: "integration-test-abuse-secret-value-long-enough",
      WEBAUTHN_RP_ID: "localhost",
      WEBAUTHN_RP_ORIGIN: "http://localhost:4321",
      GOOGLE_CLIENT_ID: "test-client-id.apps.googleusercontent.com",
      PADDLE_API_KEY: "test",
      PADDLE_ENVIRONMENT: "sandbox",
      PADDLE_WEBHOOK_SECRET: "test",
      PADDLE_PRICE_ID_SOLO: "test",
      PADDLE_PRICE_ID_PRO: "test",
      PADDLE_PRICE_ID_AGENCY: "test",
      PUBLIC_PADDLE_CLIENT_TOKEN: "test",
      BILLING_ENABLED: "false",
      AUDIT_ENGINE_ENABLED: "false",
    };
  });

  afterAll(async () => {
    await dispose();
  });

  it("computes no candidates against a clean database", async () => {
    const candidates = await computeAlertCandidates(db, rawDb, agencyLogos);
    expect(candidates).toEqual([]);
  });

  it("computes a billing webhook candidate once 3+ recent failures exist", async () => {
    const now = new Date().toISOString();
    for (let i = 0; i < 3; i++) {
      await db.insert(schema.webhookEvents).values({
        id: `wh_alert_test_${i}`,
        paddleEventId: `evt_alert_test_${i}`,
        eventType: "subscription.updated",
        status: "failed",
        payloadRedacted: "{}",
        receivedAt: now,
        occurredAt: now,
      });
    }
    const candidates = await computeAlertCandidates(db, rawDb, agencyLogos);
    expect(candidates.some((c) => c.alertKey === "billing.webhook_processing_failures")).toBe(true);
  });

  it("computes an auth failure spike candidate once the threshold is exceeded", async () => {
    const now = new Date().toISOString();
    const values = Array.from({ length: 51 }, (_, i) => ({
      eventType: "auth_failure" as const,
      ipHash: `hash_${i}`,
      createdAt: now,
    }));
    for (const value of values) {
      await db.insert(schema.securityEvents).values(value);
    }
    const candidates = await computeAlertCandidates(db, rawDb, agencyLogos);
    const authAlert = candidates.find((c) => c.alertKey === "auth.failure_spike");
    expect(authAlert).toBeDefined();
    expect(authAlert?.severity).toBe("critical");
  });

  it("evaluateOperationalAlerts opens exactly one row per condition, then updates (not duplicates) it on a second run", async () => {
    const first = await evaluateOperationalAlerts(db, rawDb, agencyLogos, new Date());
    expect(first.opened).toBeGreaterThan(0);

    const afterFirst = await listActiveOperationalAlerts(db);
    const webhookAlert = afterFirst.find(
      (a) => a.alertKey === "billing.webhook_processing_failures",
    );
    expect(webhookAlert).toBeDefined();
    expect(webhookAlert?.occurrenceCount).toBe(1);

    const second = await evaluateOperationalAlerts(
      db,
      rawDb,
      agencyLogos,
      new Date(Date.now() + 1000),
    );
    expect(second.opened).toBe(0);
    expect(second.updated).toBeGreaterThan(0);

    const afterSecond = await listActiveOperationalAlerts(db);
    const stillOneRow = afterSecond.filter(
      (a) => a.alertKey === "billing.webhook_processing_failures",
    );
    expect(stillOneRow).toHaveLength(1);
    expect(stillOneRow[0]?.occurrenceCount).toBe(2);
  });

  it("resolves an alert once its underlying condition clears", async () => {
    // Clear the auth-failure condition by aging its events out of the
    // 1-hour window this codebase's own health.ts uses.
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    await db.update(schema.securityEvents).set({ createdAt: twoHoursAgo });

    await evaluateOperationalAlerts(db, rawDb, agencyLogos, new Date(Date.now() + 5000));

    const active = await listActiveOperationalAlerts(db);
    expect(active.some((a) => a.alertKey === "auth.failure_spike")).toBe(false);

    const recent = await listRecentOperationalAlerts(db);
    const resolvedAuthAlert = recent.find((a) => a.alertKey === "auth.failure_spike");
    expect(resolvedAuthAlert?.resolvedAt).not.toBeNull();
  });

  it("acknowledgeOperationalAlert records the acknowledging admin and rejects an already-resolved alert", async () => {
    const now = new Date().toISOString();
    await db.insert(schema.users).values({
      id: "usr_test_admin",
      displayName: "Test Admin",
      status: "active",
      planId: "free",
      isAdmin: true,
      createdAt: now,
      updatedAt: now,
    });

    const active = await listActiveOperationalAlerts(db);
    const target = active.find((a) => a.alertKey === "billing.webhook_processing_failures");
    expect(target).toBeDefined();

    const ok = await acknowledgeOperationalAlert(db, target!.id, "usr_test_admin");
    expect(ok).toBe(true);

    const resolvedAlert = (await listRecentOperationalAlerts(db)).find(
      (a) => a.alertKey === "auth.failure_spike",
    );
    expect(resolvedAlert).toBeDefined();
    const rejected = await acknowledgeOperationalAlert(db, resolvedAlert!.id, "usr_test_admin");
    expect(rejected).toBe(false);
  });
});
