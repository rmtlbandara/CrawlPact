import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { createD1TestHarness } from "./d1-harness";
import { createFakeR2Bucket } from "./fake-r2-bucket";

/**
 * RISK-022: cross-request target-frequency abuse detection. Detection-only
 * — these tests confirm the aggregation query correctly flags a target seen
 * by many distinct callers, correctly ignores a target seen by only one or
 * few callers (however many times), and that nothing here ever blocks a
 * request — only `getOperationalCapacitySnapshot`'s read-only count changes.
 */

const ORIGIN = "http://localhost:4321";

let mockEnv: Cloudflare.Env;
vi.mock("../../src/lib/env", () => ({ getEnv: () => mockEnv }));

const { hashTarget, recordTargetAbuseObservation, getHighFrequencyTargets } =
  await import("../../src/lib/target-abuse");
const { getOperationalCapacitySnapshot } = await import("../../src/lib/admin/capacity");

describe("target-frequency abuse monitoring (real D1)", () => {
  let db: Database;
  let rawDb: D1Database;
  let dispose: () => Promise<void>;

  beforeAll(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    rawDb = harness.db;
    db = createDb(harness.db);
    mockEnv = {
      DB: harness.db,
      AGENCY_LOGOS: createFakeR2Bucket(),
      PUBLIC_APP_ENV: "local",
      PUBLIC_SITE_URL: ORIGIN,
      SESSION_SIGNING_SECRET: "integration-test-secret-value-long-enough",
      ABUSE_MONITORING_SECRET: "integration-test-abuse-secret-value-long-enough",
      WEBAUTHN_RP_ID: "localhost",
      WEBAUTHN_RP_ORIGIN: ORIGIN,
      GOOGLE_CLIENT_ID: "test-client-id.apps.googleusercontent.com",
      PADDLE_API_KEY: "test",
      PADDLE_ENVIRONMENT: "sandbox",
      PADDLE_WEBHOOK_SECRET: "test",
      PADDLE_PRICE_ID_SOLO: "test",
      PADDLE_PRICE_ID_PRO: "test",
      PADDLE_PRICE_ID_AGENCY: "test",
      PUBLIC_PADDLE_CLIENT_TOKEN: "test",
      BILLING_ENABLED: "false",
      AUDIT_ENGINE_ENABLED: "true",
    };
  });

  afterAll(async () => {
    await dispose();
  });

  it("hashes the same origin to the same key and different origins to different keys", async () => {
    const a1 = await hashTarget("https://example.com");
    const a2 = await hashTarget("https://example.com");
    const b = await hashTarget("https://other-example.com");
    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
    expect(a1).not.toContain("example.com");
  });

  it("does not flag a target hit repeatedly by only a few distinct callers", async () => {
    const targetKey = await hashTarget("https://low-diversity.example");
    for (let i = 0; i < 20; i++) {
      await recordTargetAbuseObservation(db, targetKey, `caller-${i % 3}`);
    }
    const flagged = await getHighFrequencyTargets(db, {
      windowMs: 60 * 60 * 1000,
      minDistinctCallers: 10,
    });
    expect(flagged.find((f) => f.targetKey === targetKey)).toBeUndefined();
  });

  it("flags a target hit by many distinct callers within the window", async () => {
    const targetKey = await hashTarget("https://high-diversity.example");
    for (let i = 0; i < 15; i++) {
      await recordTargetAbuseObservation(db, targetKey, `distinct-caller-${i}`);
    }
    const flagged = await getHighFrequencyTargets(db, {
      windowMs: 60 * 60 * 1000,
      minDistinctCallers: 10,
    });
    const match = flagged.find((f) => f.targetKey === targetKey);
    expect(match).toBeDefined();
    expect(match?.distinctCallerCount).toBe(15);
    expect(match?.observationCount).toBe(15);
  });

  it("excludes observations outside the detection window", async () => {
    const targetKey = await hashTarget("https://old-observations.example");
    const oldTimestamp = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    for (let i = 0; i < 15; i++) {
      await db.insert(schema.targetAbuseObservations).values({
        targetKey,
        callerKey: `old-caller-${i}`,
        observedAt: oldTimestamp,
      });
    }
    const flagged = await getHighFrequencyTargets(db, {
      windowMs: 60 * 60 * 1000,
      minDistinctCallers: 10,
    });
    expect(flagged.find((f) => f.targetKey === targetKey)).toBeUndefined();
  });

  it("surfaces the high-frequency-target count via the admin capacity snapshot, never a raw target or caller", async () => {
    const targetKey = await hashTarget("https://surfaced-via-capacity.example");
    for (let i = 0; i < 12; i++) {
      await recordTargetAbuseObservation(db, targetKey, `capacity-caller-${i}`);
    }
    const snapshot = await getOperationalCapacitySnapshot(db, rawDb, createFakeR2Bucket());
    expect(snapshot.abuseMonitoring.highFrequencyTargetCount).toBeGreaterThanOrEqual(1);
    expect(snapshot.abuseMonitoring.minDistinctCallersThreshold).toBe(10);
    expect(JSON.stringify(snapshot)).not.toContain("surfaced-via-capacity.example");
  });
});
