import { describe, expect, it, vi } from "vitest";
import {
  createVirtualCredential,
  simulateAuthentication,
  simulateRegistration,
} from "../../../tests/integration/virtual-authenticator";

const RP_ID = "crawlpact.com";
const PUBLIC_ORIGIN = "https://crawlpact.com";
const APP_ORIGIN = "https://app.crawlpact.com";

let mockEnv: Partial<Cloudflare.Env>;
vi.mock("../env", () => ({ getEnv: () => mockEnv }));

const {
  beginPasskeyRegistration,
  finishPasskeyRegistration,
  beginPasskeyAuthentication,
  finishPasskeyAuthentication,
} = await import("./webauthn");

function baseEnv(): Partial<Cloudflare.Env> {
  return {
    PUBLIC_SITE_URL: PUBLIC_ORIGIN,
    PUBLIC_APP_URL: APP_ORIGIN,
    WEBAUTHN_RP_ID: RP_ID,
    WEBAUTHN_RP_ORIGIN: PUBLIC_ORIGIN,
    SESSION_SIGNING_SECRET: "test-signing-secret-long-enough-for-hmac",
  };
}

function localSingleOriginEnv(): Partial<Cloudflare.Env> {
  const local = "http://localhost:4321";
  return {
    PUBLIC_SITE_URL: local,
    PUBLIC_APP_URL: local,
    WEBAUTHN_RP_ID: "localhost",
    WEBAUTHN_RP_ORIGIN: local,
    SESSION_SIGNING_SECRET: "test-signing-secret-long-enough-for-hmac",
  };
}

/**
 * Stage C of the app-subdomain migration (Master Finalization Directive,
 * Phase 4C, 2026-09-15): with a real, distinct app origin configured, a
 * WebAuthn ceremony may now only begin or finish on the app origin —
 * `webauthnCeremonyOrigins()` (`webauthn.ts`) is a narrower rule than
 * `getTrustedOrigins()` (`origin.ts`), which still trusts the apex for
 * every other purpose (CSRF, general request classification). `/api/auth/**`
 * is already `APP_ONLY` and 404s on the apex at the host-boundary layer
 * (`worker.ts`) — these are pure unit tests against
 * `beginPasskeyRegistration`/`finishPasskeyRegistration`/etc. directly (no
 * D1 needed), proving the ceremony logic itself independently enforces this,
 * not merely relying on that outer boundary. `WEBAUTHN_RP_ID` is asserted
 * unchanged throughout — Stage C narrows the ceremony *origin*, never the
 * RP ID, and existing credentials are unaffected by any of this.
 */
