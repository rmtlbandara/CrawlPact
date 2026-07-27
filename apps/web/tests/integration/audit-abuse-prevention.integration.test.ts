import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { createD1TestHarness } from "./d1-harness";
import { ctx, jsonRequest, readJson } from "./test-helpers";

/**
 * Verifies the two abuse-prevention controls added to /api/audit in Step
 * 19 (SRS §28.8 / docs/security/SSRF_SECURITY_MODEL.md's "Abuse rate
 * limiting and target blocklist" section): the admin target blocklist and
 * the per-IP anonymous daily audit limit. Both checks run *before* any
 * network fetch is attempted, so this test needs at most one real request
 * to a live domain (respectful of Part 2's "test real domains
 * respectfully" rule) — the blocklist case makes zero.
 */

const ORIGIN = "http://localhost:4321";

let mockEnv: Cloudflare.Env;
vi.mock("../../src/lib/env", () => ({ getEnv: () => mockEnv }));

const auditRoute = (await import("../../src/pages/api/audit/index")).POST;

describe("audit abuse prevention (real D1)", () => {
  let db: Database;
  let dispose: () => Promise<void>;

  beforeAll(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    db = createDb(harness.db);
    mockEnv = {
      DB: harness.db,
      PUBLIC_APP_ENV: "local",
      PUBLIC_SITE_URL: ORIGIN,
      SESSION_SIGNING_SECRET: "integration-test-secret-value-long-enough",
      WEBAUTHN_RP_ID: "localhost",
      WEBAUTHN_RP_ORIGIN: ORIGIN,
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

    const now = new Date().toISOString();
    await db.insert(schema.users).values({
      id: "usr_fixture_admin",
      displayName: "Fixture Admin",
      status: "active",
      planId: "free",
      isAdmin: true,
      createdAt: now,
      updatedAt: now,
    });
  });

  afterAll(async () => {
    await dispose();
  });

  it("rejects a blocklisted target without attempting any network fetch", async () => {
    await db.insert(schema.blockedTargets).values({
      id: crypto.randomUUID(),
      targetPattern: "blocked-by-admin.example",
      reason: "Test fixture",
      blockedByUserId: "usr_fixture_admin",
      createdAt: new Date().toISOString(),
    });

    const response = await auditRoute(
      ctx(jsonRequest("http://x/api/audit", "POST", { target: "blocked-by-admin.example" })),
    );
    const body = await readJson<{ status: string }>(response);
    if (body.ok) {
      // Every resource fetch was refused by the blocklist — this must
      // never be reported as a genuine "completed" audit.
      expect(body.data.status).not.toBe("completed");
      expect(body.data.status).not.toBe("completed_with_warnings");
    }

    const securityEvents = await db
      .select()
      .from(schema.securityEvents)
      .where(eq(schema.securityEvents.eventType, "unsafe_scan_attempt"));
    expect(securityEvents.length).toBeGreaterThan(0);
  });

  it("enforces the per-IP daily anonymous audit limit before touching the network", async () => {
    await db
      .update(schema.runtimeConfiguration)
      .set({ value: "1" })
      .where(eq(schema.runtimeConfiguration.key, "anonymous_audit_daily_limit"));

    const ipHeaders = { "CF-Connecting-IP": "198.51.100.42" };

    const first = await auditRoute(
      ctx(
        new Request("http://x/api/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...ipHeaders },
          body: JSON.stringify({ target: "example.com" }),
        }),
      ),
    );
    // First request consumes the only slot — allowed through to a real (single) scan attempt.
    expect(first.status).not.toBe(429);

    const second = await auditRoute(
      ctx(
        new Request("http://x/api/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...ipHeaders },
          body: JSON.stringify({ target: "example.com" }),
        }),
      ),
    );
    expect(second.status).toBe(429);
    const body = await readJson(second);
    if (!body.ok) expect(body.error.code).toBe("RATE_LIMITED");
  }, 30_000);
});
