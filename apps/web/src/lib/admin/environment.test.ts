import { describe, expect, it, vi } from "vitest";

const mockEnv: Record<string, string> = {};

vi.mock("../env", () => ({ getEnv: () => mockEnv }));

const { getAdminEnvironment, isPaddleBillingConfigured } = await import("./environment");

const REAL_PADDLE_ENV = {
  PADDLE_API_KEY: "pdl_apikey_live_real",
  PADDLE_WEBHOOK_SECRET: "whsec_real_value",
  PADDLE_PRICE_ID_SOLO: "pri_01real_solo",
  PADDLE_PRICE_ID_PRO: "pri_01real_pro",
  PADDLE_PRICE_ID_AGENCY: "pri_01real_agency",
  PUBLIC_PADDLE_CLIENT_TOKEN: "live_realtoken",
};

const PLACEHOLDER_PADDLE_ENV = {
  PADDLE_API_KEY: "paddle_sandbox_placeholder",
  PADDLE_WEBHOOK_SECRET: "replace-with-paddle-sandbox-webhook-secret",
  PADDLE_PRICE_ID_SOLO: "pri_sandbox_placeholder",
  PADDLE_PRICE_ID_PRO: "pri_sandbox_placeholder",
  PADDLE_PRICE_ID_AGENCY: "pri_sandbox_placeholder",
  PUBLIC_PADDLE_CLIENT_TOKEN: "paddle_sandbox_client_token_placeholder",
};

function resetEnv(overrides: Record<string, string>) {
  for (const key of Object.keys(mockEnv)) delete mockEnv[key];
  Object.assign(
    mockEnv,
    { PUBLIC_APP_ENV: "production", PADDLE_ENVIRONMENT: "production", BILLING_ENABLED: "true" },
    overrides,
  );
}

describe("isPaddleBillingConfigured", () => {
  it("returns true when every Paddle var holds a real, non-placeholder value", () => {
    resetEnv(REAL_PADDLE_ENV);
    expect(isPaddleBillingConfigured()).toBe(true);
  });

  it("returns false when Paddle vars are still .env.example placeholders", () => {
    resetEnv(PLACEHOLDER_PADDLE_ENV);
    expect(isPaddleBillingConfigured()).toBe(false);
  });

  it("returns false when a single required value is missing", () => {
    resetEnv({ ...REAL_PADDLE_ENV, PADDLE_WEBHOOK_SECRET: "" });
    expect(isPaddleBillingConfigured()).toBe(false);
  });

  it('returns false when BILLING_ENABLED is not "true", even with real credentials', () => {
    resetEnv({ ...REAL_PADDLE_ENV, BILLING_ENABLED: "false" });
    expect(isPaddleBillingConfigured()).toBe(false);
  });
});

describe("getAdminEnvironment", () => {
  it("reports paddleBillingConfigured alongside the existing label fields", () => {
    resetEnv(REAL_PADDLE_ENV);
    const result = getAdminEnvironment();
    expect(result.label).toBe("Production");
    expect(result.isRealRevenue).toBe(true);
    expect(result.paddleBillingConfigured).toBe(true);
  });

  it("is Production-labelled but not billing-configured when secrets are still placeholders", () => {
    resetEnv(PLACEHOLDER_PADDLE_ENV);
    const result = getAdminEnvironment();
    expect(result.label).toBe("Production");
    expect(result.paddleBillingConfigured).toBe(false);
  });

  it("never returns a raw Paddle credential value, only derived booleans/labels", () => {
    resetEnv(REAL_PADDLE_ENV);
    const result = getAdminEnvironment();
    const serialized = JSON.stringify(result);
    for (const secret of Object.values(REAL_PADDLE_ENV)) {
      expect(serialized).not.toContain(secret);
    }
  });
});
