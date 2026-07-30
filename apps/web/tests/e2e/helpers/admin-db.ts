import type { Page } from "@playwright/test";

/**
 * Test-fixture setup for e2e tests that need to grant an admin role or
 * seed an otherwise-unreachable state (a failed webhook event, a
 * rate-limit reset) before a browser journey exercises it. These call the
 * env-gated apps/web/src/pages/api/test-only/* routes through the page's
 * own request context (which shares cookies with the browser, so a call
 * made while signed in carries that session) rather than shelling out to a
 * second `wrangler d1 execute --local` process — a second process writing
 * to the same local D1 sqlite file while the live dev/preview server holds
 * its own connection to it reliably crashed `wrangler dev --local` (see
 * docs/status/KNOWN_RISKS.md), which is exactly the concurrency conflict
 * this fetch-through-the-running-server approach eliminates.
 *
 * The shared secret here is intentionally not a real secret — see
 * apps/web/src/lib/test-only.ts for why a fixed, committed value is fine
 * (it's a second gate behind PUBLIC_APP_ENV === "local", which alone
 * already makes these routes unreachable in preview/production).
 */
const TEST_FIXTURE_SECRET = "e2e-test-fixture-only-not-a-secret";

// page.request is a raw HTTP client, not a browser-originated fetch — it
// never sends an Origin header on its own, which trips require-session.ts's
// CSRF same-origin check on any POST. Send the one this suite's own server
// expects (PUBLIC_SITE_URL, same default playwright.config.ts uses).
const SITE_ORIGIN = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:4321";

async function postTestOnly(page: Page, path: string, data?: unknown): Promise<void> {
  const response = await page.request.post(path, {
    headers: { "X-Test-Fixture-Secret": TEST_FIXTURE_SECRET, Origin: SITE_ORIGIN },
    data,
  });
  if (!response.ok()) {
    throw new Error(`${path} failed: ${response.status()} ${await response.text()}`);
  }
}

/**
 * Grants `super_admin` to whichever account `page` is currently signed in
 * as (self-service — see grant-super-admin.ts for why it's scoped to the
 * caller's own session rather than an arbitrary target).
 */
export async function grantSuperAdminToCurrentUser(page: Page): Promise<void> {
  await postTestOnly(page, "/api/test-only/grant-super-admin");
}

/**
 * Clears the anonymous-audit daily rate limit's counter (`security_events`
 * rows with `event_type = 'rate_limit'`, keyed by the caller's IP hash —
 * see `lib/auth/rate-limit.ts`). Every e2e run submits a real anonymous
 * audit from the same machine/CI-runner IP, sharing one counter across the
 * whole suite *and* across however many times this suite has run today —
 * the production 20/day cap is real, correct abuse protection, but that
 * makes the anonymous-audit e2e test non-repeatable without a reset.
 */
export async function clearAnonymousAuditRateLimit(page: Page): Promise<void> {
  await postTestOnly(page, "/api/test-only/clear-rate-limit", { kind: "anonymous_audit" });
}

/**
 * Clears the recovery-code brute-force rate limit's counter (`security_events`
 * rows with `event_type = 'recovery_code_failure'` — see
 * `pages/api/auth/recovery-codes/redeem.ts`, 5 failed attempts per 15
 * minutes per IP). Without resetting it first, repeated local/CI runs
 * eventually trip the real, correctly-working lockout instead of reaching
 * the behaviour under test.
 */
export async function clearRecoveryCodeRateLimit(page: Page): Promise<void> {
  await postTestOnly(page, "/api/test-only/clear-rate-limit", { kind: "recovery_code" });
}

/** Seeds a `failed` webhook event so the admin webhooks e2e test has
 * something real and eligible to retry, without waiting for a real Paddle
 * delivery to fail. */
export async function seedFailedWebhookEvent(page: Page): Promise<void> {
  await postTestOnly(page, "/api/test-only/seed-failed-webhook");
}
