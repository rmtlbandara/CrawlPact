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
  AUDIT_ENGINE_ENABLED: "false",
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
});
