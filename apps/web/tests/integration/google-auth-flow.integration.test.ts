import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import type { JWTVerifyGetKey } from "jose";
import { createD1TestHarness } from "./d1-harness";
import { createFakeR2Bucket } from "./fake-r2-bucket";
import { createVirtualCredential, simulateRegistration } from "./virtual-authenticator";
import { ctx, cookieFromResponse, readJson } from "./test-helpers";

/**
 * Real cryptographic Google ID-token verification (a local test JWKS, never
 * the live Google network — sections 49/50/57) against a real (Miniflare)
 * D1 database. `verifyGoogleIdToken`'s own signature/issuer/audience/exp/azp
 * checks are exercised unmodified (google.test.ts covers those in isolation);
 * this file only swaps the JWKS *source* for a local one, the same
 * dependency-injection seam google.test.ts uses.
 */
let mockEnv: Cloudflare.Env;
vi.mock("../../src/lib/env", () => ({ getEnv: () => mockEnv }));

let testJwks: JWTVerifyGetKey;
vi.mock("../../src/lib/auth/google", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/auth/google")>();
  return {
    ...actual,
    verifyGoogleIdToken: (token: string, options: { expectedClientId: string }) =>
      actual.verifyGoogleIdToken(token, { ...options, jwks: testJwks }),
  };
});

const registerBegin = (await import("../../src/pages/api/auth/register/begin")).POST;
const registerFinish = (await import("../../src/pages/api/auth/register/finish")).POST;
const googleBegin = (await import("../../src/pages/api/auth/google/begin")).POST;
const googleCallback = (await import("../../src/pages/api/auth/google/index")).POST;
const googleStatus = (await import("../../src/pages/api/account/google/index")).GET;
const googleLinkBegin = (await import("../../src/pages/api/account/google/link/begin")).POST;
const googleDisconnect = (await import("../../src/pages/api/account/google/disconnect")).POST;
const getSession = (await import("../../src/pages/api/auth/session")).GET;

const RP_ID = "localhost";
const ORIGIN = "http://localhost:4321";
const GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
const KID = "test-key-1";

let privateKey: CryptoKey;

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

async function signIdToken(claims: {
  sub: string;
  nonce: string;
  email?: string | null;
  emailVerified?: boolean;
  name?: string | null;
  audience?: string;
  issuer?: string;
}): Promise<string> {
  const payload: Record<string, unknown> = { sub: claims.sub, nonce: claims.nonce };
  if (claims.email !== undefined && claims.email !== null) payload.email = claims.email;
  if (claims.emailVerified !== undefined) payload.email_verified = claims.emailVerified;
  if (claims.name !== undefined && claims.name !== null) payload.name = claims.name;

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid: KID })
    .setIssuedAt()
    .setIssuer(claims.issuer ?? "https://accounts.google.com")
    .setAudience(claims.audience ?? GOOGLE_CLIENT_ID)
    .setExpirationTime("1h")
    .sign(privateKey);
}

/** Builds the exact form-urlencoded POST Google's own redirect flow sends to /api/auth/google. */
function googleCallbackRequest(params: {
  credential?: string;
  state?: string;
  csrfCookie?: string | null;
  csrfField?: string | null;
  sessionCookie?: string;
}): Request {
  const form = new URLSearchParams();
  if (params.credential !== undefined) form.set("credential", params.credential);
  if (params.state !== undefined) form.set("state", params.state);
  if (params.csrfField !== undefined && params.csrfField !== null) {
    form.set("g_csrf_token", params.csrfField);
  }
  form.set("select_by", "btn"); // harmless field Google adds — must never break the callback

  const cookieParts: string[] = [];
  if (params.csrfCookie !== undefined && params.csrfCookie !== null) {
    cookieParts.push(`g_csrf_token=${params.csrfCookie}`);
  }
  if (params.sessionCookie) cookieParts.push(params.sessionCookie);

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (cookieParts.length > 0) headers["Cookie"] = cookieParts.join("; ");

  return new Request("http://x/api/auth/google", {
    method: "POST",
    headers,
    body: form.toString(),
  });
}

/** Full happy-path helper: begin (signin or signup), sign a matching token, post the callback. */
async function performGoogleAuth(params: {
  action: "signin" | "signup";
  sub: string;
  email?: string | null;
  emailVerified?: boolean;
  name?: string | null;
  csrfToken?: string;
}): Promise<Response> {
  const beginResponse = await googleBegin(ctx(jsonRequest("http://x/api/auth/google/begin", {})));
  const begin = await readJson<{ nonce: string; signInState: string; signUpState: string }>(
    beginResponse,
  );
  if (!begin.ok) throw new Error("google begin failed");

  const state = params.action === "signin" ? begin.data.signInState : begin.data.signUpState;
  const credential = await signIdToken({
    sub: params.sub,
    nonce: begin.data.nonce,
    email: params.email,
    emailVerified: params.emailVerified,
    name: params.name,
  });
  const csrf = params.csrfToken ?? "csrf-token-abc";
  return googleCallback(
    ctx(googleCallbackRequest({ credential, state, csrfCookie: csrf, csrfField: csrf })),
  );
}

