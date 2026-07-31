import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { createDb } from "@crawlpact/database";
import { createD1TestHarness } from "./d1-harness";
import { createFakeR2Bucket } from "./fake-r2-bucket";
import { createVirtualCredential, simulateRegistration } from "./virtual-authenticator";
import { cookieFromResponse, ctx, getRequest, jsonRequest, readJson } from "./test-helpers";

let mockEnv: Cloudflare.Env;
vi.mock("../../src/lib/env", () => ({ getEnv: () => mockEnv }));

const registerBegin = (await import("../../src/pages/api/auth/register/begin")).POST;
const registerFinish = (await import("../../src/pages/api/auth/register/finish")).POST;

const listIncidentsRoute = (await import("../../src/pages/api/admin/incidents/index")).GET;
const createIncidentRoute = (await import("../../src/pages/api/admin/incidents/index")).POST;
const postUpdateRoute = (await import("../../src/pages/api/admin/incidents/[incidentId]/updates"))
  .POST;

const { getPublicStatus } = await import("../../src/lib/status/public-status");

const RP_ID = "localhost";
const ORIGIN = "http://localhost:4321";

/** Incident tracking (public status + Super Admin management) — see
 * docs/architecture/INCIDENT_TRACKING_SYSTEM_DESIGN.md. */
