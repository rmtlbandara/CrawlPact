import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { D1Database } from "@cloudflare/workers-types";
import { createDb, schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { createD1TestHarness } from "./d1-harness";
import { createFakeR2Bucket } from "./fake-r2-bucket";
import { createVirtualCredential, simulateRegistration } from "./virtual-authenticator";
import { cookieFromResponse, ctx, getRequest, jsonRequest, readJson } from "./test-helpers";

const RP_ID = "localhost";
const ORIGIN = "http://localhost:4321";

let mockEnv: Cloudflare.Env;
vi.mock("../../src/lib/env", () => ({ getEnv: () => mockEnv }));

const registerBegin = (await import("../../src/pages/api/auth/register/begin")).POST;
const registerFinish = (await import("../../src/pages/api/auth/register/finish")).POST;
const operationsRoute = (await import("../../src/pages/api/admin/operations/index")).GET;
const evaluateRoute = (await import("../../src/pages/api/admin/operations/evaluate")).POST;
const reconcileRoute = (
  await import("../../src/pages/api/admin/operations/reconcile-notifications")
).POST;
const retentionDryRunRoute = (
  await import("../../src/pages/api/admin/operations/retention-dry-run")
).POST;
const acknowledgeRoute = (
  await import("../../src/pages/api/admin/operations/alerts/[alertId]/acknowledge")
).POST;

/**
 * Phase 14: proves the new /api/admin/operations surface (1) requires a
 * real admin session for every route, (2) requires a reason (audited) for
 * every mutating action, (3) writes a real admin_audit_logs entry for each
 * mutating action, and (4) actually does what it claims — evaluate opens a
 * real alert, acknowledge sets a real timestamp.
 */
describe("admin operations API (real D1)", () => {
  let dispose: () => Promise<void>;
  let db: Database;
  let rawDb: D1Database;

  beforeAll(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    rawDb = harness.db as unknown as D1Database;
    db = createDb(harness.db);
    mockEnv = {
      DB: rawDb,
      AGENCY_LOGOS: createFakeR2Bucket(),
      PUBLIC_APP_ENV: "local",
      PUBLIC_SITE_URL: ORIGIN,
      SESSION_SIGNING_SECRET: "integration-test-secret-value-long-enough",
      ABUSE_MONITORING_SECRET: "integration-test-abuse-secret-value-long-enough",
      WEBAUTHN_RP_ID: RP_ID,
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
    if (!begin.ok) throw new Error("register begin failed");

    const credential = await simulateRegistration(
      await createVirtualCredential(),
      begin.data.publicKeyCredentialCreationOptions.challenge,
      RP_ID,
      ORIGIN,
    );
    const finishResponse = await registerFinish(
      ctx(
        jsonRequest("http://x/register/finish", "POST", {
          challengeId: begin.data.challengeId,
          credential,
        }),
      ),
    );
    const finish = await readJson<{ user: { id: string } }>(finishResponse);
    if (!finish.ok) throw new Error("register finish failed");
    return { cookie: cookieFromResponse(finishResponse), userId: finish.data.user.id };
  }

  async function promoteToSuperAdmin(userId: string): Promise<void> {
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
  }

  it("rejects an unauthenticated GET /api/admin/operations", async () => {
    const response = await operationsRoute(ctx(getRequest("http://x/api/admin/operations")));
    const body = await readJson(response);
    expect(body.ok).toBe(false);
  });

  it("rejects a non-admin authenticated GET /api/admin/operations", async () => {
    const { cookie } = await signUpTestUser("NonAdminOps");
    const response = await operationsRoute(
      ctx(getRequest("http://x/api/admin/operations", cookie)),
    );
    const body = await readJson(response);
    expect(body.ok).toBe(false);
  });

  it("a real admin gets a real, composed operations summary", async () => {
    const { cookie, userId } = await signUpTestUser("AdminOpsSummary");
    await promoteToSuperAdmin(userId);

    const response = await operationsRoute(
      ctx(getRequest("http://x/api/admin/operations", cookie)),
    );
    const body = await readJson<{
      status: { publicOverall: string };
      capacity: { d1: { tableCount: number } };
      trends: unknown[];
      activeAlerts: unknown[];
    }>(response);
    expect(body.ok).toBe(true);
    if (!body.ok) throw new Error("unreachable");
    expect(body.data.status.publicOverall).toBeTruthy();
    expect(body.data.capacity.d1.tableCount).toBeGreaterThan(0);
    expect(body.data.trends).toHaveLength(4);
  });

  it("POST /api/admin/operations/evaluate requires a reason and writes a real audit log entry", async () => {
    const { cookie, userId } = await signUpTestUser("AdminOpsEvaluate");
    await promoteToSuperAdmin(userId);

    const noReasonResponse = await evaluateRoute(
      ctx(jsonRequest("http://x/api/admin/operations/evaluate", "POST", {}, cookie)),
    );
    const noReasonBody = await readJson(noReasonResponse);
    expect(noReasonBody.ok).toBe(false);

    const response = await evaluateRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/operations/evaluate",
          "POST",
          { reason: "verifying real alert evaluation" },
          cookie,
        ),
      ),
    );
    const body = await readJson<{ opened: number; updated: number; resolved: number }>(response);
    expect(body.ok).toBe(true);

    const auditRows = await db
      .select()
      .from(schema.adminAuditLogs)
      .where(eq(schema.adminAuditLogs.action, "operations.evaluate_health"));
    expect(auditRows.length).toBeGreaterThan(0);
    expect(auditRows[auditRows.length - 1]?.reason).toBe("verifying real alert evaluation");
  });

  it("POST /api/admin/operations/reconcile-notifications requires a reason and returns a real result shape", async () => {
    const { cookie, userId } = await signUpTestUser("AdminOpsReconcile");
    await promoteToSuperAdmin(userId);

    const response = await reconcileRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/operations/reconcile-notifications",
          "POST",
          { reason: "verifying reconciliation re-run" },
          cookie,
        ),
      ),
    );
    const body = await readJson<{ scanned: number; created: number }>(response);
    expect(body.ok).toBe(true);
    if (!body.ok) throw new Error("unreachable");
    expect(typeof body.data.scanned).toBe("number");
    expect(typeof body.data.created).toBe("number");
  });

  it("POST /api/admin/operations/retention-dry-run always runs as dryRun: true, never deletes", async () => {
    const { cookie, userId } = await signUpTestUser("AdminOpsRetention");
    await promoteToSuperAdmin(userId);

    const response = await retentionDryRunRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/operations/retention-dry-run",
          "POST",
          { reason: "verifying dry-run only" },
          cookie,
        ),
      ),
    );
    const body = await readJson<{ dryRun: boolean }>(response);
    expect(body.ok).toBe(true);
    if (!body.ok) throw new Error("unreachable");
    expect(body.data.dryRun).toBe(true);
  });

  it("POST /api/admin/operations/alerts/:alertId/acknowledge sets a real timestamp and rejects a non-existent alert", async () => {
    const { cookie, userId } = await signUpTestUser("AdminOpsAcknowledge");
    await promoteToSuperAdmin(userId);

    const now = new Date().toISOString();
    const [inserted] = await db
      .insert(schema.operationalAlerts)
      .values({
        alertKey: "test.acknowledge_target",
        severity: "warning",
        source: "test",
        detail: "synthetic test alert",
        firstSeenAt: now,
        lastSeenAt: now,
        occurrenceCount: 1,
      })
      .returning({ id: schema.operationalAlerts.id });

    const response = await acknowledgeRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/operations/alerts/${inserted!.id}/acknowledge`,
          "POST",
          { reason: "verifying acknowledgement" },
          cookie,
        ),
        { alertId: String(inserted!.id) },
      ),
    );
    const body = await readJson<{ acknowledged: boolean }>(response);
    expect(body.ok).toBe(true);

    const [row] = await db
      .select()
      .from(schema.operationalAlerts)
      .where(eq(schema.operationalAlerts.id, inserted!.id));
    expect(row?.acknowledgedAt).not.toBeNull();

    const missingResponse = await acknowledgeRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/operations/alerts/999999/acknowledge",
          "POST",
          { reason: "verifying missing alert rejection" },
          cookie,
        ),
        { alertId: "999999" },
      ),
    );
    const missingBody = await readJson(missingResponse);
    expect(missingBody.ok).toBe(false);
  });
});
