import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { createD1TestHarness } from "./d1-harness";
import { createVirtualCredential, simulateRegistration } from "./virtual-authenticator";
import { cookieFromResponse, ctx, getRequest, jsonRequest, readJson } from "./test-helpers";

let mockEnv: Cloudflare.Env;
vi.mock("../../src/lib/env", () => ({ getEnv: () => mockEnv }));

const registerBegin = (await import("../../src/pages/api/auth/register/begin")).POST;
const registerFinish = (await import("../../src/pages/api/auth/register/finish")).POST;
const createDomainRoute = (await import("../../src/pages/api/domains/index")).POST;
const listDomainsCustomerRoute = (await import("../../src/pages/api/domains/index")).GET;
const listSettingsRoute = (await import("../../src/pages/api/admin/settings/index")).GET;
const updateSettingRoute = (await import("../../src/pages/api/admin/settings/[key]/index")).POST;
const auditRoute = (await import("../../src/pages/api/audit/index")).POST;
const listAdminDomainsRoute = (await import("../../src/pages/api/admin/domains/index")).GET;

const RP_ID = "localhost";
const ORIGIN = "http://localhost:4321";

/** SRS §28.16/§28.17: runtime configuration validation and maintenance-mode
 * enforcement, against real D1. */
describe("Super Admin runtime configuration and maintenance mode (real D1)", () => {
  let dispose: () => Promise<void>;
  let db: D1Database;

  beforeAll(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    db = harness.db;
    mockEnv = {
      DB: harness.db,
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
      AUDIT_ENGINE_ENABLED: "true",
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

    const normal = await signUpTestUser("Regular Customer");
    normalCookie = normal.cookie;
  });

  it("lists runtime configuration with no secrets present", async () => {
    const response = await listSettingsRoute(
      ctx(getRequest("http://x/api/admin/settings", adminCookie)),
    );
    expect(response.status).toBe(200);
    const raw = await response.clone().text();
    expect(raw).not.toContain("PADDLE_API_KEY");
    expect(raw).not.toContain("SESSION_SIGNING_SECRET");
    const body = await readJson<{ key: string }[]>(response);
    if (!body.ok) throw new Error("list failed");
    expect(body.data.some((r) => r.key === "anonymous_audit_daily_limit")).toBe(true);
  });

  it("rejects updating an unknown configuration key", async () => {
    const response = await updateSettingRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/settings/not_a_real_key",
          "POST",
          { value: "123", reason: "testing rejection of unknown keys" },
          adminCookie,
        ),
        { key: "not_a_real_key" },
      ),
    );
    expect(response.status).toBe(400);
  });

  it("rejects a value outside the configured min/max range", async () => {
    const response = await updateSettingRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/settings/anonymous_audit_daily_limit",
          "POST",
          { value: "99999", reason: "testing max-value rejection" },
          adminCookie,
        ),
        { key: "anonymous_audit_daily_limit" },
      ),
    );
    expect(response.status).toBe(400);
    const body = await readJson(response);
    if (body.ok) throw new Error("expected rejection");
    expect(body.error.message).toContain("at most");
  });

  it("accepts a valid value within range, recorded in the audit log", async () => {
    const response = await updateSettingRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/settings/anonymous_audit_daily_limit",
          "POST",
          { value: "50", reason: "Raising the limit for a marketing campaign" },
          adminCookie,
        ),
        { key: "anonymous_audit_daily_limit" },
      ),
    );
    expect(response.status).toBe(200);

    const row = await db
      .prepare("SELECT value FROM runtime_configuration WHERE key = 'anonymous_audit_daily_limit'")
      .first();
    expect((row as { value: string }).value).toBe("50");

    const auditRow = await db
      .prepare("SELECT * FROM admin_audit_logs WHERE action = 'runtime_config.update'")
      .first();
    expect(auditRow).toBeTruthy();
  });

  it("enables maintenance mode, which blocks a customer's mutating request but not an admin's", async () => {
    const enableResponse = await updateSettingRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/settings/maintenance_mode",
          "POST",
          { value: "true", reason: "Testing maintenance mode enforcement" },
          adminCookie,
        ),
        { key: "maintenance_mode" },
      ),
    );
    expect(enableResponse.status).toBe(200);

    const blockedResponse = await createDomainRoute(
      ctx(jsonRequest("http://x/domains", "POST", { target: "example.com" }, normalCookie)),
    );
    expect(blockedResponse.status).toBe(503);
    const blockedBody = await readJson(blockedResponse);
    if (blockedBody.ok) throw new Error("expected maintenance-mode rejection");
    expect(blockedBody.error.code).toBe("MAINTENANCE_MODE_ACTIVE");

    // Read-only customer requests remain allowed.
    const readResponse = await listDomainsCustomerRoute(
      ctx(getRequest("http://x/domains", normalCookie)),
    );
    expect(readResponse.status).toBe(200);

    // The admin's own mutating action (an admin route) is unaffected.
    const adminStillWorks = await listAdminDomainsRoute(
      ctx(getRequest("http://x/api/admin/domains", adminCookie)),
    );
    expect(adminStillWorks.status).toBe(200);
  });

  it("blocks anonymous audits while maintenance mode is active", async () => {
    const response = await auditRoute(
      ctx(jsonRequest("http://x/api/audit", "POST", { target: "example.com" }, undefined)),
    );
    expect(response.status).toBe(503);
    const body = await readJson(response);
    if (body.ok) throw new Error("expected maintenance-mode rejection");
    expect(body.error.code).toBe("MAINTENANCE_MODE_ACTIVE");
  });

  it("disabling maintenance mode restores normal customer access", async () => {
    const disableResponse = await updateSettingRoute(
      ctx(
        jsonRequest(
          "http://x/api/admin/settings/maintenance_mode",
          "POST",
          { value: "false", reason: "Maintenance complete" },
          adminCookie,
        ),
        { key: "maintenance_mode" },
      ),
    );
    expect(disableResponse.status).toBe(200);

    const response = await createDomainRoute(
      ctx(
        jsonRequest("http://x/domains", "POST", { target: "restored.example.com" }, normalCookie),
      ),
    );
    expect(response.status).toBe(201);
  });

  it("rejects a non-admin from the runtime configuration routes", async () => {
    const response = await listSettingsRoute(
      ctx(getRequest("http://x/api/admin/settings", normalCookie)),
    );
    expect(response.status).toBe(403);
  });
});
