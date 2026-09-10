import { describe, expect, it } from "vitest";
import { InvalidEnvironmentError, parseEnv } from "./env";

const validEnv = {
  PUBLIC_APP_ENV: "local",
  PUBLIC_SITE_URL: "http://localhost:4321",
  SESSION_SIGNING_SECRET: "a".repeat(32),
  ABUSE_MONITORING_SECRET: "b".repeat(32),
  WEBAUTHN_RP_ID: "localhost",
  WEBAUTHN_RP_ORIGIN: "http://localhost:4321",
  GOOGLE_CLIENT_ID: "123456789-test.apps.googleusercontent.com",
  PADDLE_API_KEY: "sandbox_key",
  PADDLE_ENVIRONMENT: "sandbox",
  PADDLE_WEBHOOK_SECRET: "sandbox_secret",
  PADDLE_PRICE_ID_SOLO: "pri_1",
  PADDLE_PRICE_ID_PRO: "pri_2",
  PADDLE_PRICE_ID_AGENCY: "pri_3",
  PUBLIC_PADDLE_CLIENT_TOKEN: "sandbox_client_token",
  AUDIT_ENGINE_ENABLED: "false",
};

/** A deployed (non-local) environment additionally needs a real, HTTPS, distinct app origin. */
const deployedOrigins = {
  PUBLIC_SITE_URL: "https://crawlpact.com",
  PUBLIC_APP_URL: "https://app.crawlpact.com",
};

const realProductionPaddle = {
  PADDLE_API_KEY: "pdl_real_key",
  PADDLE_WEBHOOK_SECRET: "whsec_real",
  PADDLE_PRICE_ID_SOLO: "pri_01real_solo",
  PADDLE_PRICE_ID_PRO: "pri_01real_pro",
  PADDLE_PRICE_ID_AGENCY: "pri_01real_agency",
  PUBLIC_PADDLE_CLIENT_TOKEN: "live_real_token",
};

