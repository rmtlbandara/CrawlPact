import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { createDb, schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { createD1TestHarness } from "./d1-harness";
import { createFakeR2Bucket } from "./fake-r2-bucket";
import { createVirtualCredential, simulateRegistration } from "./virtual-authenticator";
import { cookieFromResponse, ctx, jsonRequest, readJson } from "./test-helpers";

const RP_ID = "localhost";
const ORIGIN = "http://localhost:4321";

let mockEnv: Cloudflare.Env;
vi.mock("../../src/lib/env", () => ({ getEnv: () => mockEnv }));

const registerBegin = (await import("../../src/pages/api/auth/register/begin")).POST;
const registerFinish = (await import("../../src/pages/api/auth/register/finish")).POST;
const capacityRoute = (await import("../../src/pages/api/admin/capacity")).GET;

type CapacitySnapshot = Awaited<
  ReturnType<(typeof import("../../src/lib/admin/capacity"))["getOperationalCapacitySnapshot"]>
>;

/**
 * Phase 11, Stage 11H: proves the operational capacity view returns real,
 * live numbers from real D1/R2 state — not placeholders — and that the
 * metrics this phase deliberately could not compute from inside a Worker
 * (Cloudflare plan, Worker CPU-limit errors, bundle size) are honestly
 * reported as `null` rather than faked, matching CLAUDE.md's "never
 * present fabricated data as a real outcome" rule.
 */
describe("admin operational capacity view (real D1 + fake R2)", () => {
  let dispose: () => Promise<void>;
  let db: Database;
  let rawDb: D1Database;

  beforeAll(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    rawDb = harness.db as unknown as D1Database;
    db = createDb(harness.db);
    mockEnv = {
      DB: harness.db as unknown as D1Database,
      AGENCY_LOGOS: createFakeR2Bucket(),
      PUBLIC_APP_ENV: "local",
      PUBLIC_SITE_URL: ORIGIN,
      SESSION_SIGNING_SECRET: "integration-test-secret-value-long-enough",
      WEBAUTHN_RP_ID: RP_ID,
      WEBAUTHN_RP_ORIGIN: ORIGIN,
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

  async function signUpAndPromoteAdmin(displayName: string): Promise<{ cookie: string }> {
    const beginResponse = await registerBegin(
      ctx(jsonRequest("http://x/register/begin", "POST", { displayName })),
    );
    const begin = await readJson<{
      challengeId: string;
      publicKeyCredentialCreationOptions: { challenge: string };
    }>(beginResponse);
    if (!begin.ok) throw new Error("begin failed");
    const credential = await createVirtualCredential();
    const response = await simulateRegistration(
      credential,
      begin.data.publicKeyCredentialCreationOptions.challenge,
      RP_ID,
      ORIGIN,
    );
    const finishResponse = await registerFinish(
      ctx(
        jsonRequest("http://x/register/finish", "POST", {
          challengeId: begin.data.challengeId,
          credential: response,
        }),
      ),
    );
    const cookie = cookieFromResponse(finishResponse);
    const finishBody = await readJson<{ user: { id: string } }>(finishResponse);
    if (!finishBody.ok) throw new Error("finish failed");
    const userId = finishBody.data.user.id;

    await rawDb.prepare("UPDATE users SET is_admin = 1 WHERE id = ?").bind(userId).run();
    await rawDb
      .prepare(
        `INSERT INTO admin_role_assignments (id, user_id, role_id) VALUES (?, ?, 'super_admin')`,
      )
      .bind(`ara_${userId}`, userId)
      .run();
    await rawDb
      .prepare("UPDATE sessions SET is_admin_session = 1 WHERE user_id = ?")
      .bind(userId)
      .run();
    return { cookie };
  }

  it("rejects a non-admin session", async () => {
    const beginResponse = await registerBegin(
      ctx(jsonRequest("http://x/register/begin", "POST", { displayName: "Regular User" })),
    );
    const begin = await readJson<{
      challengeId: string;
      publicKeyCredentialCreationOptions: { challenge: string };
    }>(beginResponse);
    if (!begin.ok) throw new Error("begin failed");
    const credential = await createVirtualCredential();
    const response = await simulateRegistration(
      credential,
      begin.data.publicKeyCredentialCreationOptions.challenge,
      RP_ID,
      ORIGIN,
    );
    const finishResponse = await registerFinish(
      ctx(
        jsonRequest("http://x/register/finish", "POST", {
          challengeId: begin.data.challengeId,
          credential: response,
        }),
      ),
    );
    const cookie = cookieFromResponse(finishResponse);

    const capacityResponse = await capacityRoute(
      ctx(jsonRequest("http://x/api/admin/capacity", "GET", undefined, cookie)),
    );
    expect(capacityResponse.status).toBeGreaterThanOrEqual(400);
  });

  it("returns real, current D1/R2 numbers, with the not-obtainable-from-a-Worker metrics honestly null", async () => {
    const now = new Date().toISOString();
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({
      id: userId,
      displayName: "Capacity Test User",
      status: "active",
      planId: "free",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.scans).values({
      id: crypto.randomUUID(),
      domainId: null,
      triggeredBy: "anonymous",
      targetInput: "https://example.com",
      canonicalOrigin: "https://example.com",
      status: "completed",
      scoreState: "scored",
      score: 80,
      externalRequestCount: 1,
      startedAt: now,
      completedAt: now,
    });

    const { cookie } = await signUpAndPromoteAdmin("Capacity Admin");
    const response = await capacityRoute(
      ctx(jsonRequest("http://x/api/admin/capacity", "GET", undefined, cookie)),
    );
    const body = await readJson<CapacitySnapshot>(response);
    if (!body.ok) throw new Error("capacity request failed: " + JSON.stringify(body));

    // Real table count.
    expect(body.data.d1.tableCount).toBeGreaterThan(30);

    // Real scan count — at least the one just inserted plus whatever else exists.
    expect(body.data.scans.last24h).toBeGreaterThanOrEqual(1);

    // The metrics this module cannot honestly compute from inside a Worker
    // are reported as null, never a fabricated placeholder — including D1's
    // own size, discovered this phase to be a PRAGMA D1's binding API
    // itself rejects (SQLITE_AUTH), not merely unimplemented here.
    expect(body.data.notAvailableFromThisWorker.cloudflarePlan).toBeNull();
    expect(body.data.notAvailableFromThisWorker.workerCpuLimitErrors).toBeNull();
    expect(body.data.notAvailableFromThisWorker.bundleSizeBytes).toBeNull();
    expect(body.data.notAvailableFromThisWorker.d1SizeBytes).toBeNull();
  });

  it("reflects a real due-monitoring backlog and a real last retention-run status", async () => {
    const now = new Date();
    const ownerUserId = crypto.randomUUID();
    await db.insert(schema.users).values({
      id: ownerUserId,
      displayName: "Monitoring Owner",
      status: "active",
      planId: "pro",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    await db.insert(schema.domains).values({
      id: crypto.randomUUID(),
      ownerUserId,
      displayName: "overdue.example",
      canonicalOrigin: "https://overdue.example",
      originalInput: "overdue.example",
      preset: "maximum_ai_visibility",
      monitoringState: "active",
      monitoringFrequency: "weekly",
      nextScanAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      consecutiveFailureCount: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    await rawDb
      .prepare(
        "INSERT INTO scheduled_job_runs (job_name, cron_expression, status, started_at, completed_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind("data_retention_purge", "0 3 * * *", "completed", now.toISOString(), now.toISOString())
      .run();

    const { cookie } = await signUpAndPromoteAdmin("Monitoring Capacity Admin");
    const response = await capacityRoute(
      ctx(jsonRequest("http://x/api/admin/capacity", "GET", undefined, cookie)),
    );
    const body = await readJson<CapacitySnapshot>(response);
    if (!body.ok) throw new Error("capacity request failed: " + JSON.stringify(body));

    expect(body.data.monitoring.dueNowCount).toBeGreaterThanOrEqual(1);
    expect(body.data.monitoring.oldestOverdueNextScanAt).not.toBeNull();
    expect(body.data.retention.lastRun).not.toBeNull();
    expect(body.data.retention.lastRun?.status).toBe("completed");
  });
});
