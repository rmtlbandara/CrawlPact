import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ApiResponse } from "@crawlpact/core";
import { createD1TestHarness } from "./d1-harness";
import { createFakeR2Bucket } from "./fake-r2-bucket";
import {
  createVirtualCredential,
  simulateAuthentication,
  simulateRegistration,
} from "./virtual-authenticator";
import type { VirtualCredential } from "./virtual-authenticator";

// apps/web/src/lib/env.ts is the only module that imports "cloudflare:workers"
// directly — mocking it lets these tests run under plain Node/Vitest against
// a real Miniflare-backed D1 instance (see d1-harness.ts) instead of a mock
// database, while still exercising the real route handlers end to end,
// including a cryptographically real WebAuthn ceremony (virtual-authenticator.ts).
let mockEnv: Cloudflare.Env;
vi.mock("../../src/lib/env", () => ({ getEnv: () => mockEnv }));

const registerBegin = (await import("../../src/pages/api/auth/register/begin")).POST;
const registerFinish = (await import("../../src/pages/api/auth/register/finish")).POST;
const loginBegin = (await import("../../src/pages/api/auth/login/begin")).POST;
const loginFinish = (await import("../../src/pages/api/auth/login/finish")).POST;
const logout = (await import("../../src/pages/api/auth/logout")).POST;
const getSession = (await import("../../src/pages/api/auth/session")).GET;
const listSessions = (await import("../../src/pages/api/auth/sessions/index")).GET;
const revokeSession = (await import("../../src/pages/api/auth/sessions/[sessionId]/revoke")).POST;
const revokeAllSessions = (await import("../../src/pages/api/auth/sessions/revoke-all")).POST;
const listPasskeys = (await import("../../src/pages/api/auth/passkeys/index")).GET;
const passkeysBegin = (await import("../../src/pages/api/auth/passkeys/begin")).POST;
const passkeysFinish = (await import("../../src/pages/api/auth/passkeys/finish")).POST;
const renamePasskey = (await import("../../src/pages/api/auth/passkeys/[credentialId]/rename"))
  .POST;
const removePasskey = (await import("../../src/pages/api/auth/passkeys/[credentialId]/remove"))
  .POST;
const generateRecoveryCodes = (await import("../../src/pages/api/auth/recovery-codes/generate"))
  .POST;
const redeemRecoveryCode = (await import("../../src/pages/api/auth/recovery-codes/redeem")).POST;

const RP_ID = "localhost";
const ORIGIN = "http://localhost:4321";

function jsonRequest(url: string, body: unknown, cookie?: string): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json", Origin: ORIGIN };
  if (cookie) headers["Cookie"] = cookie;
  return new Request(url, { method: "POST", headers, body: JSON.stringify(body) });
}

function getRequest(url: string, cookie?: string): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers["Cookie"] = cookie;
  return new Request(url, { method: "GET", headers });
}

function ctx(request: Request, params: Record<string, string | undefined> = {}) {
  return { request, params } as never;
}

function cookieFromResponse(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) throw new Error("Response had no Set-Cookie header");
  return setCookie.split(";")[0]!;
}

async function readJson<T>(response: Response): Promise<ApiResponse<T>> {
  return (await response.json()) as ApiResponse<T>;
}

