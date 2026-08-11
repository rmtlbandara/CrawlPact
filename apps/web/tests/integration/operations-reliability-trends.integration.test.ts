import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { createD1TestHarness } from "./d1-harness";

// operations.ts -> capacity.ts -> target-abuse.ts -> env.ts imports
// `cloudflare:workers`, unavailable outside a real Workers runtime — same
// shim admin-capacity.integration.test.ts uses. getReliabilityTrends()
// itself never calls getEnv(), but the module-level import chain still
// needs to resolve.
vi.mock("../../src/lib/env", () => ({ getEnv: () => ({}) }));

const { getReliabilityTrends } = await import("../../src/lib/admin/operations");

/**
 * Phase 14: proves the reliability-trend ratios are computed from real,
 * window-scoped D1 counts (never fabricated), and that a zero-denominator
 * window renders as "insufficient data" (`percent: null`) rather than a
 * misleading bare percentage — the same low-volume-data rule Phase 13
 * established for product analytics.
 */
describe("getReliabilityTrends (real D1)", () => {
  let dispose: () => Promise<void>;
  let db: Database;

  beforeAll(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    db = createDb(harness.db);
  });

  afterAll(async () => {
    await dispose();
  });

  it("reports insufficient data (null percent) for every metric with no rows in the window", async () => {
    const trends = await getReliabilityTrends(db, 24);
    expect(trends.monitoringTimeliness).toEqual({ numerator: 0, denominator: 0, percent: null });
    expect(trends.jobReliability).toEqual({ numerator: 0, denominator: 0, percent: null });
    expect(trends.billingProcessingReliability).toEqual({
      numerator: 0,
      denominator: 0,
      percent: null,
    });
    expect(trends.authFailureCount).toBe(0);
  });

  it("computes a real ratio from scheduled_job_runs within the window, excluding rows outside it", async () => {
    const now = new Date();
    const withinWindow = new Date(now.getTime() - 10 * 60 * 60 * 1000).toISOString(); // 10h ago
    const outsideWindow = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(); // 48h ago

    await db.insert(schema.scheduledJobRuns).values([
      {
        jobName: "monitoring_sweep",
        status: "completed",
        startedAt: withinWindow,
        completedAt: withinWindow,
      },
      {
        jobName: "monitoring_sweep",
        status: "completed",
        startedAt: withinWindow,
        completedAt: withinWindow,
      },
      {
        jobName: "monitoring_sweep",
        status: "failed",
        startedAt: withinWindow,
        completedAt: withinWindow,
      },
      // Outside the 24h window — must not affect the ratio.
      {
        jobName: "monitoring_sweep",
        status: "failed",
        startedAt: outsideWindow,
        completedAt: outsideWindow,
      },
    ]);

    const trends = await getReliabilityTrends(db, 24, now);
    expect(trends.jobReliability).toEqual({ numerator: 2, denominator: 3, percent: 66.7 });
  });

  it("computes billing processing reliability from webhook_events within the window", async () => {
    const now = new Date();
    const withinWindow = new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString();

    await db.insert(schema.webhookEvents).values([
      {
        id: "wh_trend_1",
        paddleEventId: "evt_trend_1",
        eventType: "subscription.updated",
        status: "processed",
        payloadRedacted: "{}",
        receivedAt: withinWindow,
        occurredAt: withinWindow,
      },
      {
        id: "wh_trend_2",
        paddleEventId: "evt_trend_2",
        eventType: "subscription.updated",
        status: "failed",
        payloadRedacted: "{}",
        receivedAt: withinWindow,
        occurredAt: withinWindow,
      },
    ]);

    const trends = await getReliabilityTrends(db, 24, now);
    expect(trends.billingProcessingReliability).toEqual({
      numerator: 1,
      denominator: 2,
      percent: 50,
    });
  });
});
