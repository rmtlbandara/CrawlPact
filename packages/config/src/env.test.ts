import { describe, expect, it } from "vitest";
import { InvalidEnvironmentError, parseEnv } from "./env";

const validEnv = {
  PUBLIC_APP_ENV: "local",
  PUBLIC_SITE_URL: "http://localhost:4321",
  SESSION_SIGNING_SECRET: "a".repeat(32),
  WEBAUTHN_RP_ID: "localhost",
  WEBAUTHN_RP_ORIGIN: "http://localhost:4321",
  PADDLE_API_KEY: "sandbox_key",
  PADDLE_ENVIRONMENT: "sandbox",
  PADDLE_WEBHOOK_SECRET: "sandbox_secret",
  PADDLE_PRICE_ID_SOLO: "pri_1",
  PADDLE_PRICE_ID_PRO: "pri_2",
  PADDLE_PRICE_ID_AGENCY: "pri_3",
  PUBLIC_PADDLE_CLIENT_TOKEN: "sandbox_client_token",
  AUDIT_ENGINE_ENABLED: "false",
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
    const { PADDLE_API_KEY: _omitted, ...rest } = { ...validEnv, ...realProductionPaddle };
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
      PUBLIC_APP_ENV: "production",
      PADDLE_ENVIRONMENT: "production",
      BILLING_ENABLED: "true",
      ...realProductionPaddle,
    });
    expect(env.BILLING_ENABLED).toBe(true);
    expect(env.PUBLIC_PADDLE_CLIENT_TOKEN).toBe("live_real_token");
  });
});
