import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { exportPKCS8, generateKeyPair, jwtVerify, importSPKI, exportSPKI } from "jose";
import {
  getGoogleAccessToken,
  parseServiceAccountCredential,
  resetGoogleAccessTokenCacheForTests,
} from "./service-account";

const CLIENT_EMAIL = "crawlpact-analytics@crawlpact-analytics-seo.iam.gserviceaccount.com";
const TOKEN_URI = "https://oauth2.googleapis.com/token";
const SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];

let privateKeyPem: string;
let publicKeyPem: string;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  privateKeyPem = await exportPKCS8(pair.privateKey);
  publicKeyPem = await exportSPKI(pair.publicKey);
});

function credentialJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    client_email: CLIENT_EMAIL,
    private_key: privateKeyPem,
    token_uri: TOKEN_URI,
    ...overrides,
  });
}

function tokenResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("parseServiceAccountCredential", () => {
  it("parses a valid credential", () => {
    const result = parseServiceAccountCredential(credentialJson());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.credential.clientEmail).toBe(CLIENT_EMAIL);
      expect(result.credential.tokenUri).toBe(TOKEN_URI);
    }
  });

  it("falls back to Google's standard token endpoint when token_uri is absent", () => {
    const result = parseServiceAccountCredential(
      JSON.stringify({ client_email: CLIENT_EMAIL, private_key: privateKeyPem }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.credential.tokenUri).toBe("https://oauth2.googleapis.com/token");
  });

  it("rejects a missing value", () => {
    expect(parseServiceAccountCredential(undefined)).toEqual({ ok: false, reason: "missing" });
    expect(parseServiceAccountCredential("")).toEqual({ ok: false, reason: "missing" });
  });

  it("rejects malformed JSON", () => {
    expect(parseServiceAccountCredential("{not json")).toEqual({
      ok: false,
      reason: "invalid_json",
    });
  });

  it("rejects a JSON array or primitive", () => {
    expect(parseServiceAccountCredential("[]")).toEqual({ ok: false, reason: "invalid_json" });
    expect(parseServiceAccountCredential('"just a string"')).toEqual({
      ok: false,
      reason: "invalid_json",
    });
  });

  it("rejects an object missing client_email", () => {
    expect(parseServiceAccountCredential(JSON.stringify({ private_key: privateKeyPem }))).toEqual({
      ok: false,
      reason: "missing_fields",
    });
  });

  it("rejects an object missing private_key", () => {
    expect(parseServiceAccountCredential(JSON.stringify({ client_email: CLIENT_EMAIL }))).toEqual({
      ok: false,
      reason: "missing_fields",
    });
  });
});

