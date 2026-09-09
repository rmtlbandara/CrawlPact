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

/**
 * Phase 2 of the app-subdomain migration (ADR-0010,
 * `docs/baseline/2026-09-09-app-subdomain-phase1/WEBAUTHN_MIGRATION_CONTRACT.md`):
 * the origin-pinned dual-origin ceremony design. These are pure unit tests
 * against `beginPasskeyRegistration`/`finishPasskeyRegistration` (no D1
 * needed — that logic lives entirely in the route handlers) using a real
 * software WebAuthn authenticator (`virtual-authenticator.ts`) so the
 * cryptographic verification is genuine, not mocked.
 */
describe("WebAuthn origin pinning", () => {
  describe("registration", () => {
    it("succeeds when the ceremony begins and finishes at the same trusted origin", async () => {
      mockEnv = baseEnv();
      const credential = await createVirtualCredential();
      const beginRequest = new Request(`${PUBLIC_ORIGIN}/api/auth/register/begin`, {
        method: "POST",
      });
      const { challengeToken, options } = await beginPasskeyRegistration(beginRequest, "Ada", []);
      const response = await simulateRegistration(
        credential,
        options.challenge,
        RP_ID,
        PUBLIC_ORIGIN,
      );
      const finishRequest = new Request(`${PUBLIC_ORIGIN}/api/auth/register/finish`, {
        method: "POST",
      });
      const outcome = await finishPasskeyRegistration(finishRequest, challengeToken, response);
      expect(outcome.ok).toBe(true);
    });

    it("succeeds when begun on the app origin and finished (same origin end-to-end) even though the finish HTTP request itself arrives on the other trusted origin", async () => {
      // The finish request's own arrival host is only a defense-in-depth
      // check (must be *some* trusted origin) — the property that actually
      // prevents replay is the *pinned* origin matching the real ceremony's
      // clientDataJSON.origin, regardless of which trusted host physically
      // received the finish POST. Both are trusted CrawlPact origins during
      // the Phase 2/3 migration-compatibility window (ADR-0010).
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
      expect(outcome.ok).toBe(true);
    });

    it("REJECTS a ceremony begun on one trusted origin but actually completed (per clientDataJSON) on the other — the dual-origin replay case", async () => {
      mockEnv = baseEnv();
      const credential = await createVirtualCredential();
      const beginRequest = new Request(`${PUBLIC_ORIGIN}/api/auth/register/begin`, {
        method: "POST",
      });
      const { challengeToken, options } = await beginPasskeyRegistration(beginRequest, "Ada", []);
      // The real ceremony's signed clientDataJSON claims APP_ORIGIN, but the
      // challenge token was pinned to PUBLIC_ORIGIN at begin time.
      const response = await simulateRegistration(credential, options.challenge, RP_ID, APP_ORIGIN);
      const finishRequest = new Request(`${PUBLIC_ORIGIN}/api/auth/register/finish`, {
        method: "POST",
      });
      const outcome = await finishPasskeyRegistration(finishRequest, challengeToken, response);
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) expect(outcome.reason).toBe("verification_failed");
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

    it("rejects a finish request arriving on an untrusted origin, even with an otherwise-valid response", async () => {
      mockEnv = baseEnv();
      const credential = await createVirtualCredential();
      const beginRequest = new Request(`${PUBLIC_ORIGIN}/api/auth/register/begin`, {
        method: "POST",
      });
      const { challengeToken, options } = await beginPasskeyRegistration(beginRequest, "Ada", []);
      const response = await simulateRegistration(
        credential,
        options.challenge,
        RP_ID,
        PUBLIC_ORIGIN,
      );
      const finishRequest = new Request("https://attacker.example/api/auth/register/finish", {
        method: "POST",
      });
      const outcome = await finishPasskeyRegistration(finishRequest, challengeToken, response);
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
        PUBLIC_ORIGIN,
      );
      const finishRequest = new Request(`${PUBLIC_ORIGIN}/api/auth/register/finish`, {
        method: "POST",
      });
      const outcome = await finishPasskeyRegistration(finishRequest, legacyToken, response);
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) expect(outcome.reason).toBe("challenge_invalid");
    });
  });

  describe("authentication", () => {
    /** Registers a real credential first so authentication tests have a genuine, correctly COSE-encoded `WebAuthnCredential` to verify against. */
    async function registerCredential() {
      const virtualCredential = await createVirtualCredential();
      const beginRequest = new Request(`${PUBLIC_ORIGIN}/api/auth/register/begin`, {
        method: "POST",
      });
      const { challengeToken, options } = await beginPasskeyRegistration(beginRequest, "Ada", []);
      const response = await simulateRegistration(
        virtualCredential,
        options.challenge,
        RP_ID,
        PUBLIC_ORIGIN,
      );
      const finishRequest = new Request(`${PUBLIC_ORIGIN}/api/auth/register/finish`, {
        method: "POST",
      });
      const outcome = await finishPasskeyRegistration(finishRequest, challengeToken, response);
      if (!outcome.ok) throw new Error("registration setup failed");
      return { virtualCredential, storedCredential: outcome.credential };
    }

    it("succeeds when begun and finished at the same trusted origin", async () => {
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

    it("REJECTS an authentication ceremony begun on one trusted origin but actually completed (per clientDataJSON) on the other", async () => {
      mockEnv = baseEnv();
      const { virtualCredential, storedCredential } = await registerCredential();

      const beginRequest = new Request(`${PUBLIC_ORIGIN}/api/auth/login/begin`, {
        method: "POST",
      });
      const { challengeToken, options } = await beginPasskeyAuthentication(beginRequest);
      // Signed for APP_ORIGIN, but the token was pinned to PUBLIC_ORIGIN.
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
      if (!outcome.ok) expect(outcome.reason).toBe("verification_failed");
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
  });
});
