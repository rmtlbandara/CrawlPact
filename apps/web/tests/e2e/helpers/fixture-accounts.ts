/**
 * Shared authenticated-fixture constants. See setup/customer.setup.ts and
 * setup/admin.setup.ts for what actually creates these accounts and saves
 * their storage state — this file just holds the paths/names both the
 * setup projects and the specs that consume them need to agree on.
 *
 * Sessions here are a single opaque HttpOnly cookie looked up directly
 * against a D1 `sessions` row (apps/web/src/lib/auth/session.ts) — no
 * client-held credential material is needed after the initial WebAuthn
 * ceremony, so a captured Playwright storageState (which does capture
 * HttpOnly cookies, set at the CDP layer) is sufficient to authenticate a
 * fresh context without re-running the CDP virtual authenticator at all.
 */

export const CUSTOMER_STORAGE_STATE = "apps/web/tests/e2e/.auth/customer.json";
export const ADMIN_STORAGE_STATE = "apps/web/tests/e2e/.auth/admin.json";

// The admin fixture's display name needs to be discoverable by
// admin-flows.spec.ts's user-search test, which searches for exactly this
// prefix (partial/substring match, same as the account it used to create
// for itself before this shared-fixture migration).
export const ADMIN_FIXTURE_DISPLAY_NAME_PREFIX = "Fixture Admin";