describe("getGoogleAccessToken", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    resetGoogleAccessTokenCacheForTests();
  });

  it("reports not_configured when the credential is absent", async () => {
    const result = await getGoogleAccessToken(undefined, SCOPES);
    expect(result).toEqual({ ok: false, reason: "not_configured" });
  });

  it("reports invalid_credential_json for malformed JSON", async () => {
    const result = await getGoogleAccessToken("{broken", SCOPES);
    expect(result).toEqual({ ok: false, reason: "invalid_credential_json" });
  });

  it("reports invalid_credential_json when private_key is not a valid PEM", async () => {
    const result = await getGoogleAccessToken(
      credentialJson({ private_key: "not-a-real-key" }),
      SCOPES,
    );
    expect(result).toEqual({ ok: false, reason: "invalid_credential_json" });
  });

  it("exchanges a correctly-shaped RS256 JWT assertion for an access token", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit = {};
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedInit = init ?? {};
      return tokenResponse({
        access_token: "ya29.test-token",
        expires_in: 3600,
        token_type: "Bearer",
      });
    }) as unknown as typeof fetch;

    const result = await getGoogleAccessToken(credentialJson(), SCOPES);
    expect(result).toEqual({
      ok: true,
      accessToken: "ya29.test-token",
      expiresAt: expect.any(Number),
    });

    expect(capturedUrl).toBe(TOKEN_URI);
    expect(capturedInit.method).toBe("POST");
    const headers = capturedInit.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/x-www-form-urlencoded");

    const body = new URLSearchParams(capturedInit.body as string);
    expect(body.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
    const assertion = body.get("assertion");
    expect(assertion).toBeTruthy();

    const publicKey = await importSPKI(publicKeyPem, "RS256");
    const { payload, protectedHeader } = await jwtVerify(assertion!, publicKey);
    expect(protectedHeader.alg).toBe("RS256");
    expect(payload.iss).toBe(CLIENT_EMAIL);
    expect(payload.aud).toBe(TOKEN_URI);
    expect(payload.scope).toBe(SCOPES.join(" "));
    expect(typeof payload.iat).toBe("number");
    expect(typeof payload.exp).toBe("number");
    expect((payload.exp as number) - (payload.iat as number)).toBeLessThanOrEqual(3600);
  });

  it("reports token_exchange_failed on a non-2xx token endpoint response", async () => {
    globalThis.fetch = vi.fn(async () =>
      tokenResponse({ error: "invalid_grant" }, 400),
    ) as unknown as typeof fetch;

    const result = await getGoogleAccessToken(credentialJson(), SCOPES);
    expect(result).toEqual({ ok: false, reason: "token_exchange_failed" });
  });

  it("reports token_exchange_failed when the network request throws", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    const result = await getGoogleAccessToken(credentialJson(), SCOPES);
    expect(result).toEqual({ ok: false, reason: "token_exchange_failed" });
  });

  it("reports token_exchange_failed when the response body is missing access_token", async () => {
    globalThis.fetch = vi.fn(async () =>
      tokenResponse({ expires_in: 3600 }),
    ) as unknown as typeof fetch;
    const result = await getGoogleAccessToken(credentialJson(), SCOPES);
    expect(result).toEqual({ ok: false, reason: "token_exchange_failed" });
  });

  it("caches a valid token and does not re-exchange before expiry", async () => {
    const fetchMock = vi.fn(async () =>
      tokenResponse({ access_token: "cached-token", expires_in: 3600 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const first = await getGoogleAccessToken(credentialJson(), SCOPES);
    const second = await getGoogleAccessToken(credentialJson(), SCOPES);

    expect(first).toEqual(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("re-exchanges once the cached token is within the expiry safety margin", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse({ access_token: "short-lived", expires_in: 60 }))
      .mockResolvedValueOnce(tokenResponse({ access_token: "refreshed", expires_in: 3600 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const first = await getGoogleAccessToken(credentialJson(), SCOPES);
    expect(first).toMatchObject({ ok: true, accessToken: "short-lived" });

    // 60s expiry is already inside the 5-minute safety margin, so the very
    // next call must refresh rather than serve the cached value.
    const second = await getGoogleAccessToken(credentialJson(), SCOPES);
    expect(second).toMatchObject({ ok: true, accessToken: "refreshed" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("re-exchanges when the requested scopes differ from the cached token's scopes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse({ access_token: "scope-a-token", expires_in: 3600 }))
      .mockResolvedValueOnce(tokenResponse({ access_token: "scope-b-token", expires_in: 3600 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await getGoogleAccessToken(credentialJson(), [
      "https://www.googleapis.com/auth/webmasters.readonly",
    ]);
    await getGoogleAccessToken(credentialJson(), [
      "https://www.googleapis.com/auth/analytics.readonly",
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never leaks the private key or raw credential JSON through any error result", async () => {
    const outcomes = await Promise.all([
      getGoogleAccessToken(undefined, SCOPES),
      getGoogleAccessToken("{broken", SCOPES),
      getGoogleAccessToken(credentialJson({ private_key: "not-a-real-key" }), SCOPES),
    ]);

    const serialized = JSON.stringify(outcomes);
    expect(serialized).not.toContain("PRIVATE KEY");
    expect(serialized).not.toContain(privateKeyPem);
    expect(serialized).not.toContain(CLIENT_EMAIL);
  });
});