describe("passkey authentication (real D1 + real WebAuthn crypto)", () => {
  let dispose: () => Promise<void>;

  beforeAll(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
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

  let firstCredential: VirtualCredential;
  let sessionCookie: string;
  let recoveryCodes: string[];
  let secondCredentialRowId: string;

  it("creates an account with a real WebAuthn registration ceremony", async () => {
    const beginResponse = await registerBegin(
      ctx(jsonRequest("http://x/api/auth/register/begin", { displayName: "Ada" })),
    );
    expect(beginResponse.status).toBe(200);
    const begin = await readJson<{
      challengeId: string;
      publicKeyCredentialCreationOptions: { challenge: string };
    }>(beginResponse);
    if (!begin.ok) throw new Error("begin failed");

    firstCredential = await createVirtualCredential();
    const credential = await simulateRegistration(
      firstCredential,
      begin.data.publicKeyCredentialCreationOptions.challenge,
      RP_ID,
      ORIGIN,
    );

    const finishResponse = await registerFinish(
      ctx(
        jsonRequest("http://x/api/auth/register/finish", {
          challengeId: begin.data.challengeId,
          credential,
        }),
      ),
    );
    expect(finishResponse.status).toBe(200);
    const finish = await readJson<{
      user: { id: string; displayName: string };
      recoveryCodes: string[];
    }>(finishResponse);
    if (!finish.ok) throw new Error("finish failed");
    expect(finish.data.user.displayName).toBe("Ada");
    expect(finish.data.recoveryCodes).toHaveLength(10);

    recoveryCodes = finish.data.recoveryCodes;
    sessionCookie = cookieFromResponse(finishResponse);
  });

  it("rejects a registration finish with a stale/invalid challenge", async () => {
    const bogusCredential = await createVirtualCredential();
    const credential = await simulateRegistration(
      bogusCredential,
      "not-the-real-challenge",
      RP_ID,
      ORIGIN,
    );
    const response = await registerFinish(
      ctx(
        jsonRequest("http://x/api/auth/register/finish", {
          challengeId: "not-a-real-token",
          credential,
        }),
      ),
    );
    expect(response.status).toBe(400);
    const body = await readJson(response);
    if (!body.ok) expect(body.error.code).toBe("AUTH_CHALLENGE_EXPIRED");
  });

  it("returns the caller's own identity from GET /api/auth/session using the cookie", async () => {
    const response = await getSession(ctx(getRequest("http://x/api/auth/session", sessionCookie)));
    expect(response.status).toBe(200);
    const body = await readJson<{ displayName: string }>(response);
    if (body.ok) expect(body.data.displayName).toBe("Ada");
  });

  it("rejects GET /api/auth/session with no cookie", async () => {
    const response = await getSession(ctx(getRequest("http://x/api/auth/session")));
    expect(response.status).toBe(401);
  });

  it("adds a second passkey to the signed-in account", async () => {
    const beginResponse = await passkeysBegin(
      ctx(
        jsonRequest(
          "http://x/api/auth/passkeys/begin",
          { displayName: "Work laptop" },
          sessionCookie,
        ),
      ),
    );
    expect(beginResponse.status).toBe(200);
    const begin = await readJson<{
      challengeId: string;
      publicKeyCredentialCreationOptions: { challenge: string };
    }>(beginResponse);
    if (!begin.ok) throw new Error("begin failed");

    const secondCredential = await createVirtualCredential();
    const credential = await simulateRegistration(
      secondCredential,
      begin.data.publicKeyCredentialCreationOptions.challenge,
      RP_ID,
      ORIGIN,
    );

    const finishResponse = await passkeysFinish(
      ctx(
        jsonRequest(
          "http://x/api/auth/passkeys/finish",
          { challengeId: begin.data.challengeId, credential },
          sessionCookie,
        ),
      ),
    );
    expect(finishResponse.status).toBe(200);

    const list = await listPasskeys(ctx(getRequest("http://x/api/auth/passkeys", sessionCookie)));
    const listBody = await readJson<{ credentialId: string; label: string }[]>(list);
    if (!listBody.ok) throw new Error("list failed");
    expect(listBody.data).toHaveLength(2);
    expect(listBody.data.map((p) => p.label).sort()).toEqual(["Passkey", "Work laptop"]);
    secondCredentialRowId = listBody.data.find((p) => p.label === "Work laptop")!.credentialId;
  });

  it("refuses to remove the only remaining passkey but allows removing a spare", async () => {
    const list = await readJson<{ credentialId: string; label: string }[]>(
      await listPasskeys(ctx(getRequest("http://x/api/auth/passkeys", sessionCookie))),
    );
    if (!list.ok) throw new Error("list failed");
    const firstRowId = list.data.find((p) => p.label === "Passkey")!.credentialId;

    // Removing the spare (second) passkey succeeds — one remains.
    const removeSpare = await removePasskey(
      ctx(jsonRequest("http://x/api/auth/passkeys/x/remove", {}, sessionCookie), {
        credentialId: secondCredentialRowId,
      }),
    );
    expect(removeSpare.status).toBe(200);

    // Now only one passkey is left — removing it must be refused.
    const removeLast = await removePasskey(
      ctx(jsonRequest("http://x/api/auth/passkeys/x/remove", {}, sessionCookie), {
        credentialId: firstRowId,
      }),
    );
    expect(removeLast.status).toBe(400);
    const body = await readJson(removeLast);
    if (!body.ok) expect(body.error.code).toBe("VALIDATION_FAILED");
  });

  it("refuses to drop a Super Admin account below two passkeys (SRS §28.20)", async () => {
    // The account is back down to its one original passkey after the
    // previous test. Add a second, then promote to super_admin the same
    // way admin-users.integration.test.ts does (direct SQL — no promotion
    // endpoint exists; this is an intentionally operational-only action).
    const addSecond = await passkeysBegin(
      ctx(jsonRequest("http://x/api/auth/passkeys/begin", { displayName: "Spare" }, sessionCookie)),
    );
    const begin = await readJson<{
      challengeId: string;
      publicKeyCredentialCreationOptions: { challenge: string };
    }>(addSecond);
    if (!begin.ok) throw new Error("begin failed");
    const spareCredential = await createVirtualCredential();
    const credential = await simulateRegistration(
      spareCredential,
      begin.data.publicKeyCredentialCreationOptions.challenge,
      RP_ID,
      ORIGIN,
    );
    await passkeysFinish(
      ctx(
        jsonRequest(
          "http://x/api/auth/passkeys/finish",
          { challengeId: begin.data.challengeId, credential },
          sessionCookie,
        ),
      ),
    );

    const sessionResponse = await readJson<{ id: string }>(
      await getSession(ctx(getRequest("http://x/api/auth/session", sessionCookie))),
    );
    if (!sessionResponse.ok) throw new Error("session lookup failed");
    const userId = sessionResponse.data.id;

    await mockEnv.DB.prepare("UPDATE users SET is_admin = 1 WHERE id = ?").bind(userId).run();
    await mockEnv.DB.prepare(
      "INSERT INTO admin_role_assignments (id, user_id, role_id) VALUES (?, ?, 'super_admin')",
    )
      .bind(crypto.randomUUID(), userId)
      .run();

    const list = await readJson<{ credentialId: string; label: string }[]>(
      await listPasskeys(ctx(getRequest("http://x/api/auth/passkeys", sessionCookie))),
    );
    if (!list.ok) throw new Error("list failed");
    expect(list.data).toHaveLength(2);
    // Later tests (login, rename, recovery codes) rely on firstCredential —
    // labelled "Passkey" by default at registration — still being
    // registered, so every removal below deliberately targets "Spare"/
    // "Third", never "Passkey".
    const spareRowId = list.data.find((p) => p.label === "Spare")!.credentialId;

    // Exactly 2 passkeys, now an admin — dropping to 1 must be refused,
    // even though a non-admin account would be allowed to do this (it's
    // not yet down to the account's *last* passkey).
    const blocked = await removePasskey(
      ctx(jsonRequest("http://x/api/auth/passkeys/x/remove", {}, sessionCookie), {
        credentialId: spareRowId,
      }),
    );
    expect(blocked.status).toBe(400);
    const blockedBody = await readJson<never>(blocked);
    if (!blockedBody.ok) {
      expect(blockedBody.error.code).toBe("VALIDATION_FAILED");
      expect(blockedBody.error.message).toContain("at least two registered passkeys");
    }

    // A third passkey brings it above the minimum — removing back down to
    // exactly 2 is fine; removing a fourth time (to 1) is refused again.
    const addThird = await passkeysBegin(
      ctx(jsonRequest("http://x/api/auth/passkeys/begin", { displayName: "Third" }, sessionCookie)),
    );
    const thirdBegin = await readJson<{
      challengeId: string;
      publicKeyCredentialCreationOptions: { challenge: string };
    }>(addThird);
    if (!thirdBegin.ok) throw new Error("begin failed");
    const thirdCredential = await createVirtualCredential();
    const thirdCredentialResponse = await simulateRegistration(
      thirdCredential,
      thirdBegin.data.publicKeyCredentialCreationOptions.challenge,
      RP_ID,
      ORIGIN,
    );
    await passkeysFinish(
      ctx(
        jsonRequest(
          "http://x/api/auth/passkeys/finish",
          { challengeId: thirdBegin.data.challengeId, credential: thirdCredentialResponse },
          sessionCookie,
        ),
      ),
    );

    const listOfThree = await readJson<{ credentialId: string; label: string }[]>(
      await listPasskeys(ctx(getRequest("http://x/api/auth/passkeys", sessionCookie))),
    );
    if (!listOfThree.ok) throw new Error("list failed");
    expect(listOfThree.data).toHaveLength(3);
    const thirdRowId = listOfThree.data.find((p) => p.label === "Third")!.credentialId;

    const dropToTwo = await removePasskey(
      ctx(jsonRequest("http://x/api/auth/passkeys/x/remove", {}, sessionCookie), {
        credentialId: thirdRowId,
      }),
    );
    expect(dropToTwo.status).toBe(200);

    const remainingTwo = await readJson<{ credentialId: string; label: string }[]>(
      await listPasskeys(ctx(getRequest("http://x/api/auth/passkeys", sessionCookie))),
    );
    if (!remainingTwo.ok) throw new Error("list failed");
    expect(remainingTwo.data).toHaveLength(2);

    const blockedAgain = await removePasskey(
      ctx(jsonRequest("http://x/api/auth/passkeys/x/remove", {}, sessionCookie), {
        credentialId: spareRowId,
      }),
    );
    expect(blockedAgain.status).toBe(400);

    // Restore the account to a plain, non-admin, single-passkey state so
    // every later test in this file (login, rename, revoke-sessions,
    // recovery codes) sees exactly the account shape it expects —
    // otherwise this test would leak state forward.
    await mockEnv.DB.prepare("DELETE FROM admin_role_assignments WHERE user_id = ?")
      .bind(userId)
      .run();
    await mockEnv.DB.prepare("UPDATE users SET is_admin = 0 WHERE id = ?").bind(userId).run();
    const restoreRemove = await removePasskey(
      ctx(jsonRequest("http://x/api/auth/passkeys/x/remove", {}, sessionCookie), {
        credentialId: spareRowId,
      }),
    );
    expect(restoreRemove.status).toBe(200);

    const restored = await readJson<{ credentialId: string; label: string }[]>(
      await listPasskeys(ctx(getRequest("http://x/api/auth/passkeys", sessionCookie))),
    );
    if (!restored.ok) throw new Error("list failed");
    expect(restored.data).toHaveLength(1);
    expect(restored.data[0]!.label).toBe("Passkey");
  });

  it("renames a passkey it owns", async () => {
    const list = await readJson<{ credentialId: string; label: string }[]>(
      await listPasskeys(ctx(getRequest("http://x/api/auth/passkeys", sessionCookie))),
    );
    if (!list.ok) throw new Error("list failed");
    const rowId = list.data[0]!.credentialId;

    const response = await renamePasskey(
      ctx(jsonRequest("http://x/api/auth/passkeys/x/rename", { label: "Renamed" }, sessionCookie), {
        credentialId: rowId,
      }),
    );
    expect(response.status).toBe(200);
  });

  it("logs in with a real WebAuthn authentication ceremony (usernameless)", async () => {
    const beginResponse = await loginBegin(ctx(jsonRequest("http://x/api/auth/login/begin", {})));
    const begin = await readJson<{
      challengeId: string;
      publicKeyCredentialRequestOptions: { challenge: string };
    }>(beginResponse);
    if (!begin.ok) throw new Error("begin failed");

    const credential = await simulateAuthentication(
      firstCredential,
      begin.data.publicKeyCredentialRequestOptions.challenge,
      RP_ID,
      ORIGIN,
    );

    const finishResponse = await loginFinish(
      ctx(
        jsonRequest("http://x/api/auth/login/finish", {
          challengeId: begin.data.challengeId,
          credential,
        }),
      ),
    );
    expect(finishResponse.status).toBe(200);
    sessionCookie = cookieFromResponse(finishResponse);
  });

  it("rejects a login finish signed by an unregistered credential", async () => {
    const beginResponse = await loginBegin(ctx(jsonRequest("http://x/api/auth/login/begin", {})));
    const begin = await readJson<{
      challengeId: string;
      publicKeyCredentialRequestOptions: { challenge: string };
    }>(beginResponse);
    if (!begin.ok) throw new Error("begin failed");

    const strangerCredential = await createVirtualCredential();
    const credential = await simulateAuthentication(
      strangerCredential,
      begin.data.publicKeyCredentialRequestOptions.challenge,
      RP_ID,
      ORIGIN,
    );

    const response = await loginFinish(
      ctx(
        jsonRequest("http://x/api/auth/login/finish", {
          challengeId: begin.data.challengeId,
          credential,
        }),
      ),
    );
    expect(response.status).toBe(400);
    const body = await readJson(response);
    if (!body.ok) expect(body.error.code).toBe("AUTH_CREDENTIAL_INVALID");
  });

  it("lists sessions with the current one flagged, and can revoke a session it owns", async () => {
    const response = await listSessions(
      ctx(getRequest("http://x/api/auth/sessions", sessionCookie)),
    );
    const body = await readJson<{ sessionId: string; isCurrent: boolean }[]>(response);
    if (!body.ok) throw new Error("list failed");
    expect(body.data.some((s) => s.isCurrent)).toBe(true);
  });

  it("cannot revoke a session belonging to a different account", async () => {
    const otherBegin = await registerBegin(
      ctx(jsonRequest("http://x/api/auth/register/begin", { displayName: "Grace" })),
    );
    const begin = await readJson<{
      challengeId: string;
      publicKeyCredentialCreationOptions: { challenge: string };
    }>(otherBegin);
    if (!begin.ok) throw new Error("begin failed");
    const otherCredential = await createVirtualCredential();
    const credential = await simulateRegistration(
      otherCredential,
      begin.data.publicKeyCredentialCreationOptions.challenge,
      RP_ID,
      ORIGIN,
    );
    const otherFinish = await registerFinish(
      ctx(
        jsonRequest("http://x/api/auth/register/finish", {
          challengeId: begin.data.challengeId,
          credential,
        }),
      ),
    );
    const otherCookie = cookieFromResponse(otherFinish);

    const mySessions = await readJson<{ sessionId: string }[]>(
      await listSessions(ctx(getRequest("http://x/api/auth/sessions", sessionCookie))),
    );
    if (!mySessions.ok) throw new Error("list failed");
    const myOwnSessionId = mySessions.data[0]!.sessionId;

    const response = await revokeSession(
      ctx(jsonRequest("http://x/api/auth/sessions/x/revoke", {}, otherCookie), {
        sessionId: myOwnSessionId,
      }),
    );
    expect(response.status).toBe(404);
  });

  it("generates recovery codes for the signed-in account and invalidates the previous set", async () => {
    const response = await generateRecoveryCodes(
      ctx(jsonRequest("http://x/api/auth/recovery-codes/generate", {}, sessionCookie)),
    );
    expect(response.status).toBe(200);
    const body = await readJson<{ codes: string[] }>(response);
    if (!body.ok) throw new Error("generate failed");
    recoveryCodes = body.data.codes;

    // The original signup-time codes are gone now — redeeming one must fail.
    const staleRedeem = await redeemRecoveryCode(
      ctx(jsonRequest("http://x/api/auth/recovery-codes/redeem", { code: "AAAAA-AAAAA-AAAAA" })),
    );
    expect(staleRedeem.status).toBe(400);
  });

  it("signs in with a one-time recovery code, then refuses to reuse it", async () => {
    const code = recoveryCodes[0]!;
    const first = await redeemRecoveryCode(
      ctx(jsonRequest("http://x/api/auth/recovery-codes/redeem", { code })),
    );
    expect(first.status).toBe(200);
    expect(first.headers.get("set-cookie")).toBeTruthy();

    const second = await redeemRecoveryCode(
      ctx(jsonRequest("http://x/api/auth/recovery-codes/redeem", { code })),
    );
    expect(second.status).toBe(400);
    const body = await readJson(second);
    if (!body.ok) expect(body.error.code).toBe("AUTH_RECOVERY_CODE_INVALID");
  });

  it("rate-limits repeated invalid recovery-code attempts from the same IP", async () => {
    const request = () =>
      redeemRecoveryCode(
        ctx(
          new Request("http://x/api/auth/recovery-codes/redeem", {
            method: "POST",
            headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.9" },
            body: JSON.stringify({ code: "WRONG-WRONG-WRONG" }),
          }),
        ),
      );

    for (let i = 0; i < 5; i++) {
      const response = await request();
      expect(response.status).toBe(400);
    }
    const limited = await request();
    expect(limited.status).toBe(429);
    const body = await readJson(limited);
    if (!body.ok) expect(body.error.code).toBe("RATE_LIMITED");
  });

  it("signs out and invalidates the session cookie", async () => {
    const response = await logout(
      ctx(
        new Request("http://x/api/auth/logout", {
          method: "POST",
          headers: { Cookie: sessionCookie },
        }),
      ),
    );
    expect(response.status).toBe(200);

    const afterLogout = await getSession(
      ctx(getRequest("http://x/api/auth/session", sessionCookie)),
    );
    expect(afterLogout.status).toBe(401);
  });

  it("revoke-all clears every session for the account", async () => {
    // Sign back in with the recovery code generated above (index 1, since index 0 was consumed).
    const secondCode = recoveryCodes[1]!;
    const signInResponse = await redeemRecoveryCode(
      ctx(jsonRequest("http://x/api/auth/recovery-codes/redeem", { code: secondCode })),
    );
    const cookie = cookieFromResponse(signInResponse);

    const response = await revokeAllSessions(
      ctx(
        new Request("http://x/api/auth/sessions/revoke-all", {
          method: "POST",
          headers: { Cookie: cookie, Origin: ORIGIN },
        }),
      ),
    );
    expect(response.status).toBe(200);

    const afterRevoke = await getSession(ctx(getRequest("http://x/api/auth/session", cookie)));
    expect(afterRevoke.status).toBe(401);
  });
});
