import { ApiError } from "@crawlpact/core";
import { getEnv } from "./env";

/**
 * Shared secret for apps/web/src/pages/api/test-only/* routes. Not a real
 * secret (no confidentiality relies on it) — it exists only as a second,
 * independent gate alongside the PUBLIC_APP_ENV check below, in case that
 * check is ever misconfigured. Fixed and committed deliberately, same
 * convention as ci.yml's other "-placeholder" values; the corresponding
 * test-side value lives in apps/web/tests/e2e/helpers/admin-db.ts.
 */
export const TEST_FIXTURE_SECRET = "e2e-test-fixture-only-not-a-secret";

/**
 * Gate for every route under api/test-only/*. These exist solely so
 * Playwright e2e helpers can write to the same D1 connection the running
 * dev/preview server holds, instead of a second `wrangler d1 execute`
 * process racing it for the same local sqlite file (see
 * docs/status/KNOWN_RISKS.md). Never reachable outside a local/CI run
 * regardless of the header — deliberately fails *closed* on a missing
 * `PUBLIC_APP_ENV` (unlike pages/dev/components.astro's `?? "local"`
 * fallback, which is fine for a harmless dev-only showcase page but wrong
 * here: one of these routes grants `super_admin`, so an unset var must
 * 404, not silently behave as local).
 */
export function assertTestOnlyAccess(request: Request): void {
  if (getEnv().PUBLIC_APP_ENV !== "local") {
    throw new ApiError("NOT_FOUND", "Not found.");
  }
  if (request.headers.get("X-Test-Fixture-Secret") !== TEST_FIXTURE_SECRET) {
    throw new ApiError("NOT_FOUND", "Not found.");
  }
}
