import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createD1TestHarness } from "./d1-harness";
import { createFakeR2Bucket } from "./fake-r2-bucket";
import { createVirtualCredential, simulateRegistration } from "./virtual-authenticator";
import { cookieFromResponse, ctx, jsonRequest, readJson } from "./test-helpers";

/**
 * Verifies the Origin/Referer same-site check in requireSession
 * (lib/auth/require-session.ts) actually rejects a forged cross-site
 * request — the other integration suites only prove legitimate
 * same-origin requests still work after adding this check.
 */

const RP_ID = "localhost";
const ORIGIN = "http://localhost:4321";
// Phase 2 of the app-subdomain migration (ADR-0010): a second trusted
// CrawlPact origin. Used below to prove `assertSameOrigin` rejects a
// *sibling*-origin mutation (one trusted CrawlPact origin's Origin header
// presented on a request that arrived on the *other* trusted origin) — the
// specific weakness a naive `[PUBLIC_SITE_URL, PUBLIC_APP_URL].includes(origin)`
// allowlist would have, and which `lib/auth/same-origin.ts` explicitly
// avoids by checking the request's own arrival origin instead.
const APP_ORIGIN = "https://app.crawlpact.test";

let mockEnv: Cloudflare.Env;
vi.mock("../../src/lib/env", () => ({ getEnv: () => mockEnv }));

const registerBegin = (await import("../../src/pages/api/auth/register/begin")).POST;
const registerFinish = (await import("../../src/pages/api/auth/register/finish")).POST;
const getAccountRoute = (await import("../../src/pages/api/account/index")).GET;
const patchAccountRoute = (await import("../../src/pages/api/account/index")).PATCH;

describe("CSRF: cross-site requests are rejected on authenticated mutating endpoints", () => {
  let dispose: () => Promise<void>;
  let cookie: string;

  beforeAll(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    mockEnv = {
      DB: harness.db,
      AGENCY_LOGOS: createFakeR2Bucket(),
      PUBLIC_APP_ENV: "local",
      PUBLIC_SITE_URL: ORIGIN,
      PUBLIC_APP_URL: APP_ORIGIN,
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

    const beginResponse = await registerBegin(
      ctx(jsonRequest("http://x/register/begin", "POST", { displayName: "Ada" })),
    );
    const begin = await readJson<{
      challengeId: string;
      publicKeyCredentialCreationOptions: { challenge: string };
    }>(beginResponse);
    if (!begin.ok) throw new Error("begin failed");
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
    cookie = cookieFromResponse(finishResponse);
  });

  afterAll(async () => {
    await dispose();
  });

  it("allows a same-origin GET even with an attacker's Origin header (read-only, exempt)", async () => {
    const request = new Request("http://localhost:4321/api/account", {
      headers: { Cookie: cookie, Origin: "https://attacker.example" },
    });
    const response = await getAccountRoute(ctx(request));
    expect(response.status).toBe(200);
  });

  it("rejects a mutating request whose Origin does not match the site", async () => {
    const request = new Request("http://localhost:4321/api/account", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Origin: "https://attacker.example",
      },
      body: JSON.stringify({ displayName: "Hijacked" }),
    });
    const response = await patchAccountRoute(ctx(request));
    expect(response.status).toBe(403);
    const body = await readJson(response);
    if (!body.ok) expect(body.error.code).toBe("FORBIDDEN");

    // Confirm the mutation genuinely did not apply.
    const getResponse = await getAccountRoute(
      ctx(new Request("http://localhost:4321/api/account", { headers: { Cookie: cookie } })),
    );
    const account = await readJson<{ displayName: string }>(getResponse);
    if (account.ok) expect(account.data.displayName).not.toBe("Hijacked");
  });

  it("rejects a mutating request with no Origin or Referer at all", async () => {
    const request = new Request("http://localhost:4321/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ displayName: "Hijacked Again" }),
    });
    const response = await patchAccountRoute(ctx(request));
    expect(response.status).toBe(403);
  });

  it("falls back to a matching Referer when Origin is absent", async () => {
    const request = new Request("http://localhost:4321/api/account", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Referer: `${ORIGIN}/app/account`,
      },
      body: JSON.stringify({ displayName: "Ada Renamed" }),
    });
    const response = await patchAccountRoute(ctx(request));
    expect(response.status).toBe(200);
  });

  // Phase 2 of the app-subdomain migration (ADR-0010): the sibling-origin
  // case. Both ORIGIN and APP_ORIGIN are trusted CrawlPact origins — a naive
  // `origins.includes(header)` allowlist would wrongly accept either one
  // regardless of which origin the request actually arrived on.
  // `assertSameOrigin` must reject whenever the Origin header doesn't match
  // *this request's own* arrival origin, even if it's the *other* trusted one.
  it("rejects a mutation that arrived on the app origin but claims the public origin as its Origin header", async () => {
    const request = new Request(`${APP_ORIGIN}/api/account`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie, Origin: ORIGIN },
      body: JSON.stringify({ displayName: "Sibling Hijacked" }),
    });
    const response = await patchAccountRoute(ctx(request));
    expect(response.status).toBe(403);
    const body = await readJson(response);
    if (!body.ok) expect(body.error.code).toBe("FORBIDDEN");
  });

  it("rejects a mutation that arrived on the public origin but claims the app origin as its Origin header", async () => {
    const request = new Request(`${ORIGIN}/api/account`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie, Origin: APP_ORIGIN },
      body: JSON.stringify({ displayName: "Sibling Hijacked Reverse" }),
    });
    const response = await patchAccountRoute(ctx(request));
    expect(response.status).toBe(403);
  });

  it("accepts a mutation that arrives on the app origin with a matching app Origin header", async () => {
    const request = new Request(`${APP_ORIGIN}/api/account`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie, Origin: APP_ORIGIN },
      body: JSON.stringify({ displayName: "Ada On App Origin" }),
    });
    const response = await patchAccountRoute(ctx(request));
    expect(response.status).toBe(200);
  });

  it("rejects a sibling-origin Referer fallback the same way", async () => {
    const request = new Request(`${APP_ORIGIN}/api/account`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Referer: `${ORIGIN}/app/account`,
      },
      body: JSON.stringify({ displayName: "Sibling Referer Hijacked" }),
    });
    const response = await patchAccountRoute(ctx(request));
    expect(response.status).toBe(403);
  });
});
