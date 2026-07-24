import { getEnv } from "../env";

export type AdminEnvironmentLabel = "Development" | "Preview" | "Paddle Sandbox" | "Production";

/**
 * SRS §10.43/§28.2: the Super Admin shell must show a persistent,
 * unmistakable environment indicator, and Paddle sandbox data must never be
 * visually mixed with production revenue. `PUBLIC_APP_ENV` says which
 * deployment this is; `PADDLE_ENVIRONMENT` says which Paddle account it
 * talks to — the two are independent (a `production` deploy can still be
 * wired to Paddle's sandbox, which is exactly this repository's current
 * state, since no live Paddle account has been connected — see
 * docs/security/BILLING_SECURITY.md).
 */
export function getAdminEnvironment(): {
  label: AdminEnvironmentLabel;
  appEnv: string;
  paddleEnvironment: string;
  isRealRevenue: boolean;
} {
  const appEnv = getEnv().PUBLIC_APP_ENV;
  const paddleEnvironment = getEnv().PADDLE_ENVIRONMENT ?? "sandbox";
  const isRealRevenue = appEnv === "production" && paddleEnvironment === "production";

  let label: AdminEnvironmentLabel;
  if (appEnv === "local") label = "Development";
  else if (appEnv === "preview") label = "Preview";
  else if (paddleEnvironment !== "production") label = "Paddle Sandbox";
  else label = "Production";

  return { label, appEnv, paddleEnvironment, isRealRevenue };
}
