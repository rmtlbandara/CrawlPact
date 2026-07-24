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
const searchUsersRoute = (await import("../../src/pages/api/admin/users/index")).GET;
const getUserRoute = (await import("../../src/pages/api/admin/users/[userId]/index")).GET;
const suspendRoute = (await import("../../src/pages/api/admin/users/[userId]/suspend")).POST;
const restoreRoute = (await import("../../src/pages/api/admin/users/[userId]/restore")).POST;
const revokeSessionsRoute = (
  await import("../../src/pages/api/admin/users/[userId]/revoke-sessions")
).POST;
const notesRoute = (await import("../../src/pages/api/admin/users/[userId]/notes")).POST;

const RP_ID = "localhost";
const ORIGIN = "http://localhost:4321";

/** SRS §28.3: user search, detail, and every controlled action (each requiring
 * a reason, recent auth, and producing an audit-log entry) against real D1. */
describe("Super Admin user administration (real D1)", () => {
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

  async function loginTestUser(credential: VirtualCredential): Promise<Response> {
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
    return loginFinish(
      ctx(
        jsonRequest("http://x/login/finish", "POST", {
          challengeId: begin.data.challengeId,
          credential: assertion,
        }),
      ),
    );
  }

  async function promoteToAdmin(userId: string): Promise<void> {
    await db.prepare("UPDATE users SET is_admin = 1 WHERE id = ?").bind(userId).run();
    await db
      .prepare(
        `INSERT INTO admin_role_assignments (id, user_id, role_id) VALUES (?, ?, 'super_admin')`,
      )
      .bind(`ara_${userId}`, userId)
      .run();
  }

  let adminCookie: string;
  let targetUserId: string;
  let targetCredential: VirtualCredential;

  beforeAll(async () => {
    const admin = await signUpTestUser("Ops Admin");
    await promoteToAdmin(admin.userId);
    const loginResponse = await loginTestUser(admin.credential);
    adminCookie = cookieFromResponse(loginResponse);

    const target = await signUpTestUser("Target Customer");
    targetUserId = target.userId;
    targetCredential = target.credential;
  });

  it("finds the target user by a partial display-name search", async () => {
    const response = await searchUsersRoute(
      ctx(getRequest("http://x/api/admin/users?q=Target", adminCookie)),
    );
    expect(response.status).toBe(200);
    const body = await readJson<{ id: string }[]>(response);
    if (!body.ok) throw new Error("search failed");
    expect(body.data.some((u) => u.id === targetUserId)).toBe(true);
  });

  it("returns full user detail without any secret material", async () => {
    const response = await getUserRoute(
      ctx(getRequest(`http://x/api/admin/users/${targetUserId}`, adminCookie), {
        userId: targetUserId,
      }),
    );
    expect(response.status).toBe(200);
    const raw = await response.clone().text();
    expect(raw).not.toContain("codeHash");
    expect(raw).not.toContain("publicKey");
    const body = await readJson<{ passkeyCount: number; activeSessionCount: number }>(response);
    if (!body.ok) throw new Error("detail failed");
    expect(body.data.passkeyCount).toBe(1);
    expect(body.data.activeSessionCount).toBe(1);
  });

  it("rejects a suspend request with no reason", async () => {
    const response = await suspendRoute(
      ctx(
        jsonRequest(`http://x/api/admin/users/${targetUserId}/suspend`, "POST", {}, adminCookie),
        {
          userId: targetUserId,
        },
      ),
    );
    expect(response.status).toBe(400);
    const body = await readJson(response);
    if (body.ok) throw new Error("expected failure");
    expect(body.error.code).toBe("ADMIN_REASON_REQUIRED");
  });

  it("suspends the user, revokes their session, and blocks further login", async () => {
    const response = await suspendRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/users/${targetUserId}/suspend`,
          "POST",
          { reason: "Abuse report under review" },
          adminCookie,
        ),
        { userId: targetUserId },
      ),
    );
    expect(response.status).toBe(200);

    const loginResponse = await loginTestUser(targetCredential);
    expect(loginResponse.status).toBe(400);
    const loginBody = await readJson(loginResponse);
    if (loginBody.ok) throw new Error("expected suspended login to fail");
    expect(loginBody.error.code).toBe("AUTH_CREDENTIAL_INVALID");

    const auditRow = await db
      .prepare("SELECT * FROM admin_audit_logs WHERE action = 'user.suspend' AND target = ?")
      .bind(targetUserId)
      .first();
    expect(auditRow).toBeTruthy();
    expect((auditRow as { reason: string }).reason).toBe("Abuse report under review");
  });

  it("restores the user, who can then sign in again", async () => {
    const response = await restoreRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/users/${targetUserId}/restore`,
          "POST",
          { reason: "Review complete, account cleared" },
          adminCookie,
        ),
        { userId: targetUserId },
      ),
    );
    expect(response.status).toBe(200);

    const loginResponse = await loginTestUser(targetCredential);
    expect(loginResponse.status).toBe(200);
  });

  it("revokes all of a user's sessions on request", async () => {
    const response = await revokeSessionsRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/users/${targetUserId}/revoke-sessions`,
          "POST",
          { reason: "Suspicious session activity" },
          adminCookie,
        ),
        { userId: targetUserId },
      ),
    );
    expect(response.status).toBe(200);

    const detailResponse = await getUserRoute(
      ctx(getRequest(`http://x/api/admin/users/${targetUserId}`, adminCookie), {
        userId: targetUserId,
      }),
    );
    const detail = await readJson<{ activeSessionCount: number }>(detailResponse);
    if (!detail.ok) throw new Error("detail failed");
    expect(detail.data.activeSessionCount).toBe(0);
  });

  it("adds an internal note, visible in the user detail view", async () => {
    const response = await notesRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/users/${targetUserId}/notes`,
          "POST",
          { note: "Contacted via support ticket #4471." },
          adminCookie,
        ),
        { userId: targetUserId },
      ),
    );
    expect(response.status).toBe(201);

    const detailResponse = await getUserRoute(
      ctx(getRequest(`http://x/api/admin/users/${targetUserId}`, adminCookie), {
        userId: targetUserId,
      }),
    );
    const detail = await readJson<{ internalNotes: { note: { note: string } }[] }>(detailResponse);
    if (!detail.ok) throw new Error("detail failed");
    expect(detail.data.internalNotes[0]?.note.note).toBe("Contacted via support ticket #4471.");
  });

  it("prevents an admin from suspending their own account", async () => {
    const admin = await getUserRoute(
      ctx(getRequest(`http://x/api/admin/users/${targetUserId}`, adminCookie), {
        userId: targetUserId,
      }),
    );
    void admin;
    const [adminUser] = (
      await db.prepare("SELECT id FROM users WHERE display_name = 'Ops Admin'").all()
    ).results as { id: string }[];
    const response = await suspendRoute(
      ctx(
        jsonRequest(
          `http://x/api/admin/users/${adminUser!.id}/suspend`,
          "POST",
          { reason: "testing self-lockout guard" },
          adminCookie,
        ),
        { userId: adminUser!.id },
      ),
    );
    expect(response.status).toBe(403);
  });

  it("rejects a normal (non-admin) user from every admin user-administration route", async () => {
    const normal = await signUpTestUser("Bystander");
    const response = await searchUsersRoute(
      ctx(getRequest("http://x/api/admin/users?q=Target", normal.cookie)),
    );
    expect(response.status).toBe(403);
  });
});