describe("WebAuthn ceremony origin — Stage C (app-origin-only once a distinct app origin exists)", () => {
  describe("registration", () => {
    it("succeeds when begun and finished at the app origin", async () => {
      mockEnv = baseEnv();
      const credential = await createVirtualCredential();
      const beginRequest = new Request(`${APP_ORIGIN}/api/auth/register/begin`, {
        method: "POST",
      });
      const { challengeToken, options } = await beginPasskeyRegistration(beginRequest, "Ada", []);
      const response = await simulateRegistration(credential, options.challenge, RP_ID, APP_ORIGIN);
      const finishRequest = new Request(`${APP_ORIGIN}/api/auth/register/finish`, {
        method: "POST",
      });
      const outcome = await finishPasskeyRegistration(finishRequest, challengeToken, response);
      expect(outcome.ok).toBe(true);
    });

    it("rejects a begin request arriving on the apex (public origin) — no longer a permitted ceremony origin", async () => {
      mockEnv = baseEnv();
      const beginRequest = new Request(`${PUBLIC_ORIGIN}/api/auth/register/begin`, {
        method: "POST",
      });
      await expect(beginPasskeyRegistration(beginRequest, "Ada", [])).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    it("rejects a begin request arriving on an untrusted origin", async () => {
      mockEnv = baseEnv();
      const beginRequest = new Request("https://attacker.example/api/auth/register/begin", {
        method: "POST",
      });
      await expect(beginPasskeyRegistration(beginRequest, "Ada", [])).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    it("rejects a finish request whose challenge was signed for the app origin but whose HTTP request itself arrives on the apex", async () => {
      mockEnv = baseEnv();
      const credential = await createVirtualCredential();
      const beginRequest = new Request(`${APP_ORIGIN}/api/auth/register/begin`, {
        method: "POST",
      });
      const { challengeToken, options } = await beginPasskeyRegistration(beginRequest, "Ada", []);
      const response = await simulateRegistration(credential, options.challenge, RP_ID, APP_ORIGIN);
      const finishRequest = new Request(`${PUBLIC_ORIGIN}/api/auth/register/finish`, {
        method: "POST",
      });
      const outcome = await finishPasskeyRegistration(finishRequest, challengeToken, response);
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) expect(outcome.reason).toBe("challenge_invalid");
    });

    it("rejects a finish request arriving on an untrusted origin, even with an otherwise-valid response", async () => {
      mockEnv = baseEnv();
      const credential = await createVirtualCredential();
      const beginRequest = new Request(`${APP_ORIGIN}/api/auth/register/begin`, {
        method: "POST",
      });
      const { challengeToken, options } = await beginPasskeyRegistration(beginRequest, "Ada", []);
      const response = await simulateRegistration(credential, options.challenge, RP_ID, APP_ORIGIN);
      const finishRequest = new Request("https://attacker.example/api/auth/register/finish", {
        method: "POST",
      });
      const outcome = await finishPasskeyRegistration(finishRequest, challengeToken, response);
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) expect(outcome.reason).toBe("challenge_invalid");
    });

    it("rejects a challenge token whose signed origin field is the apex — a tampered/stale token, not merely an arrival-origin problem", async () => {
      // Manually signs a token exactly as beginPasskeyRegistration would,
      // but with the apex as the pinned `origin` field — simulating either a
      // forged token or a genuine in-flight ceremony from the moment of
      // Stage C cutover. Proves the *payload* origin check
      // (`isWebauthnCeremonyOrigin(verified.payload.origin)`) independently
      // rejects this, not just the finish request's own arrival-origin
      // check (which here correctly arrives on the app origin).
      mockEnv = baseEnv();
      const { signToken } = await import("@crawlpact/core");
      const credential = await createVirtualCredential();
      const challenge = "tampered-origin-challenge";
      const tamperedToken = await signToken(
        {
          purpose: "register",
          challenge,
          displayName: "Ada",
          label: "Passkey",
          origin: PUBLIC_ORIGIN,
        },
        mockEnv.SESSION_SIGNING_SECRET as string,
        300,
      );
      const response = await simulateRegistration(credential, challenge, RP_ID, PUBLIC_ORIGIN);
      const finishRequest = new Request(`${APP_ORIGIN}/api/auth/register/finish`, {
        method: "POST",
      });
      const outcome = await finishPasskeyRegistration(finishRequest, tamperedToken, response);
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) expect(outcome.reason).toBe("challenge_invalid");
    });

    it("rejects a legacy challenge token with no origin field (pre-Phase-2 shape) safely, not by falling back to any default", async () => {
      mockEnv = baseEnv();
      const { signToken } = await import("@crawlpact/core");
      const credential = await createVirtualCredential();
      const legacyToken = await signToken(
        {
          purpose: "register",
          challenge: "legacy-challenge",
          displayName: "Ada",
          label: "Passkey",
        },
        mockEnv.SESSION_SIGNING_SECRET as string,
        300,
      );
      const response = await simulateRegistration(
        credential,
        "legacy-challenge",
        RP_ID,
        APP_ORIGIN,
      );
      const finishRequest = new Request(`${APP_ORIGIN}/api/auth/register/finish`, {
        method: "POST",
      });
      const outcome = await finishPasskeyRegistration(finishRequest, legacyToken, response);
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) expect(outcome.reason).toBe("challenge_invalid");
    });
  });

  describe("authentication", () => {
    /** Registers a real credential first (on the app origin) so authentication tests have a genuine, correctly COSE-encoded `WebAuthnCredential` to verify against. */
    async function registerCredential() {
      const virtualCredential = await createVirtualCredential();
      const beginRequest = new Request(`${APP_ORIGIN}/api/auth/register/begin`, {
        method: "POST",
      });
      const { challengeToken, options } = await beginPasskeyRegistration(beginRequest, "Ada", []);
      const response = await simulateRegistration(
        virtualCredential,
        options.challenge,
        RP_ID,
        APP_ORIGIN,
      );
      const finishRequest = new Request(`${APP_ORIGIN}/api/auth/register/finish`, {
        method: "POST",
      });
      const outcome = await finishPasskeyRegistration(finishRequest, challengeToken, response);
      if (!outcome.ok) throw new Error("registration setup failed");
      return { virtualCredential, storedCredential: outcome.credential };
    }

    it("succeeds when begun and finished at the app origin — an existing credential authenticates fine post-cutover", async () => {
      mockEnv = baseEnv();
      const { virtualCredential, storedCredential } = await registerCredential();

      const beginRequest = new Request(`${APP_ORIGIN}/api/auth/login/begin`, { method: "POST" });
      const { challengeToken, options } = await beginPasskeyAuthentication(beginRequest);
      const response = await simulateAuthentication(
        virtualCredential,
        options.challenge,
        RP_ID,
        APP_ORIGIN,
      );
      const finishRequest = new Request(`${APP_ORIGIN}/api/auth/login/finish`, {
        method: "POST",
      });
      const outcome = await finishPasskeyAuthentication(
        finishRequest,
        challengeToken,
        response,
        storedCredential,
      );
      expect(outcome.ok).toBe(true);
    });

    it("rejects a begin request arriving on the apex (public origin)", async () => {
      mockEnv = baseEnv();
      const beginRequest = new Request(`${PUBLIC_ORIGIN}/api/auth/login/begin`, {
        method: "POST",
      });
      await expect(beginPasskeyAuthentication(beginRequest)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    it("rejects a begin request arriving on an untrusted origin", async () => {
      mockEnv = baseEnv();
      const beginRequest = new Request("https://attacker.example/api/auth/login/begin", {
        method: "POST",
      });
      await expect(beginPasskeyAuthentication(beginRequest)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    it("rejects a finish request whose challenge was signed for the app origin but whose HTTP request itself arrives on the apex", async () => {
      mockEnv = baseEnv();
      const { virtualCredential, storedCredential } = await registerCredential();

      const beginRequest = new Request(`${APP_ORIGIN}/api/auth/login/begin`, { method: "POST" });
      const { challengeToken, options } = await beginPasskeyAuthentication(beginRequest);
      const response = await simulateAuthentication(
        virtualCredential,
        options.challenge,
        RP_ID,
        APP_ORIGIN,
      );
      const finishRequest = new Request(`${PUBLIC_ORIGIN}/api/auth/login/finish`, {
        method: "POST",
      });
      const outcome = await finishPasskeyAuthentication(
        finishRequest,
        challengeToken,
        response,
        storedCredential,
      );
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) expect(outcome.reason).toBe("challenge_invalid");
    });
  });

  describe("RP ID — never changes, only the ceremony origin narrows", () => {
    it("uses exactly crawlpact.com as the RP ID in a Production-shaped config", async () => {
      mockEnv = baseEnv();
      const beginRequest = new Request(`${APP_ORIGIN}/api/auth/register/begin`, {
        method: "POST",
      });
      const { options } = await beginPasskeyRegistration(beginRequest, "Ada", []);
      expect(options.rp.id).toBe("crawlpact.com");
    });
  });

  describe("local single-origin development — unaffected by Stage C", () => {
    it("still allows a ceremony to begin and finish on the single configured local origin", async () => {
      mockEnv = localSingleOriginEnv();
      const local = mockEnv.PUBLIC_SITE_URL as string;
      const credential = await createVirtualCredential();
      const beginRequest = new Request(`${local}/api/auth/register/begin`, { method: "POST" });
      const { challengeToken, options } = await beginPasskeyRegistration(beginRequest, "Ada", []);
      const response = await simulateRegistration(
        credential,
        options.challenge,
        "localhost",
        local,
      );
      const finishRequest = new Request(`${local}/api/auth/register/finish`, { method: "POST" });
      const outcome = await finishPasskeyRegistration(finishRequest, challengeToken, response);
      expect(outcome.ok).toBe(true);
    });
  });
});
