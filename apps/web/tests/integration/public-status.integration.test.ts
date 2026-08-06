import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { createD1TestHarness } from "./d1-harness";
import { getComponentHealth } from "../../src/lib/admin/health";
import { getPublicStatus, getStatusOverview } from "../../src/lib/status/public-status";

/**
 * Public Status and Changelog Trust Correction. Proves, against real D1,
 * the exact bug this correction fixes: a stale, unbounded (no time window)
 * webhook-failure count previously escalated the public "Billing and
 * checkout" component to "Degraded performance" indefinitely, with no real
 * current user impact — confirmed live in production before this fix (see
 * the completion report). These tests insert real rows reproducing both
 * the stale-failure case (must NOT degrade the public page) and a genuine
 * recent-failure pattern (must degrade it), so the distinction is enforced
 * by a real, passing test, not just a code comment.
 */
describe("public vs internal status separation (real D1)", () => {
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

  async function insertWebhookEvent(
    id: string,
    status: "failed" | "processed",
    receivedAt: string,
  ): Promise<void> {
    const now = new Date().toISOString();
    await db.insert(schema.webhookEvents).values({
      id,
      paddleEventId: `evt_${id}`,
      eventType: "transaction.created",
      status,
      payloadRedacted: "{}",
      receivedAt,
      occurredAt: receivedAt,
      processedAt: now,
    });
  }

  it("does not let a week-old, already-resolved batch of webhook failures degrade the public page (the real production bug this correction fixes)", async () => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    // 20 old failures — matches the real count found live in production
    // before this fix, all from a single historical incident.
    for (let i = 0; i < 20; i++) {
      await insertWebhookEvent(`stale_fail_${i}`, "failed", weekAgo);
    }

    const health = await getComponentHealth(db);
    const webhookComponent = health.find((c) => c.name === "Paddle webhook processing");
    expect(webhookComponent?.status).toBe("operational");
    expect(webhookComponent?.publicImpact).toBe(false);

    const publicStatus = await getPublicStatus(db);
    const billingComponent = publicStatus.components.find((c) => c.key === "billing_checkout");
    expect(billingComponent?.status).toBe("operational");
    expect(publicStatus.overall).toBe("operational");
  });

  it("does degrade the public page for a genuine recent pattern of webhook failures", async () => {
    const now = new Date().toISOString();
    for (let i = 0; i < 3; i++) {
      await insertWebhookEvent(`recent_fail_${i}`, "failed", now);
    }

    const health = await getComponentHealth(db);
    const webhookComponent = health.find((c) => c.name === "Paddle webhook processing");
    expect(webhookComponent?.status).toBe("degraded");
    expect(webhookComponent?.publicImpact).toBe(true);

    const publicStatus = await getPublicStatus(db);
    const billingComponent = publicStatus.components.find((c) => c.key === "billing_checkout");
    expect(billingComponent?.status).toBe("degraded_performance");
    expect(publicStatus.overall).toBe("degraded_performance");
  });

  // Each of the following three tests creates its own fresh D1 harness
  // (a real Miniflare instance applying every migration) rather than
  // reusing the describe block's shared one — under full-suite parallel
  // load this can exceed vitest's default 5000ms, the same class of flake
  // fixed for the Phase 11 retention test in PR #87; same fix applied here.
  it(
    "keeps a single recent webhook failure internal-only — not yet a confirmed pattern",
    { timeout: 20_000 },
    async () => {
      const harness = await createD1TestHarness();
      const isolatedDb = createDb(harness.db);
      try {
        await isolatedDb.insert(schema.webhookEvents).values({
          id: "single_recent_fail",
          paddleEventId: "evt_single",
          eventType: "transaction.created",
          status: "failed",
          payloadRedacted: "{}",
          receivedAt: new Date().toISOString(),
          occurredAt: new Date().toISOString(),
          processedAt: new Date().toISOString(),
        });

        const health = await getComponentHealth(isolatedDb);
        const webhookComponent = health.find((c) => c.name === "Paddle webhook processing");
        // Surfaces internally immediately (no safe gradual zone for a real,
        // unresolved error)...
        expect(webhookComponent?.status).toBe("degraded");
        // ...but is not yet treated as confirmed public impact.
        expect(webhookComponent?.publicImpact).toBe(false);

        const publicStatus = await getPublicStatus(isolatedDb);
        const billingComponent = publicStatus.components.find((c) => c.key === "billing_checkout");
        expect(billingComponent?.status).toBe("operational");
      } finally {
        await harness.dispose();
      }
    },
  );

  it(
    "computes a real Super Admin overview with both public and internal status side by side, plus an internal-warning count the public page never shows",
    { timeout: 20_000 },
    async () => {
      const harness = await createD1TestHarness();
      const isolatedDb = createDb(harness.db);
      try {
        // A stale (7-day-old) monitoring-sweep failure — internal-only concern.
        await harness.db
          .prepare(
            "INSERT INTO scheduled_job_runs (job_name, status, started_at, completed_at) VALUES ('monitoring_sweep', 'failed', ?, ?)",
          )
          .bind(
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          )
          .run();

        const overview = await getStatusOverview(isolatedDb);
        expect(overview.publicOverall).toBe("operational");
        expect(overview.internalOverall).toBe("degraded");
        expect(overview.hasPublicImpact).toBe(false);
        expect(overview.internalWarningCount).toBeGreaterThanOrEqual(1);

        const monitoringComponent = overview.components.find(
          (c) => c.key === "scheduled_monitoring",
        );
        expect(monitoringComponent?.publicStatus).toBe("operational");
        expect(monitoringComponent?.internalStatus).toBe("degraded");
        expect(monitoringComponent?.publicImpact).toBe(false);
        expect(monitoringComponent?.internalReason).toContain("failed");
        expect(monitoringComponent?.verificationSource).toBeTruthy();
      } finally {
        await harness.dispose();
      }
    },
  );

  it(
    "still escalates the public page for a real active incident, regardless of internal-only signals",
    { timeout: 20_000 },
    async () => {
      const harness = await createD1TestHarness();
      const isolatedDb = createDb(harness.db);
      try {
        const now = new Date().toISOString();
        await isolatedDb.insert(schema.incidents).values({
          id: "inc_billing_real",
          title: "Checkout failing for new subscriptions",
          publicSummary: "New subscription checkouts are currently failing.",
          severity: "major",
          status: "investigating",
          isPublic: true,
          isScheduledMaintenance: false,
          affectedComponents: JSON.stringify(["billing_checkout"]),
          startsAt: now,
          resolvedAt: null,
          createdAt: now,
          updatedAt: now,
        });

        const publicStatus = await getPublicStatus(isolatedDb);
        const billingComponent = publicStatus.components.find((c) => c.key === "billing_checkout");
        expect(billingComponent?.status).toBe("partial_outage");
        expect(publicStatus.overall).toBe("partial_outage");
        expect(publicStatus.currentIncidents).toHaveLength(1);

        const overview = await getStatusOverview(isolatedDb);
        expect(overview.hasPublicImpact).toBe(true);
        expect(overview.activePublicIncidentCount).toBe(1);
        const billingOverview = overview.components.find((c) => c.key === "billing_checkout");
        expect(billingOverview?.activeIncident?.title).toBe(
          "Checkout failing for new subscriptions",
        );
      } finally {
        await harness.dispose();
      }
    },
  );
});