describe("Incident tracking (real D1)", () => {
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
  });

  it("rejects incident creation without an admin session", async () => {
    const response = await createIncidentRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/incidents",
          "POST",
          {
            title: "Should fail",
            publicSummary: "n/a",
            severity: "minor",
            affectedComponents: ["website"],
            isScheduledMaintenance: false,
            isPublic: true,
            startsAt: new Date().toISOString(),
            initialStatus: "investigating",
            initialMessage: "n/a",
            reason: "should be rejected",
          },
          normalCookie,
        ),
      ),
    );
    expect(response.status).not.toBe(201);
  });

  it("rejects incident creation without a reason", async () => {
    const response = await createIncidentRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/incidents",
          "POST",
          {
            title: "Should fail",
            publicSummary: "n/a",
            severity: "minor",
            affectedComponents: ["website"],
            isScheduledMaintenance: false,
            isPublic: true,
            startsAt: new Date().toISOString(),
            initialStatus: "investigating",
            initialMessage: "n/a",
            reason: "",
          },
          adminCookie,
        ),
      ),
    );
    expect(response.status).not.toBe(201);
  });

  let publicIncidentId: string;

  it("creates a public incident with its first update, and writes an audit log entry", async () => {
    const response = await createIncidentRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/incidents",
          "POST",
          {
            title: "Elevated scan latency",
            publicSummary: "Some scans are taking longer than usual to complete.",
            severity: "minor",
            affectedComponents: ["audit_scanner"],
            isScheduledMaintenance: false,
            isPublic: true,
            startsAt: new Date().toISOString(),
            initialStatus: "investigating",
            initialMessage: "We are investigating elevated scan latency.",
            reason: "Real customer-facing latency observed",
          },
          adminCookie,
        ),
      ),
    );
    expect(response.status).toBe(201);
    const body = await readJson<{ id: string }>(response);
    if (!body.ok) throw new Error("create failed");
    publicIncidentId = body.data.id;

    const listResponse = await listIncidentsRoute(
      ctx(getRequest("http://x/api/admin/incidents", adminCookie)),
    );
    const list = await readJson<{ id: string; status: string }[]>(listResponse);
    if (!list.ok) throw new Error("list failed");
    expect(list.data.some((i) => i.id === publicIncidentId && i.status === "investigating")).toBe(
      true,
    );

    const auditRow = await db
      .prepare("SELECT action, target FROM admin_audit_logs WHERE action = 'incident.create'")
      .first<{ action: string; target: string }>();
    expect(auditRow?.target).toBe("Elevated scan latency");
  });

  it("appears in the public status computation, escalating the affected component and overall status", async () => {
    const report = await getPublicStatus(createDb(db));
    expect(report.currentIncidents.some((i) => i.id === publicIncidentId)).toBe(true);
    const scannerComponent = report.components.find((c) => c.key === "audit_scanner");
    expect(scannerComponent?.status).toBe("degraded_performance");
    expect(report.overall).toBe("degraded_performance");
  });

  it("posting an update transitions status and sets resolved_at only on resolved", async () => {
    const monitoringResponse = await postUpdateRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/incidents/${publicIncidentId}/updates`,
          "POST",
          {
            status: "monitoring",
            message: "A fix has been applied; monitoring.",
            reason: "Fix deployed",
          },
          adminCookie,
        ),
        { incidentId: publicIncidentId },
      ),
    );
    expect(monitoringResponse.status).toBe(200);

    let row = await db
      .prepare("SELECT status, resolved_at FROM incidents WHERE id = ?")
      .bind(publicIncidentId)
      .first<{ status: string; resolved_at: string | null }>();
    expect(row?.status).toBe("monitoring");
    expect(row?.resolved_at).toBeNull();

    const resolvedResponse = await postUpdateRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/incidents/${publicIncidentId}/updates`,
          "POST",
          {
            status: "resolved",
            message: "Confirmed resolved.",
            reason: "No further latency observed",
          },
          adminCookie,
        ),
        { incidentId: publicIncidentId },
      ),
    );
    expect(resolvedResponse.status).toBe(200);

    row = await db
      .prepare("SELECT status, resolved_at FROM incidents WHERE id = ?")
      .bind(publicIncidentId)
      .first<{ status: string; resolved_at: string | null }>();
    expect(row?.status).toBe("resolved");
    expect(row?.resolved_at).not.toBeNull();
  });

  it("moves a resolved incident out of current incidents and into recently resolved, restoring operational status for that component", async () => {
    const report = await getPublicStatus(createDb(db));
    expect(report.currentIncidents.some((i) => i.id === publicIncidentId)).toBe(false);
    expect(report.recentlyResolved.some((i) => i.id === publicIncidentId)).toBe(true);
    const scannerComponent = report.components.find((c) => c.key === "audit_scanner");
    expect(scannerComponent?.status).toBe("operational");
  });

  it("a non-public incident never appears in the public status computation", async () => {
    const response = await createIncidentRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/incidents",
          "POST",
          {
            title: "Internal draft incident",
            publicSummary: "Draft — not yet ready to publish.",
            severity: "critical",
            affectedComponents: ["billing_checkout"],
            isScheduledMaintenance: false,
            isPublic: false,
            startsAt: new Date().toISOString(),
            initialStatus: "investigating",
            initialMessage: "Drafting.",
            reason: "Drafting an incident before publishing",
          },
          adminCookie,
        ),
      ),
    );
    expect(response.status).toBe(201);

    const report = await getPublicStatus(createDb(db));
    expect(report.currentIncidents.some((i) => i.title === "Internal draft incident")).toBe(false);
    // A critical severity on a non-public incident must not escalate the public overall status.
    const billingComponent = report.components.find((c) => c.key === "billing_checkout");
    expect(billingComponent?.status).not.toBe("major_outage");
  });

  it("a scheduled-maintenance incident is reported as maintenance, not an outage", async () => {
    const response = await createIncidentRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/incidents",
          "POST",
          {
            title: "Planned database maintenance",
            publicSummary: "Brief planned maintenance window.",
            severity: "major",
            affectedComponents: ["dashboard_domains"],
            isScheduledMaintenance: true,
            isPublic: true,
            startsAt: new Date().toISOString(),
            initialStatus: "investigating",
            initialMessage: "Maintenance window scheduled.",
            reason: "Planned maintenance",
          },
          adminCookie,
        ),
      ),
    );
    expect(response.status).toBe(201);

    const report = await getPublicStatus(createDb(db));
    expect(
      report.scheduledMaintenance.some((i) => i.title === "Planned database maintenance"),
    ).toBe(true);
    expect(report.currentIncidents.some((i) => i.title === "Planned database maintenance")).toBe(
      false,
    );
    const dashboardComponent = report.components.find((c) => c.key === "dashboard_domains");
    expect(dashboardComponent?.status).toBe("maintenance");
  });
});
