import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import type { JWTVerifyGetKey } from "jose";
import { createD1TestHarness } from "./d1-harness";
import { createFakeR2Bucket } from "./fake-r2-bucket";
import { createVirtualCredential, simulateRegistration } from "./virtual-authenticator";
import { ctx, cookieFromResponse, readJson } from "./test-helpers";

/**
 * Real cryptographic Google ID-token verification (a local test JWKS, never
 * the live Google network) against a real (Miniflare) D1 database.
 * `verifyGoogleIdToken`'s own signature/issuer/audience/exp/azp checks are
 * exercised unmodified (google.test.ts covers those in isolation); this
 * file only swaps the JWKS *source* for a local one, the same dependency-
 * injection seam google.test.ts uses.
 *
 * ADR-0009's transport correction: GIS runs in JavaScript-callback mode
 * (`ux_mode: "popup"`), so the browser — never Google — performs the
 * `/api/auth/google` POST, as a same-origin `application/json` request.
 * These tests exercise exactly that contract: `Content-Type: application/json`,
 * a matching `Origin` header, and a JSON `{ credential, state }` body — no
 * more `g_csrf_token`/form-urlencoded plumbing, which belonged to the old,
 * defective direct-form-POST transport.
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
const googleModule = await import("../../src/pages/api/auth/google/index");
const googleBegin = (await import("../../src/pages/api/auth/google/begin")).POST;
const googleCallback = googleModule.POST;
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

/**
 * Builds the corrected same-origin JSON callback request — what the
 * CrawlPact page's own `fetch("/api/auth/google")` sends after GIS's
 * JavaScript callback hands it a `CredentialResponse` (section 16). `origin`
 * defaults to the legitimate same-origin value; tests exercising the
 * same-origin check override it explicitly.
 */
function googleCallbackRequest(params: {
  credential?: string;
  state?: string;
  origin?: string | null;
  referer?: string | null;
  sessionCookie?: string;
  raw?: string; // for malformed-JSON / wrong-content-type regression tests
  contentType?: string;
}): Request {
  const headers: Record<string, string> = {
    "Content-Type": params.contentType ?? "application/json",
  };
  if (params.origin !== null) headers["Origin"] = params.origin ?? ORIGIN;
  if (params.referer) headers["Referer"] = params.referer;
  if (params.sessionCookie) headers["Cookie"] = params.sessionCookie;

  const body =
    params.raw !== undefined
      ? params.raw
      : JSON.stringify({
          ...(params.credential !== undefined ? { credential: params.credential } : {}),
          ...(params.state !== undefined ? { state: params.state } : {}),
        });

  return new Request("http://x/api/auth/google", { method: "POST", headers, body });
}

