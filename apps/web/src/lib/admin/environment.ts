import { getEnv } from "../env";

export type AdminEnvironmentLabel = "Development" | "Preview" | "Paddle Sandbox" | "Production";

/**
 * `.env.example` placeholder values (Part 2 Step 17). A Paddle var can be a
 * non-empty string per the config schema while still being one of these —
 * that's "unconfigured", not "configured", for status-reporting purposes.
 */
const PADDLE_PLACEHOLDER_VALUES = new Set([
  "paddle_sandbox_placeholder",
  "replace-with-paddle-sandbox-webhook-secret",
  "pri_sandbox_placeholder",
  "paddle_sandbox_client_token_placeholder",
]);

function isRealPaddleValue(value: string | undefined): boolean {
  return Boolean(value) && !PADDLE_PLACEHOLDER_VALUES.has(value as string);
}

/**
 * Whether Paddle billing has real (non-placeholder) credentials wired for
 * the current environment — as opposed to merely having the env vars
 * present, which the config schema requires even for local dev's sandbox
 * placeholders. See `docs/status/KNOWN_RISKS.md` ("/status's 'Paddle
 * billing: Available' label is hardcoded, not a real check").
 */
export function isPaddleBillingConfigured(): boolean {
  const env = getEnv();
  return (
    isRealPaddleValue(env.PADDLE_API_KEY) &&
    isRealPaddleValue(env.PADDLE_WEBHOOK_SECRET) &&
    isRealPaddleValue(env.PADDLE_PRICE_ID_SOLO) &&
    isRealPaddleValue(env.PADDLE_PRICE_ID_PRO) &&
    isRealPaddleValue(env.PADDLE_PRICE_ID_AGENCY) &&
    isRealPaddleValue(env.PUBLIC_PADDLE_CLIENT_TOKEN)
  );
}

/**
 * SRS §10.43/§28.2: the Super Admin shell must show a persistent,
 * unmistakable environment indicator, and Paddle sandbox data must never be
 * visually mixed with production revenue. `PUBLIC_APP_ENV` says which
 * deployment this is; `PADDLE_ENVIRONMENT` says which Paddle account it
 * talks to — the two are independent (a `production` deploy can still be
 * wired to Paddle's sandbox).
 */
export function getAdminEnvironment(): {
  label: AdminEnvironmentLabel;
  appEnv: string;
  paddleEnvironment: string;
  isRealRevenue: boolean;
  paddleBillingConfigured: boolean;
} {
  const appEnv = getEnv().PUBLIC_APP_ENV;
  const paddleEnvironment = getEnv().PADDLE_ENVIRONMENT ?? "sandbox";
  const isRealRevenue = appEnv === "production" && paddleEnvironment === "production";
  const paddleBillingConfigured = isPaddleBillingConfigured();

  let label: AdminEnvironmentLabel;
  if (appEnv === "local") label = "Development";
  else if (appEnv === "preview") label = "Preview";
  else if (paddleEnvironment !== "production") label = "Paddle Sandbox";
  else label = "Production";

  return { label, appEnv, paddleEnvironment, isRealRevenue, paddleBillingConfigured };
}