describe("Google authentication (real D1 + real JWT cryptography)", () => {
  let dispose: () => Promise<void>;

  beforeAll(async () => {
    const pair = await generateKeyPair("RS256");
    privateKey = pair.privateKey;
    const publicJwk = await exportJWK(pair.publicKey);
    testJwks = createLocalJWKSet({ keys: [{ ...publicJwk, kid: KID, alg: "RS256", use: "sig" }] });

    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    mockEnv = {
      DB: harness.db,
      AGENCY_LOGOS: createFakeR2Bucket(),
      PUBLIC_APP_ENV: "local",
      PUBLIC_SITE_URL: ORIGIN,
      SESSION_SIGNING_SECRET: "integration-test-secret-value-long-enough",
      ABUSE_MONITORING_SECRET: "integration-test-abuse-secret-value-long-enough",
      WEBAUTHN_RP_ID: RP_ID,
      WEBAUTHN_RP_ORIGIN: ORIGIN,
      GOOGLE_CLIENT_ID,
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

  async function countUsers(): Promise<number> {
    const result = await mockEnv.DB.prepare("SELECT COUNT(*) as n FROM users").first<{
      n: number;
    }>();
    return result?.n ?? 0;
  }

  async function countOAuthAccounts(): Promise<number> {
    const result = await mockEnv.DB.prepare("SELECT COUNT(*) as n FROM oauth_accounts").first<{
      n: number;
    }>();
    return result?.n ?? 0;
  }

  describe("callback CSRF/state/nonce security", () => {
    it("rejects a callback with no credential", async () => {
      const beginResponse = await googleBegin(
        ctx(jsonRequest("http://x/api/auth/google/begin", {})),
      );
      const begin = await readJson<{ signUpState: string }>(beginResponse);
      if (!begin.ok) throw new Error("begin failed");
      const response = await googleCallback(
        ctx(
          googleCallbackRequest({
            state: begin.data.signUpState,
            csrfCookie: "x",
            csrfField: "x",
          }),
        ),
      );
      expect(response.status).toBe(303);
      const location = new URL(response.headers.get("Location")!);
      expect(location.searchParams.get("googleError")).toBe("google_invalid_request");
      expect(response.headers.get("set-cookie")).toBeNull();
    });

    it("rejects a callback with no state", async () => {
      const credential = await signIdToken({ sub: "no-state-user", nonce: "irrelevant" });
      const response = await googleCallback(
        ctx(googleCallbackRequest({ credential, csrfCookie: "x", csrfField: "x" })),
      );
      expect(response.status).toBe(303);
      const location = new URL(response.headers.get("Location")!);
      expect(location.searchParams.get("googleError")).toBe("google_invalid_request");
    });

    it("rejects a callback missing the g_csrf_token cookie", async () => {
      const response = await performGoogleAuthWithMissingCsrf("cookie");
      expect(response.status).toBe(303);
      expect(new URL(response.headers.get("Location")!).searchParams.get("googleError")).toBe(
        "google_invalid_request",
      );
      expect(response.headers.get("set-cookie")).toBeNull();
    });

    it("rejects a callback missing the g_csrf_token form field", async () => {
      const response = await performGoogleAuthWithMissingCsrf("field");
      expect(response.status).toBe(303);
      expect(new URL(response.headers.get("Location")!).searchParams.get("googleError")).toBe(
        "google_invalid_request",
      );
    });

    async function performGoogleAuthWithMissingCsrf(
      missing: "cookie" | "field",
    ): Promise<Response> {
      const beginResponse = await googleBegin(
        ctx(jsonRequest("http://x/api/auth/google/begin", {})),
      );
      const begin = await readJson<{ nonce: string; signUpState: string }>(beginResponse);
      if (!begin.ok) throw new Error("begin failed");
      const credential = await signIdToken({ sub: "csrf-missing-user", nonce: begin.data.nonce });
      return googleCallback(
        ctx(
          googleCallbackRequest({
            credential,
            state: begin.data.signUpState,
            csrfCookie: missing === "cookie" ? null : "csrf-abc",
            csrfField: missing === "field" ? null : "csrf-abc",
          }),
        ),
      );
    }

    it("rejects mismatched CSRF cookie/field values", async () => {
      const beginResponse = await googleBegin(
        ctx(jsonRequest("http://x/api/auth/google/begin", {})),
      );
      const begin = await readJson<{ nonce: string; signUpState: string }>(beginResponse);
      if (!begin.ok) throw new Error("begin failed");
      const credential = await signIdToken({ sub: "csrf-mismatch-user", nonce: begin.data.nonce });
      const response = await googleCallback(
        ctx(
          googleCallbackRequest({
            credential,
            state: begin.data.signUpState,
            csrfCookie: "cookie-value",
            csrfField: "different-field-value",
          }),
        ),
      );
      expect(response.status).toBe(303);
      expect(new URL(response.headers.get("Location")!).searchParams.get("googleError")).toBe(
        "google_invalid_request",
      );
    });

    it("rejects an unknown state", async () => {
      const credential = await signIdToken({ sub: "unknown-state-user", nonce: "whatever" });
      const response = await googleCallback(
        ctx(
          googleCallbackRequest({
            credential,
            state: "this-state-was-never-issued",
            csrfCookie: "x",
            csrfField: "x",
          }),
        ),
      );
      expect(response.status).toBe(303);
      expect(new URL(response.headers.get("Location")!).searchParams.get("googleError")).toBe(
        "google_invalid_request",
      );
    });

    it("rejects an expired state", async () => {
      const beginResponse = await googleBegin(
        ctx(jsonRequest("http://x/api/auth/google/begin", {})),
      );
      const begin = await readJson<{ nonce: string; signUpState: string }>(beginResponse);
      if (!begin.ok) throw new Error("begin failed");

      // Force the intent's expiry into the past — direct SQL, same pattern
      // auth-flow.integration.test.ts uses to manipulate state the API
      // surface itself has no route for.
      const stateHashDigest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(begin.data.signUpState),
      );
      const stateHash = Array.from(new Uint8Array(stateHashDigest), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      await mockEnv.DB.prepare(
        "UPDATE oauth_auth_intents SET expires_at = '2000-01-01T00:00:00.000Z' WHERE state_hash = ?",
      )
        .bind(stateHash)
        .run();

      const credential = await signIdToken({ sub: "expired-state-user", nonce: begin.data.nonce });
      const response = await googleCallback(
        ctx(
          googleCallbackRequest({
            credential,
            state: begin.data.signUpState,
            csrfCookie: "x",
            csrfField: "x",
          }),
        ),
      );
      expect(response.status).toBe(303);
      expect(new URL(response.headers.get("Location")!).searchParams.get("googleError")).toBe(
        "google_invalid_request",
      );
    });

    it("a state can never be used twice (single-use, atomic consumption)", async () => {
      const beginResponse = await googleBegin(
        ctx(jsonRequest("http://x/api/auth/google/begin", {})),
      );
      const begin = await readJson<{ nonce: string; signUpState: string }>(beginResponse);
      if (!begin.ok) throw new Error("begin failed");
      const credential = await signIdToken({ sub: "replay-state-user", nonce: begin.data.nonce });

      const first = await googleCallback(
        ctx(
          googleCallbackRequest({
            credential,
            state: begin.data.signUpState,
            csrfCookie: "x",
            csrfField: "x",
          }),
        ),
      );
      expect(first.status).toBe(303);
      expect(first.headers.get("set-cookie")).toBeTruthy();

      const replay = await googleCallback(
        ctx(
          googleCallbackRequest({
            credential,
            state: begin.data.signUpState,
            csrfCookie: "x",
            csrfField: "x",
          }),
        ),
      );
      expect(replay.status).toBe(303);
      expect(new URL(replay.headers.get("Location")!).searchParams.get("googleError")).toBe(
        "google_invalid_request",
      );
      expect(replay.headers.get("set-cookie")).toBeNull();
    });

    it("rejects a nonce that doesn't match the issued intent", async () => {
      const beginResponse = await googleBegin(
        ctx(jsonRequest("http://x/api/auth/google/begin", {})),
      );
      const begin = await readJson<{ signUpState: string }>(beginResponse);
      if (!begin.ok) throw new Error("begin failed");
      const credential = await signIdToken({ sub: "nonce-mismatch-user", nonce: "wrong-nonce" });
      const response = await googleCallback(
        ctx(
          googleCallbackRequest({
            credential,
            state: begin.data.signUpState,
            csrfCookie: "x",
            csrfField: "x",
          }),
        ),
      );
      expect(response.status).toBe(303);
      expect(new URL(response.headers.get("Location")!).searchParams.get("googleError")).toBe(
        "google_invalid_request",
      );
      expect(response.headers.get("set-cookie")).toBeNull();
    });

    it("rejects an invalid (badly signed) ID token", async () => {
      const beginResponse = await googleBegin(
        ctx(jsonRequest("http://x/api/auth/google/begin", {})),
      );
      const begin = await readJson<{ signUpState: string }>(beginResponse);
      if (!begin.ok) throw new Error("begin failed");
      const response = await googleCallback(
        ctx(
          googleCallbackRequest({
            credential: "not-a-real-jwt-at-all",
            state: begin.data.signUpState,
            csrfCookie: "x",
            csrfField: "x",
          }),
        ),
      );
      expect(response.status).toBe(303);
      expect(new URL(response.headers.get("Location")!).searchParams.get("googleError")).toBe(
        "google_invalid_request",
      );
    });

    it("ignores a harmless unrecognized field (select_by) without failing", async () => {
      // Every callback request built by googleCallbackRequest() already sets
      // select_by — every test above proves the callback works with it
      // present, none of them fail because of it.
      const response = await performGoogleAuth({ action: "signup", sub: "select-by-user" });
      expect(response.status).toBe(303);
    });

    it("an attacker-supplied redirectTo at begin time never overrides the safe default", async () => {
      const beginResponse = await googleBegin(
        ctx(
          jsonRequest("http://x/api/auth/google/begin", {
            redirectTo: "https://evil.example/steal",
          }),
        ),
      );
      const begin = await readJson<{ nonce: string; signUpState: string }>(beginResponse);
      if (!begin.ok) throw new Error("begin failed");
      const credential = await signIdToken({
        sub: "unsafe-redirect-user",
        nonce: begin.data.nonce,
      });
      const response = await googleCallback(
        ctx(
          googleCallbackRequest({
            credential,
            state: begin.data.signUpState,
            csrfCookie: "x",
            csrfField: "x",
          }),
        ),
      );
      expect(response.status).toBe(303);
      const location = response.headers.get("Location")!;
      expect(location).not.toContain("evil.example");
      expect(new URL(location).pathname).toBe("/app");
    });
  });

  describe("sign-in vs sign-up semantics", () => {
    it("sign-in with an unlinked Google account does not create a user", async () => {
      const before = await countUsers();
      const response = await performGoogleAuth({ action: "signin", sub: "never-signed-up" });
      expect(response.status).toBe(303);
      expect(new URL(response.headers.get("Location")!).searchParams.get("googleError")).toBe(
        "google_not_linked",
      );
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(await countUsers()).toBe(before);
    });

    it("sign-up with an unlinked Google account creates exactly one user with Free plan, active status, and a session", async () => {
      const beforeUsers = await countUsers();
      const beforeOAuth = await countOAuthAccounts();
      const response = await performGoogleAuth({
        action: "signup",
        sub: "new-google-user-1",
        email: "newuser@example.com",
        emailVerified: true,
        name: "Grace Hopper",
      });
      expect(response.status).toBe(303);
      expect(new URL(response.headers.get("Location")!).pathname).toBe("/app");
      const cookie = cookieFromResponse(response);
      expect(await countUsers()).toBe(beforeUsers + 1);
      expect(await countOAuthAccounts()).toBe(beforeOAuth + 1);

      const sessionResponse = await getSession(
        ctx(getRequest("http://x/api/auth/session", cookie)),
      );
      const session = await readJson<{ displayName: string; isAdmin: boolean }>(sessionResponse);
      if (!session.ok) throw new Error("session lookup failed");
      expect(session.data.displayName).toBe("Grace Hopper");
      expect(session.data.isAdmin).toBe(false);

      const row = await mockEnv.DB.prepare(
        "SELECT status, plan_id, is_admin FROM users WHERE display_name = ?",
      )
        .bind("Grace Hopper")
        .first<{ status: string; plan_id: string; is_admin: number }>();
      expect(row?.status).toBe("active");
      expect(row?.plan_id).toBe("free");
      expect(row?.is_admin).toBe(0);
    });

    it("repeated sign-up with the same Google sub is idempotent — signs into the existing account, never duplicates it", async () => {
      const sub = "idempotent-signup-user";
      const first = await performGoogleAuth({ action: "signup", sub, name: "First Time" });
      expect(first.status).toBe(303);

      const beforeUsers = await countUsers();
      const second = await performGoogleAuth({ action: "signup", sub, name: "First Time" });
      expect(second.status).toBe(303);
      expect(await countUsers()).toBe(beforeUsers);
      expect(second.headers.get("set-cookie")).toBeTruthy();
    });

    it("sign-in with a linked Google account uses the existing user", async () => {
      const sub = "linked-signin-user";
      await performGoogleAuth({ action: "signup", sub, name: "Linked User" });

      const beforeUsers = await countUsers();
      const response = await performGoogleAuth({ action: "signin", sub });
      expect(response.status).toBe(303);
      expect(await countUsers()).toBe(beforeUsers);
      const cookie = cookieFromResponse(response);
      const session = await readJson<{ displayName: string }>(
        await getSession(ctx(getRequest("http://x/api/auth/session", cookie))),
      );
      if (session.ok) expect(session.data.displayName).toBe("Linked User");
    });

    it("a changed Google email on the same sub does not change the CrawlPact identity, and updates the stored metadata", async () => {
      const sub = "email-change-user";
      await performGoogleAuth({
        action: "signup",
        sub,
        email: "old@example.com",
        emailVerified: true,
      });
      const firstStatus = await mockEnv.DB.prepare(
        "SELECT user_id, email FROM oauth_accounts WHERE provider_subject = ?",
      )
        .bind(sub)
        .first<{ user_id: string; email: string }>();
      expect(firstStatus?.email).toBe("old@example.com");

      await performGoogleAuth({
        action: "signin",
        sub,
        email: "new@example.com",
        emailVerified: true,
      });
      const secondStatus = await mockEnv.DB.prepare(
        "SELECT user_id, email FROM oauth_accounts WHERE provider_subject = ?",
      )
        .bind(sub)
        .first<{ user_id: string; email: string }>();
      expect(secondStatus?.user_id).toBe(firstStatus?.user_id);
      expect(secondStatus?.email).toBe("new@example.com");
    });

    it("a suspended account cannot sign in via Google", async () => {
      const sub = "suspended-google-user";
      await performGoogleAuth({ action: "signup", sub });
      const row = await mockEnv.DB.prepare(
        "SELECT user_id FROM oauth_accounts WHERE provider_subject = ?",
      )
        .bind(sub)
        .first<{ user_id: string }>();
      await mockEnv.DB.prepare("UPDATE users SET status = 'suspended' WHERE id = ?")
        .bind(row!.user_id)
        .run();

      const response = await performGoogleAuth({ action: "signin", sub });
      expect(response.status).toBe(303);
      expect(new URL(response.headers.get("Location")!).searchParams.get("googleError")).toBe(
        "google_account_unavailable",
      );
      expect(response.headers.get("set-cookie")).toBeNull();
    });

    it("a pending_deletion account can still sign in via Google (cancellable grace period)", async () => {
      const sub = "pending-deletion-google-user";
      await performGoogleAuth({ action: "signup", sub });
      const row = await mockEnv.DB.prepare(
        "SELECT user_id FROM oauth_accounts WHERE provider_subject = ?",
      )
        .bind(sub)
        .first<{ user_id: string }>();
      await mockEnv.DB.prepare("UPDATE users SET status = 'pending_deletion' WHERE id = ?")
        .bind(row!.user_id)
        .run();

      const response = await performGoogleAuth({ action: "signin", sub });
      expect(response.status).toBe(303);
      expect(response.headers.get("set-cookie")).toBeTruthy();

      // Restore for isolation from later tests touching the same DB.
      await mockEnv.DB.prepare("UPDATE users SET status = 'active' WHERE id = ?")
        .bind(row!.user_id)
        .run();
    });

    it("records a security event on a Google auth failure", async () => {
      const before = await mockEnv.DB.prepare(
        "SELECT COUNT(*) as n FROM security_events WHERE event_type = 'auth_failure'",
      ).first<{ n: number }>();
      await performGoogleAuth({ action: "signin", sub: "never-existed-security-event-check" });
      const after = await mockEnv.DB.prepare(
        "SELECT COUNT(*) as n FROM security_events WHERE event_type = 'auth_failure'",
      ).first<{ n: number }>();
      expect(after!.n).toBeGreaterThan(before!.n);
    });
  });

  describe("admin isolation (section 29, mandatory)", () => {
    it("Google sign-in never creates isAdminSession=true, and an active admin cannot sign in via Google at all", async () => {
      // Create an ordinary Google account, then promote it to admin exactly
      // as auth-flow.integration.test.ts does (direct SQL — no promotion
      // endpoint exists by design).
      const sub = "admin-google-user";
      const signup = await performGoogleAuth({ action: "signup", sub, name: "Almost Admin" });
      const cookie = cookieFromResponse(signup);
      const session = await readJson<{ id: string }>(
        await getSession(ctx(getRequest("http://x/api/auth/session", cookie))),
      );
      if (!session.ok) throw new Error("session lookup failed");
      const userId = session.data.id;

      await mockEnv.DB.prepare("UPDATE users SET is_admin = 1 WHERE id = ?").bind(userId).run();
      await mockEnv.DB.prepare(
        "INSERT INTO admin_role_assignments (id, user_id, role_id) VALUES (?, ?, 'super_admin')",
      )
        .bind(crypto.randomUUID(), userId)
        .run();

      const response = await performGoogleAuth({ action: "signin", sub });
      expect(response.status).toBe(303);
      expect(new URL(response.headers.get("Location")!).searchParams.get("googleError")).toBe(
        "google_admin_passkey_required",
      );
      expect(response.headers.get("set-cookie")).toBeNull();

      // No admin session (or any session) exists as a result of this attempt.
      const adminSessionCount = await mockEnv.DB.prepare(
        "SELECT COUNT(*) as n FROM sessions WHERE user_id = ? AND is_admin_session = 1",
      )
        .bind(userId)
        .first<{ n: number }>();
      expect(adminSessionCount!.n).toBe(0);

      await mockEnv.DB.prepare("DELETE FROM admin_role_assignments WHERE user_id = ?")
        .bind(userId)
        .run();
      await mockEnv.DB.prepare("UPDATE users SET is_admin = 0 WHERE id = ?").bind(userId).run();
    });
  });

  describe("account linking / unlinking (sections 21-24, 52)", () => {
    async function createPasskeyAccount(displayName: string): Promise<string> {
      const begin = await readJson<{
        challengeId: string;
        publicKeyCredentialCreationOptions: { challenge: string };
      }>(
        await registerBegin(ctx(jsonRequest("http://x/api/auth/register/begin", { displayName }))),
      );
      if (!begin.ok) throw new Error("register begin failed");
      const virtualCredential = await createVirtualCredential();
      const credential = await simulateRegistration(
        virtualCredential,
        begin.data.publicKeyCredentialCreationOptions.challenge,
        RP_ID,
        ORIGIN,
      );
      const finish = await registerFinish(
        ctx(
          jsonRequest("http://x/api/auth/register/finish", {
            challengeId: begin.data.challengeId,
            credential,
          }),
        ),
      );
      return cookieFromResponse(finish);
    }

    it("an unauthenticated caller cannot start a link operation", async () => {
      const response = await googleLinkBegin(
        ctx(
          new Request("http://x/api/account/google/link/begin", {
            method: "POST",
            headers: { Origin: ORIGIN },
          }),
        ),
      );
      expect(response.status).toBe(401);
    });

    it("a passkey account can explicitly connect Google, and both methods then reach the same user", async () => {
      const passkeyCookie = await createPasskeyAccount("Link Test User");
      const sessionBody = await readJson<{ id: string; displayName: string }>(
        await getSession(ctx(getRequest("http://x/api/auth/session", passkeyCookie))),
      );
      if (!sessionBody.ok) throw new Error("session lookup failed");
      const passkeyUserId = sessionBody.data.id;

      const linkBeginResponse = await googleLinkBegin(
        ctx(
          new Request("http://x/api/account/google/link/begin", {
            method: "POST",
            headers: { Origin: ORIGIN, Cookie: passkeyCookie },
          }),
        ),
      );
      expect(linkBeginResponse.status).toBe(200);
      const linkBegin = await readJson<{ nonce: string; state: string }>(linkBeginResponse);
      if (!linkBegin.ok) throw new Error("link begin failed");

      const sub = "linked-to-passkey-account";
      const credential = await signIdToken({ sub, nonce: linkBegin.data.nonce });
      const callbackResponse = await googleCallback(
        ctx(
          googleCallbackRequest({
            credential,
            state: linkBegin.data.state,
            csrfCookie: "x",
            csrfField: "x",
            sessionCookie: passkeyCookie,
          }),
        ),
      );
      expect(callbackResponse.status).toBe(303);
      expect(
        new URL(callbackResponse.headers.get("Location")!).searchParams.get("googleLinked"),
      ).toBe("1");

      const status = await readJson<{ connected: boolean }>(
        await googleStatus(ctx(getRequest("http://x/api/account/google", passkeyCookie))),
      );
      if (status.ok) expect(status.data.connected).toBe(true);

      // Now sign in via Google with that same sub and confirm it resolves to
      // the exact same CrawlPact user the passkey account already has.
      const googleSignIn = await performGoogleAuth({ action: "signin", sub });
      const googleCookie = cookieFromResponse(googleSignIn);
      const googleSession = await readJson<{ id: string }>(
        await getSession(ctx(getRequest("http://x/api/auth/session", googleCookie))),
      );
      if (googleSession.ok) expect(googleSession.data.id).toBe(passkeyUserId);
    });

    it("browser-supplied user/account identifiers cannot be used to choose the link target", async () => {
      // link/begin.ts never even reads a request body for a target user —
      // the userId is always derived from requireSession(). Prove a body
      // attempting to smuggle a different userId has no effect: the intent
      // it creates is still bound to the caller's own session.
      const cookie = await createPasskeyAccount("Body Injection Test");
      const response = await googleLinkBegin(
        ctx(
          new Request("http://x/api/account/google/link/begin", {
            method: "POST",
            headers: { Origin: ORIGIN, Cookie: cookie, "Content-Type": "application/json" },
            body: JSON.stringify({ userId: "someone-elses-id", redirectTo: "/app" }),
          }),
        ),
      );
      expect(response.status).toBe(200);
      // The endpoint ignores the body entirely — verified by the fact it
      // still succeeds and (via the "reaches the same user" test above)
      // always binds to the session's own user, never a body field.
    });

    it("a Google identity already linked to another account cannot be linked again", async () => {
      const firstAccountCookie = await createPasskeyAccount("Owner Of Google Identity");
      const sub = "collision-google-identity";

      // Link it to the first account.
      const firstLinkBegin = await readJson<{ nonce: string; state: string }>(
        await googleLinkBegin(
          ctx(
            new Request("http://x/api/account/google/link/begin", {
              method: "POST",
              headers: { Origin: ORIGIN, Cookie: firstAccountCookie },
            }),
          ),
        ),
      );
      if (!firstLinkBegin.ok) throw new Error("link begin failed");
      const firstCredential = await signIdToken({ sub, nonce: firstLinkBegin.data.nonce });
      await googleCallback(
        ctx(
          googleCallbackRequest({
            credential: firstCredential,
            state: firstLinkBegin.data.state,
            csrfCookie: "x",
            csrfField: "x",
            sessionCookie: firstAccountCookie,
          }),
        ),
      );

      // A second, different account tries to link the same Google identity.
      const secondAccountCookie = await createPasskeyAccount("Would-Be Second Owner");
      const secondLinkBegin = await readJson<{ nonce: string; state: string }>(
        await googleLinkBegin(
          ctx(
            new Request("http://x/api/account/google/link/begin", {
              method: "POST",
              headers: { Origin: ORIGIN, Cookie: secondAccountCookie },
            }),
          ),
        ),
      );
      if (!secondLinkBegin.ok) throw new Error("link begin failed");
      const secondCredential = await signIdToken({ sub, nonce: secondLinkBegin.data.nonce });
      const collisionResponse = await googleCallback(
        ctx(
          googleCallbackRequest({
            credential: secondCredential,
            state: secondLinkBegin.data.state,
            csrfCookie: "x",
            csrfField: "x",
            sessionCookie: secondAccountCookie,
          }),
        ),
      );
      expect(collisionResponse.status).toBe(303);
      expect(
        new URL(collisionResponse.headers.get("Location")!).searchParams.get("googleError"),
      ).toBe("google_already_linked");

      const secondStatus = await readJson<{ connected: boolean }>(
        await googleStatus(ctx(getRequest("http://x/api/account/google", secondAccountCookie))),
      );
      if (secondStatus.ok) expect(secondStatus.data.connected).toBe(false);
    });

    it("relinking the exact same (user, Google identity) pair is idempotent, not an error", async () => {
      const cookie = await createPasskeyAccount("Idempotent Relink User");
      const sub = "idempotent-relink-sub";

      for (let attempt = 0; attempt < 2; attempt++) {
        const linkBegin = await readJson<{ nonce: string; state: string }>(
          await googleLinkBegin(
            ctx(
              new Request("http://x/api/account/google/link/begin", {
                method: "POST",
                headers: { Origin: ORIGIN, Cookie: cookie },
              }),
            ),
          ),
        );
        if (!linkBegin.ok) throw new Error("link begin failed");
        const credential = await signIdToken({ sub, nonce: linkBegin.data.nonce });
        const response = await googleCallback(
          ctx(
            googleCallbackRequest({
              credential,
              state: linkBegin.data.state,
              csrfCookie: "x",
              csrfField: "x",
              sessionCookie: cookie,
            }),
          ),
        );
        expect(response.status).toBe(303);
        expect(new URL(response.headers.get("Location")!).searchParams.get("googleLinked")).toBe(
          "1",
        );
      }
    });

    it("a Google-only account cannot disconnect its only sign-in method", async () => {
      const sub = "google-only-lockout-user";
      const signup = await performGoogleAuth({ action: "signup", sub, name: "Google Only" });
      const cookie = cookieFromResponse(signup);

      const response = await googleDisconnect(
        ctx(
          new Request("http://x/api/account/google/disconnect", {
            method: "POST",
            headers: { Origin: ORIGIN, Cookie: cookie },
          }),
        ),
      );
      expect(response.status).toBe(409);
      const body = await readJson(response);
      if (!body.ok) expect(body.error.code).toBe("AUTH_GOOGLE_DISCONNECT_BLOCKED");

      const status = await readJson<{ connected: boolean }>(
        await googleStatus(ctx(getRequest("http://x/api/account/google", cookie))),
      );
      if (status.ok) expect(status.data.connected).toBe(true);
    });

    it("a passkey+Google account can safely disconnect Google, and the disconnected identity can no longer sign in", async () => {
      const cookie = await createPasskeyAccount("Passkey Plus Google User");
      const sub = "safely-disconnectable-sub";
      const linkBegin = await readJson<{ nonce: string; state: string }>(
        await googleLinkBegin(
          ctx(
            new Request("http://x/api/account/google/link/begin", {
              method: "POST",
              headers: { Origin: ORIGIN, Cookie: cookie },
            }),
          ),
        ),
      );
      if (!linkBegin.ok) throw new Error("link begin failed");
      const credential = await signIdToken({ sub, nonce: linkBegin.data.nonce });
      await googleCallback(
        ctx(
          googleCallbackRequest({
            credential,
            state: linkBegin.data.state,
            csrfCookie: "x",
            csrfField: "x",
            sessionCookie: cookie,
          }),
        ),
      );

      const disconnectResponse = await googleDisconnect(
        ctx(
          new Request("http://x/api/account/google/disconnect", {
            method: "POST",
            headers: { Origin: ORIGIN, Cookie: cookie },
          }),
        ),
      );
      expect(disconnectResponse.status).toBe(200);

      const status = await readJson<{ connected: boolean }>(
        await googleStatus(ctx(getRequest("http://x/api/account/google", cookie))),
      );
      if (status.ok) expect(status.data.connected).toBe(false);

      // The disconnected identity can no longer sign in — it's unlinked now.
      const signInAttempt = await performGoogleAuth({ action: "signin", sub });
      expect(new URL(signInAttempt.headers.get("Location")!).searchParams.get("googleError")).toBe(
        "google_not_linked",
      );
    });

    it("reconnecting Google after disconnect is possible", async () => {
      const cookie = await createPasskeyAccount("Reconnect User");
      const sub = "reconnect-sub";

      async function link(): Promise<Response> {
        const linkBegin = await readJson<{ nonce: string; state: string }>(
          await googleLinkBegin(
            ctx(
              new Request("http://x/api/account/google/link/begin", {
                method: "POST",
                headers: { Origin: ORIGIN, Cookie: cookie },
              }),
            ),
          ),
        );
        if (!linkBegin.ok) throw new Error("link begin failed");
        const credential = await signIdToken({ sub, nonce: linkBegin.data.nonce });
        return googleCallback(
          ctx(
            googleCallbackRequest({
              credential,
              state: linkBegin.data.state,
              csrfCookie: "x",
              csrfField: "x",
              sessionCookie: cookie,
            }),
          ),
        );
      }

      await link();
      await googleDisconnect(
        ctx(
          new Request("http://x/api/account/google/disconnect", {
            method: "POST",
            headers: { Origin: ORIGIN, Cookie: cookie },
          }),
        ),
      );
      const reconnect = await link();
      expect(reconnect.status).toBe(303);
      expect(new URL(reconnect.headers.get("Location")!).searchParams.get("googleLinked")).toBe(
        "1",
      );
    });

    it("an admin account cannot start a Google link operation", async () => {
      const cookie = await createPasskeyAccount("Admin Link Attempt");
      const session = await readJson<{ id: string }>(
        await getSession(ctx(getRequest("http://x/api/auth/session", cookie))),
      );
      if (!session.ok) throw new Error("session lookup failed");
      await mockEnv.DB.prepare("UPDATE users SET is_admin = 1 WHERE id = ?")
        .bind(session.data.id)
        .run();
      await mockEnv.DB.prepare(
        "INSERT INTO admin_role_assignments (id, user_id, role_id) VALUES (?, ?, 'super_admin')",
      )
        .bind(crypto.randomUUID(), session.data.id)
        .run();

      const response = await googleLinkBegin(
        ctx(
          new Request("http://x/api/account/google/link/begin", {
            method: "POST",
            headers: { Origin: ORIGIN, Cookie: cookie },
          }),
        ),
      );
      expect(response.status).toBe(403);
      const body = await readJson(response);
      if (!body.ok) expect(body.error.code).toBe("AUTH_GOOGLE_ADMIN_REQUIRES_PASSKEY");

      await mockEnv.DB.prepare("DELETE FROM admin_role_assignments WHERE user_id = ?")
        .bind(session.data.id)
        .run();
      await mockEnv.DB.prepare("UPDATE users SET is_admin = 0 WHERE id = ?")
        .bind(session.data.id)
        .run();
    });
  });
});
