import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createD1TestHarness } from "./d1-harness";
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
    const request = new Request("http://x/api/account", {
      headers: { Cookie: cookie, Origin: "https://attacker.example" },
    });
    const response = await getAccountRoute(ctx(request));
    expect(response.status).toBe(200);
  });

  it("rejects a mutating request whose Origin does not match the site", async () => {
    const request = new Request("http://x/api/account", {
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
      ctx(new Request("http://x/api/account", { headers: { Cookie: cookie } })),
    );
    const account = await readJson<{ displayName: string }>(getResponse);
    if (account.ok) expect(account.data.displayName).not.toBe("Hijacked");
  });

  it("rejects a mutating request with no Origin or Referer at all", async () => {
    const request = new Request("http://x/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ displayName: "Hijacked Again" }),
    });
    const response = await patchAccountRoute(ctx(request));
    expect(response.status).toBe(403);
  });

  it("falls back to a matching Referer when Origin is absent", async () => {
    const request = new Request("http://x/api/account", {
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
});
