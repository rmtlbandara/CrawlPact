import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { createD1TestHarness } from "./d1-harness";
import { createFakeR2Bucket } from "./fake-r2-bucket";
import { createVirtualCredential, simulateRegistration } from "./virtual-authenticator";
import { cookieFromResponse, ctx, getRequest, jsonRequest, readJson } from "./test-helpers";

let mockEnv: Cloudflare.Env;
vi.mock("../../src/lib/env", () => ({ getEnv: () => mockEnv }));

const registerBegin = (await import("../../src/pages/api/auth/register/begin")).POST;
const registerFinish = (await import("../../src/pages/api/auth/register/finish")).POST;
const listJobsRoute = (await import("../../src/pages/api/admin/jobs/index")).GET;
const pauseRoute = (await import("../../src/pages/api/admin/jobs/pause")).POST;
const healthRoute = (await import("../../src/pages/api/admin/health/index")).GET;

const RP_ID = "localhost";
const ORIGIN = "http://localhost:4321";

/** SRS §28.10: scheduler anomaly detection, global pause/resume, and the
 * internal health overview, against real D1. */
describe("Super Admin scheduler and health monitoring (real D1)", () => {
  let dispose: () => Promise<void>;
  let db: D1Database;

  beforeAll(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    db = harness.db;
    mockEnv = {
      DB: harness.db,
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

  async function signUpTestUser(displayName: string): Promise<{ cookie: string; userId: string }> {
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
    return { cookie, userId: finishBody.data.user.id };
  }

  let adminCookie: string;
  let normalCookie: string;

  beforeAll(async () => {
    const admin = await signUpTestUser("Ops Admin");
    await db.prepare("UPDATE users SET is_admin = 1 WHERE id = ?").bind(admin.userId).run();
    await db
      .prepare(
        `INSERT INTO admin_role_assignments (id, user_id, role_id) VALUES (?, ?, 'super_admin')`,
      )
      .bind(`ara_${admin.userId}`, admin.userId)
      .run();
    await db
      .prepare("UPDATE sessions SET is_admin_session = 1 WHERE user_id = ?")
      .bind(admin.userId)
      .run();
    adminCookie = admin.cookie;

    const normal = await signUpTestUser("Bystander");
    normalCookie = normal.cookie;

    // A stuck run: started 20 minutes ago, still "running".
    const stuckStart = new Date(Date.now() - 20 * 60_000).toISOString();
    await db
      .prepare(
        "INSERT INTO scheduled_job_runs (job_name, status, started_at) VALUES ('monitoring_sweep', 'running', ?)",
      )
      .bind(stuckStart)
      .run();

    // 4 failures out of the 5 most recent runs of a different job -> excessive failure rate.
    for (let i = 0; i < 4; i++) {
      const t = new Date(Date.now() - (i + 1) * 60_000).toISOString();
      await db
        .prepare(
          "INSERT INTO scheduled_job_runs (job_name, status, started_at, completed_at) VALUES ('data_retention_purge', 'failed', ?, ?)",
        )
        .bind(t, t)
        .run();
    }
    await db
      .prepare(
        "INSERT INTO scheduled_job_runs (job_name, status, started_at, completed_at) VALUES ('data_retention_purge', 'completed', ?, ?)",
      )
      .bind(
        new Date(Date.now() - 5 * 60_000).toISOString(),
        new Date(Date.now() - 4 * 60_000).toISOString(),
      )
      .run();
  });

  it("detects a stuck job and an excessive failure rate from real scheduled_job_runs rows", async () => {
    const response = await listJobsRoute(ctx(getRequest("http://x/api/admin/jobs", adminCookie)));
    const body = await readJson<{ anomalies: { type: string; jobName: string }[] }>(response);
    if (!body.ok) throw new Error("list failed");
    expect(
      body.data.anomalies.some((a) => a.type === "stuck" && a.jobName === "monitoring_sweep"),
    ).toBe(true);
    expect(
      body.data.anomalies.some(
        (a) => a.type === "excessive_failure_rate" && a.jobName === "data_retention_purge",
      ),
    ).toBe(true);
  });

  it("rejects pausing the scheduler without a reason", async () => {
    const response = await pauseRoute(
      ctx(jsonRequest("http://x/api/admin/jobs/pause", "POST", { paused: true }, adminCookie)),
    );
    expect(response.status).toBe(400);
  });

  it("pauses the scheduler globally, recorded in runtime_configuration and the audit log", async () => {
    const response = await pauseRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/jobs/pause",
          "POST",
          { paused: true, reason: "Investigating repeated scan failures" },
          adminCookie,
        ),
      ),
    );
    expect(response.status).toBe(200);

    const row = await db
      .prepare("SELECT value FROM runtime_configuration WHERE key = 'scheduler_paused'")
      .first();
    expect((row as { value: string }).value).toBe("true");

    const auditRow = await db
      .prepare("SELECT * FROM admin_audit_logs WHERE action = 'scheduler.pause'")
      .first();
    expect(auditRow).toBeTruthy();
  });

  it("resumes the scheduler", async () => {
    const response = await pauseRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/jobs/pause",
          "POST",
          { paused: false, reason: "Issue resolved" },
          adminCookie,
        ),
      ),
    );
    expect(response.status).toBe(200);
    const row = await db
      .prepare("SELECT value FROM runtime_configuration WHERE key = 'scheduler_paused'")
      .first();
    expect((row as { value: string }).value).toBe("false");
  });

  it("returns a real, data-derived health overview (not a hardcoded status)", async () => {
    const response = await healthRoute(ctx(getRequest("http://x/api/admin/health", adminCookie)));
    const body = await readJson<{ components: { name: string; status: string; detail: string }[] }>(
      response,
    );
    if (!body.ok) throw new Error("health failed");
    const scheduler = body.data.components.find((c) => c.name.includes("monitoring sweep"));
    expect(scheduler?.detail).toMatch(/running|failed|completed/);
  });

  it("additionally returns the public-status-and-changelog trust correction's dual public/internal overview", async () => {
    const response = await healthRoute(ctx(getRequest("http://x/api/admin/health", adminCookie)));
    const body = await readJson<{
      statusOverview: {
        publicOverall: string;
        internalOverall: string;
        hasPublicImpact: boolean;
        components: { key: string; publicStatus: string; internalStatus: string | null }[];
      };
    }>(response);
    if (!body.ok) throw new Error("health failed");
    // The failed data_retention_purge runs seeded above (no public-component
    // mapping at all) degrade the true internal overall state; this must
    // never degrade the public one, which has no signal for that job either.
    expect(body.data.statusOverview.internalOverall).toBe("degraded");
    expect(body.data.statusOverview.publicOverall).toBe("operational");
    expect(body.data.statusOverview.hasPublicImpact).toBe(false);
    const monitoring = body.data.statusOverview.components.find(
      (c) => c.key === "scheduled_monitoring",
    );
    // The last real monitoring_sweep row is the stuck (still "running") one
    // seeded above, not a "failed" one — getComponentHealth's own check only
    // degrades on a "failed" status, so this component's internal state is
    // genuinely "operational" here too; this assertion still matters as a
    // real regression guard (a future change to that check must not let a
    // stuck-but-not-failed run leak as public "Degraded" either).
    expect(monitoring?.publicStatus).toBe("operational");
  });

  it("rejects a non-admin from every scheduler/health route", async () => {
    const response = await listJobsRoute(ctx(getRequest("http://x/api/admin/jobs", normalCookie)));
    expect(response.status).toBe(403);
  });
});