describe("parseEnv", () => {
  it("parses a fully valid environment", () => {
    const env = parseEnv(validEnv);
    expect(env.PUBLIC_APP_ENV).toBe("local");
    expect(env.AUDIT_ENGINE_ENABLED).toBe(false);
    expect(env.GOOGLE_CLIENT_ID).toBe("123456789-test.apps.googleusercontent.com");
  });

  it("requires GOOGLE_CLIENT_ID", () => {
    const { GOOGLE_CLIENT_ID: _omitted, ...rest } = validEnv;

    expect(() => parseEnv(rest)).toThrow(InvalidEnvironmentError);
  });

  it("rejects an invalid GOOGLE_CLIENT_ID", () => {
    expect(() =>
      parseEnv({
        ...validEnv,
        GOOGLE_CLIENT_ID: "not-a-google-client-id",
      }),
    ).toThrow(InvalidEnvironmentError);
  });

  it("defaults AUDIT_ENGINE_ENABLED to false when absent", () => {
    const { AUDIT_ENGINE_ENABLED, ...rest } = validEnv;
    const env = parseEnv(rest);
    expect(env.AUDIT_ENGINE_ENABLED).toBe(false);
  });

  it("throws InvalidEnvironmentError with all issues when fields are missing", () => {
    expect(() => parseEnv({})).toThrow(InvalidEnvironmentError);
  });

  it("rejects a weak session signing secret", () => {
    expect(() => parseEnv({ ...validEnv, SESSION_SIGNING_SECRET: "short" })).toThrow();
  });

  it("rejects a weak abuse monitoring secret", () => {
    expect(() => parseEnv({ ...validEnv, ABUSE_MONITORING_SECRET: "short" })).toThrow();
  });

  it("rejects an invalid PUBLIC_SITE_URL", () => {
    expect(() => parseEnv({ ...validEnv, PUBLIC_SITE_URL: "not-a-url" })).toThrow();
  });

  it("requires PUBLIC_PADDLE_CLIENT_TOKEN as part of the validated contract", () => {
    const { PUBLIC_PADDLE_CLIENT_TOKEN, ...rest } = validEnv;
    expect(() => parseEnv(rest)).toThrow(InvalidEnvironmentError);
  });

  it("rejects Paddle Live credentials in a local environment", () => {
    expect(() =>
      parseEnv({ ...validEnv, PUBLIC_APP_ENV: "local", PADDLE_ENVIRONMENT: "production" }),
    ).toThrow(InvalidEnvironmentError);
  });

  it("rejects Paddle Live credentials in a preview environment", () => {
    expect(() =>
      parseEnv({ ...validEnv, PUBLIC_APP_ENV: "preview", PADDLE_ENVIRONMENT: "production" }),
    ).toThrow(InvalidEnvironmentError);
  });

  it("rejects placeholder Paddle values in production when BILLING_ENABLED=true", () => {
    expect(() =>
      parseEnv({
        ...validEnv,
        ...deployedOrigins,
        PUBLIC_APP_ENV: "production",
        PADDLE_ENVIRONMENT: "production",
        BILLING_ENABLED: "true",
        // validEnv's Paddle fields are sandbox-shaped, not .env.example
        // placeholders — swap in the actual placeholder strings.
        PADDLE_API_KEY: "paddle_sandbox_placeholder",
        PADDLE_WEBHOOK_SECRET: "replace-with-paddle-sandbox-webhook-secret",
        PADDLE_PRICE_ID_SOLO: "pri_sandbox_placeholder",
        PADDLE_PRICE_ID_PRO: "pri_sandbox_placeholder",
        PADDLE_PRICE_ID_AGENCY: "pri_sandbox_placeholder",
        PUBLIC_PADDLE_CLIENT_TOKEN: "paddle_sandbox_client_token_placeholder",
      }),
    ).toThrow(InvalidEnvironmentError);
  });

  it("rejects missing Paddle values in production when BILLING_ENABLED=true", () => {
    const { PADDLE_API_KEY: _omitted, ...rest } = {
      ...validEnv,
      ...deployedOrigins,
      ...realProductionPaddle,
    };
    expect(() =>
      parseEnv({
        ...rest,
        PUBLIC_APP_ENV: "production",
        PADDLE_ENVIRONMENT: "production",
        BILLING_ENABLED: "true",
      }),
    ).toThrow(InvalidEnvironmentError);
  });

  it("reports billing configured when production has every required real value", () => {
    const env = parseEnv({
      ...validEnv,
      ...deployedOrigins,
      PUBLIC_APP_ENV: "production",
      PADDLE_ENVIRONMENT: "production",
      BILLING_ENABLED: "true",
      ...realProductionPaddle,
    });
    expect(env.BILLING_ENABLED).toBe(true);
    expect(env.PUBLIC_PADDLE_CLIENT_TOKEN).toBe("live_real_token");
  });

  /**
   * Phase 1–3 closure review (2026-09-10, ADR-0010): production has genuinely
   * consumed a real `PUBLIC_APP_URL` since Phase 3's Custom Domain
   * attachment, but the schema still let a deployed environment silently
   * omit it — the app-subdomain host boundary would just never engage, with
   * no error. `local` is the sole exemption (single-origin dev legitimately
   * sets both URLs equal).
   */
  describe("app-origin invariants for deployed (non-local) environments", () => {
    it("requires PUBLIC_APP_URL in production", () => {
      expect(() =>
        parseEnv({
          ...validEnv,
          PUBLIC_SITE_URL: "https://crawlpact.com",
          PUBLIC_APP_ENV: "production",
        }),
      ).toThrow(InvalidEnvironmentError);
    });

    it("requires PUBLIC_APP_URL in preview", () => {
      expect(() =>
        parseEnv({
          ...validEnv,
          PUBLIC_SITE_URL: "https://preview.crawlpact.com",
          PUBLIC_APP_ENV: "preview",
        }),
      ).toThrow(InvalidEnvironmentError);
    });

    it("does not require PUBLIC_APP_URL in local", () => {
      const env = parseEnv({ ...validEnv, PUBLIC_APP_ENV: "local" });
      expect(env.PUBLIC_APP_URL).toBeUndefined();
    });

    it("rejects a non-HTTPS PUBLIC_SITE_URL outside local", () => {
      expect(() =>
        parseEnv({
          ...validEnv,
          ...deployedOrigins,
          PUBLIC_APP_ENV: "production",
          PUBLIC_SITE_URL: "http://crawlpact.com",
        }),
      ).toThrow(InvalidEnvironmentError);
    });

    it("rejects a non-HTTPS PUBLIC_APP_URL outside local", () => {
      expect(() =>
        parseEnv({
          ...validEnv,
          ...deployedOrigins,
          PUBLIC_APP_ENV: "production",
          PUBLIC_APP_URL: "http://app.crawlpact.com",
        }),
      ).toThrow(InvalidEnvironmentError);
    });

    it("rejects PUBLIC_APP_URL equal to PUBLIC_SITE_URL outside local", () => {
      expect(() =>
        parseEnv({
          ...validEnv,
          PUBLIC_APP_ENV: "production",
          PUBLIC_SITE_URL: "https://crawlpact.com",
          PUBLIC_APP_URL: "https://crawlpact.com",
        }),
      ).toThrow(InvalidEnvironmentError);
    });

    it("allows PUBLIC_APP_URL equal to PUBLIC_SITE_URL in local (single-origin dev)", () => {
      const env = parseEnv({
        ...validEnv,
        PUBLIC_APP_ENV: "local",
        PUBLIC_SITE_URL: "http://localhost:4321",
        PUBLIC_APP_URL: "http://localhost:4321",
      });
      expect(env.PUBLIC_APP_URL).toBe("http://localhost:4321");
    });

    it("accepts a fully valid deployed two-origin production environment", () => {
      const env = parseEnv({ ...validEnv, ...deployedOrigins, PUBLIC_APP_ENV: "production" });
      expect(env.PUBLIC_APP_URL).toBe("https://app.crawlpact.com");
    });

    it("accepts a fully valid deployed two-origin preview environment", () => {
      const env = parseEnv({
        ...validEnv,
        PUBLIC_APP_ENV: "preview",
        PUBLIC_SITE_URL: "https://preview.crawlpact.com",
        PUBLIC_APP_URL: "https://app.preview.crawlpact.com",
      });
      expect(env.PUBLIC_APP_URL).toBe("https://app.preview.crawlpact.com");
    });
  });
});
