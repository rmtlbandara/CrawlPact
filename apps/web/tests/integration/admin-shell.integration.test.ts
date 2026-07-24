import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { createD1TestHarness } from "./d1-harness";
import {
  createVirtualCredential,
  simulateAuthentication,
  simulateRegistration,
} from "./virtual-authenticator";
import type { VirtualCredential } from "./virtual-authenticator";
import { cookieFromResponse, ctx, getRequest, jsonRequest, readJson } from "./test-helpers";

let mockEnv: Cloudflare.Env;
vi.mock("../../src/lib/env", () => ({ getEnv: () => mockEnv }));

const registerBegin = (await import("../../src/pages/api/auth/register/begin")).POST;
const registerFinish = (await import("../../src/pages/api/auth/register/finish")).POST;
const loginBegin = (await import("../../src/pages/api/auth/login/begin")).POST;
const loginFinish = (await import("../../src/pages/api/auth/login/finish")).POST;
const dashboardRoute = (await import("../../src/pages/api/admin/dashboard")).GET;

const RP_ID = "localhost";
const ORIGIN = "http://localhost:4321";

/**
 * SRS §28.1/§28.20: the Super Admin surface must be separate, role-gated,
 * and server-enforced — not just hidden behind a nav link. This test proves
 * the actual guard chain (require-admin.ts) against a real D1 database: a
 * normal signed-up user is rejected, and only a user with both `is_admin`
 * and an active `admin_role_assignments` row — who has re-authenticated
 * since being promoted, so their session actually carries `isAdminSession`
 * — is let through.
 */
describe("Super Admin shell auth guard (real D1)", () => {
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
      AUDIT_ENGINE_ENABLED: "false",
    };
  });

  afterAll(async () => {
    await dispose();
  });

  async function signUpTestUser(
    displayName: string,
  ): Promise<{ cookie: string; userId: string; credential: VirtualCredential }> {
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
    return { cookie, userId: finishBody.data.user.id, credential };
  }

  async function loginTestUser(credential: VirtualCredential): Promise<string> {
    const beginResponse = await loginBegin(ctx(jsonRequest("http://x/login/begin", "POST", {})));
    const begin = await readJson<{
      challengeId: string;
      publicKeyCredentialRequestOptions: { challenge: string };
    }>(beginResponse);
    if (!begin.ok) throw new Error("begin failed");
    const assertion = await simulateAuthentication(
      credential,
      begin.data.publicKeyCredentialRequestOptions.challenge,
      RP_ID,
      ORIGIN,
    );
    const finishResponse = await loginFinish(
      ctx(
        jsonRequest("http://x/login/finish", "POST", {
          challengeId: begin.data.challengeId,
          credential: assertion,
        }),
      ),
    );
    return cookieFromResponse(finishResponse);
  }

  let userId: string;
  let credential: VirtualCredential;
  let normalCookie: string;

  it("rejects a normal signed-in user from the admin API", async () => {
    ({ cookie: normalCookie, userId, credential } = await signUpTestUser("Regular User"));

    const response = await dashboardRoute(
      ctx(getRequest("http://x/api/admin/dashboard", normalCookie)),
    );
    expect(response.status).toBe(403);
    const body = await readJson(response);
    if (body.ok) throw new Error("expected failure");
    expect(body.error.code).toBe("ADMIN_ACTION_FORBIDDEN");
  });

  it("still rejects a session created before the account was promoted, even after promotion", async () => {
    await db.prepare("UPDATE users SET is_admin = 1 WHERE id = ?").bind(userId).run();
    await db
      .prepare(
        "INSERT INTO admin_role_assignments (id, user_id, role_id) VALUES (?, ?, 'super_admin')",
      )
      .bind("ara_test", userId)
      .run();

    // The cookie from before promotion has isAdminSession=0 baked in — it
    // must NOT retroactively gain admin access just because the DB changed.
    const response = await dashboardRoute(
      ctx(getRequest("http://x/api/admin/dashboard", normalCookie)),
    );
    expect(response.status).toBe(403);
  });

  it("grants admin API access after the promoted user re-authenticates", async () => {
    const adminCookie = await loginTestUser(credential);

    const response = await dashboardRoute(
      ctx(getRequest("http://x/api/admin/dashboard", adminCookie)),
    );
    expect(response.status).toBe(200);
    const body = await readJson<{
      snapshot: { totalUsers: number };
      environment: { label: string };
    }>(response);
    if (!body.ok) throw new Error("expected success");
    expect(body.data.snapshot.totalUsers).toBeGreaterThanOrEqual(1);
    expect(body.data.environment.label).toBe("Development");
  });

  it("revokes admin access once the role assignment is revoked, without needing a new session", async () => {
    const adminCookie = await loginTestUser(credential);
    await db
      .prepare("UPDATE admin_role_assignments SET revoked_at = ? WHERE user_id = ?")
      .bind(new Date().toISOString(), userId)
      .run();

    const response = await dashboardRoute(
      ctx(getRequest("http://x/api/admin/dashboard", adminCookie)),
    );
    expect(response.status).toBe(403);
  });
});