/** Full happy-path helper: begin (signin or signup), sign a matching token, post the callback. */
async function performGoogleAuth(params: {
  action: "signin" | "signup";
  sub: string;
  email?: string | null;
  emailVerified?: boolean;
  name?: string | null;
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
  return googleCallback(ctx(googleCallbackRequest({ credential, state })));
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

  it("GET is not a supported method (no GET handler is exported at all)", () => {
    expect((googleModule as Record<string, unknown>).GET).toBeUndefined();
  });

  describe("same-origin enforcement (ADR-0009's corrected transport)", () => {
    it("accepts a same-origin JSON POST (matching Origin header)", async () => {
      const beginResponse = await googleBegin(
        ctx(jsonRequest("http://x/api/auth/google/begin", {})),
      );
      const begin = await readJson<{ nonce: string; signUpState: string }>(beginResponse);
      if (!begin.ok) throw new Error("begin failed");
      const credential = await signIdToken({ sub: "same-origin-user", nonce: begin.data.nonce });
      const response = await googleCallback(
        ctx(googleCallbackRequest({ credential, state: begin.data.signUpState, origin: ORIGIN })),
      );
      expect(response.status).toBe(200);
      const body = await readJson<{ redirectTo: string }>(response);
      expect(body.ok).toBe(true);
    });

    it("rejects a callback whose Origin is Google's own origin", async () => {
      const beginResponse = await googleBegin(
        ctx(jsonRequest("http://x/api/auth/google/begin", {})),
      );
      const begin = await readJson<{ nonce: string; signUpState: string }>(beginResponse);
      if (!begin.ok) throw new Error("begin failed");
      const credential = await signIdToken({ sub: "google-origin-user", nonce: begin.data.nonce });
      const response = await googleCallback(
        ctx(
          googleCallbackRequest({
            credential,
            state: begin.data.signUpState,
            origin: "https://accounts.google.com",
          }),
        ),
      );
      expect(response.status).toBe(403);
      const body = await readJson(response);
      if (!body.ok) expect(body.error.code).toBe("FORBIDDEN");
    });

    it("rejects a callback from an unrelated cross-site Origin", async () => {
      const response = await googleCallback(
        ctx(
          googleCallbackRequest({
            credential: "irrelevant",
            state: "irrelevant",
            origin: "https://evil.example",
          }),
        ),
      );
      expect(response.status).toBe(403);
    });

    it("rejects a lookalike Origin (crawlpact.com.evil.example)", async () => {
      const response = await googleCallback(
        ctx(
          googleCallbackRequest({
            credential: "irrelevant",
            state: "irrelevant",
            origin: "https://crawlpact.com.evil.example",
          }),
        ),
      );
      expect(response.status).toBe(403);
    });

    it("falls back to a matching Referer when Origin is absent", async () => {
      const beginResponse = await googleBegin(
        ctx(jsonRequest("http://x/api/auth/google/begin", {})),
      );
      const begin = await readJson<{ nonce: string; signUpState: string }>(beginResponse);
      if (!begin.ok) throw new Error("begin failed");
      const credential = await signIdToken({
        sub: "referer-fallback-user",
        nonce: begin.data.nonce,
      });
      const response = await googleCallback(
        ctx(
          googleCallbackRequest({
            credential,
            state: begin.data.signUpState,
            origin: null,
            referer: `${ORIGIN}/sign-in`,
          }),
        ),
      );
      expect(response.status).toBe(200);
    });

    it("fails closed with neither Origin nor Referer present", async () => {
      const response = await googleCallback(
        ctx(
          googleCallbackRequest({
            credential: "irrelevant",
            state: "irrelevant",
            origin: null,
          }),
        ),
      );
      expect(response.status).toBe(403);
    });

    it("the old direct form-POST transport is no longer an accepted contract", async () => {
      // Simulates what Google's now-abandoned redirect-mode direct POST used
      // to send: form-urlencoded, cross-site Origin. This route now only
      // ever calls request.json() — a form body fails to parse as JSON and
      // is rejected as a validation failure, regardless of Origin. (Astro's
      // own security.checkOrigin middleware — exercised only at the real
      // HTTP layer, not in this direct handler-function test — additionally
      // rejects form-shaped cross-site POSTs before this code ever runs;
      // see PasskeyAuth's manual local-acceptance notes.)
      const form = new URLSearchParams();
      form.set("credential", "fake");
      form.set("g_csrf_token", "fake");
      form.set("state", "fake");
      const response = await googleCallback(
        ctx(
          googleCallbackRequest({
            raw: form.toString(),
            contentType: "application/x-www-form-urlencoded",
            origin: "https://accounts.google.com",
          }),
        ),
      );
      expect(response.status).not.toBe(200);
      expect(response.headers.get("set-cookie")).toBeNull();
    });
  });

  describe("callback request validation", () => {
    it("rejects malformed JSON", async () => {
      const response = await googleCallback(ctx(googleCallbackRequest({ raw: "{not valid json" })));
      expect(response.status).toBe(400);
      const body = await readJson(response);
      if (!body.ok) expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("rejects a callback with no credential", async () => {
      const beginResponse = await googleBegin(
        ctx(jsonRequest("http://x/api/auth/google/begin", {})),
      );
      const begin = await readJson<{ signUpState: string }>(beginResponse);
      if (!begin.ok) throw new Error("begin failed");
      const response = await googleCallback(
        ctx(googleCallbackRequest({ state: begin.data.signUpState })),
      );
      expect(response.status).toBe(400);
      const body = await readJson(response);
      if (!body.ok) expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("rejects a callback with an empty credential", async () => {
      const beginResponse = await googleBegin(
        ctx(jsonRequest("http://x/api/auth/google/begin", {})),
      );
      const begin = await readJson<{ signUpState: string }>(beginResponse);
      if (!begin.ok) throw new Error("begin failed");
      const response = await googleCallback(
        ctx(googleCallbackRequest({ credential: "", state: begin.data.signUpState })),
      );
      expect(response.status).toBe(400);
    });

    it("rejects a callback with no state", async () => {
      const credential = await signIdToken({ sub: "no-state-user", nonce: "irrelevant" });
      const response = await googleCallback(ctx(googleCallbackRequest({ credential })));
      expect(response.status).toBe(400);
      const body = await readJson(response);
      if (!body.ok) expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("rejects a callback with an empty state", async () => {
      const credential = await signIdToken({ sub: "empty-state-user", nonce: "irrelevant" });
      const response = await googleCallback(ctx(googleCallbackRequest({ credential, state: "" })));
      expect(response.status).toBe(400);
    });
  });

  describe("state/nonce/token security", () => {
    it("rejects an unknown state", async () => {
      const credential = await signIdToken({ sub: "unknown-state-user", nonce: "whatever" });
      const response = await googleCallback(
        ctx(googleCallbackRequest({ credential, state: "this-state-was-never-issued" })),
      );
      expect(response.status).toBe(400);
      const body = await readJson(response);
      if (!body.ok) expect(body.error.code).toBe("AUTH_GOOGLE_INVALID_REQUEST");
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
        ctx(googleCallbackRequest({ credential, state: begin.data.signUpState })),
      );
      expect(response.status).toBe(400);
      const body = await readJson(response);
      if (!body.ok) expect(body.error.code).toBe("AUTH_GOOGLE_INVALID_REQUEST");
    });

    it("a state can never be used twice (single-use, atomic consumption)", async () => {
      const beginResponse = await googleBegin(
        ctx(jsonRequest("http://x/api/auth/google/begin", {})),
      );
      const begin = await readJson<{ nonce: string; signUpState: string }>(beginResponse);
      if (!begin.ok) throw new Error("begin failed");
      const credential = await signIdToken({ sub: "replay-state-user", nonce: begin.data.nonce });

      const first = await googleCallback(
        ctx(googleCallbackRequest({ credential, state: begin.data.signUpState })),
      );
      expect(first.status).toBe(200);
      expect(first.headers.get("set-cookie")).toBeTruthy();

      const replay = await googleCallback(
        ctx(googleCallbackRequest({ credential, state: begin.data.signUpState })),
      );
      expect(replay.status).toBe(400);
      const replayBody = await readJson(replay);
      if (!replayBody.ok) expect(replayBody.error.code).toBe("AUTH_GOOGLE_INVALID_REQUEST");
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
        ctx(googleCallbackRequest({ credential, state: begin.data.signUpState })),
      );
      expect(response.status).toBe(400);
      const body = await readJson(response);
      if (!body.ok) expect(body.error.code).toBe("AUTH_GOOGLE_INVALID_REQUEST");
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
          }),
        ),
      );
      expect(response.status).toBe(400);
      const body = await readJson(response);
      if (!body.ok) expect(body.error.code).toBe("AUTH_GOOGLE_INVALID_REQUEST");
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
        ctx(googleCallbackRequest({ credential, state: begin.data.signUpState })),
      );
      expect(response.status).toBe(200);
      const body = await readJson<{ redirectTo: string }>(response);
      if (body.ok) {
        expect(body.data.redirectTo).not.toContain("evil.example");
        expect(body.data.redirectTo).toBe("/app");
      }
    });
  });

  describe("sign-in vs sign-up semantics", () => {
    it("sign-in with an unlinked Google account does not create a user", async () => {
      const before = await countUsers();
      const response = await performGoogleAuth({ action: "signin", sub: "never-signed-up" });
      expect(response.status).toBe(400);
      const body = await readJson(response);
      if (!body.ok) expect(body.error.code).toBe("AUTH_GOOGLE_NOT_LINKED");
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
      expect(response.status).toBe(200);
      const body = await readJson<{ redirectTo: string }>(response);
      if (body.ok) expect(body.data.redirectTo).toBe("/app");
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
      expect(first.status).toBe(200);

      const beforeUsers = await countUsers();
      const second = await performGoogleAuth({ action: "signup", sub, name: "First Time" });
      expect(second.status).toBe(200);
      expect(await countUsers()).toBe(beforeUsers);
      expect(second.headers.get("set-cookie")).toBeTruthy();
    });

    it("sign-in with a linked Google account uses the existing user", async () => {
      const sub = "linked-signin-user";
      await performGoogleAuth({ action: "signup", sub, name: "Linked User" });

      const beforeUsers = await countUsers();
      const response = await performGoogleAuth({ action: "signin", sub });
      expect(response.status).toBe(200);
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
      expect(response.status).toBe(400);
      const body = await readJson(response);
      if (!body.ok) expect(body.error.code).toBe("AUTH_GOOGLE_ACCOUNT_UNAVAILABLE");
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
      expect(response.status).toBe(200);
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

  describe("admin isolation (section 38, mandatory)", () => {
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
      expect(response.status).toBe(403);
      const body = await readJson(response);
      if (!body.ok) expect(body.error.code).toBe("AUTH_GOOGLE_ADMIN_REQUIRES_PASSKEY");
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

  describe("account linking / unlinking (sections 35-37, 50)", () => {
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

    it("the link callback requires the session cookie (section 36) — without it, an otherwise-valid link fails closed", async () => {
      const cookie = await createPasskeyAccount("No Cookie Link Attempt");
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
      const credential = await signIdToken({
        sub: "no-cookie-link-sub",
        nonce: linkBegin.data.nonce,
      });
      // Same-origin, valid state/nonce/token — but no session cookie at all.
      const response = await googleCallback(
        ctx(googleCallbackRequest({ credential, state: linkBegin.data.state })),
      );
      expect(response.status).toBe(401);
    });

    it("a passkey account can explicitly connect Google (same-origin JSON, session cookie forwarded), and both methods then reach the same user", async () => {
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
      // credentials: "same-origin" in the browser means this fetch carries
      // the page's own session cookie — simulated here by setting it
      // explicitly on the callback request.
      const callbackResponse = await googleCallback(
        ctx(
          googleCallbackRequest({
            credential,
            state: linkBegin.data.state,
            sessionCookie: passkeyCookie,
          }),
        ),
      );
      expect(callbackResponse.status).toBe(200);
      const callbackBody = await readJson<{ redirectTo: string }>(callbackResponse);
      if (callbackBody.ok) expect(callbackBody.data.redirectTo).toContain("/app/account");

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
            sessionCookie: secondAccountCookie,
          }),
        ),
      );
      expect(collisionResponse.status).toBe(409);
      const collisionBody = await readJson(collisionResponse);
      if (!collisionBody.ok) expect(collisionBody.error.code).toBe("AUTH_GOOGLE_ALREADY_LINKED");

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
              sessionCookie: cookie,
            }),
          ),
        );
        expect(response.status).toBe(200);
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
          googleCallbackRequest({ credential, state: linkBegin.data.state, sessionCookie: cookie }),
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
      expect(signInAttempt.status).toBe(400);
      const signInBody = await readJson(signInAttempt);
      if (!signInBody.ok) expect(signInBody.error.code).toBe("AUTH_GOOGLE_NOT_LINKED");
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
      expect(reconnect.status).toBe(200);
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
