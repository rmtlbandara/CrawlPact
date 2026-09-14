import { toAppUrl } from "./origin";

/**
 * Phase 4 (controlled production cutover, ADR-0010): builds the exact
 * redirect target for a legacy apex request to an `APP_ONLY` page
 * (`/sign-in`, `/app`, `/app/**`, `/admin`, `/admin/**`) now that the
 * Phase 2/3 migration-compatibility window has ended. `worker.ts` calls this
 * only for a path `isAppOnlyPagePath` already confirmed is APP_ONLY — this
 * module's job is solely the redirect *target*, not the ownership decision.
 *
 * Stage A of the two-stage cutover (`docs/baseline/2026-09-14-app-subdomain-phase4/`)
 * uses a 307 Temporary Redirect for these — deliberately reversible and
 * uncacheable-as-permanent while Production health is being proven. Stage B
 * flips `LEGACY_REDIRECT_STATUS` to 308 once that health gate passes; no
 * other code changes. See `REDIRECT_AND_RETIREMENT_CONTRACT.md`.
 */
export const LEGACY_REDIRECT_STATUS = 307;

const PAID_PLAN_IDS = new Set(["solo", "pro", "agency"]);
const BILLING_INTERVALS = new Set(["month", "year"]);

/**
 * `/sign-in`'s query string is filtered to exactly the parameters the app
 * host's own `sign-in.astro` already understands and validates a second
 * time server-side (Phase 4 directive §7: "Do not blindly copy every
 * unknown query parameter cross-origin"). An invalid `plan`/`interval` value
 * is dropped here rather than forwarded — `sign-in.astro`'s own validation
 * would reject it anyway, but there is no reason to forward a value we
 * already know is meaningless. `continuation`'s shape (non-empty, <= 128
 * chars) mirrors the exact bound `sign-in.astro` itself already enforces
 * before doing anything with it — this is a defence-in-depth pre-filter,
 * not the authoritative check (that happens again, server-side, at the app
 * host, exactly as it does today).
 */
function filterSignInSearch(search: string): string {
  const params = new URLSearchParams(search);
  const filtered = new URLSearchParams();

  const continuation = params.get("continuation");
  if (continuation && continuation.length > 0 && continuation.length <= 128) {
    filtered.set("continuation", continuation);
  }

  const plan = params.get("plan");
  const interval = params.get("interval");
  if (plan && PAID_PLAN_IDS.has(plan)) {
    filtered.set("plan", plan);
    if (interval && BILLING_INTERVALS.has(interval)) {
      filtered.set("interval", interval);
    }
  }

  const out = filtered.toString();
  return out ? `?${out}` : "";
}

/**
 * `/app/**` and `/admin/**` preserve their full path and query string
 * unfiltered (Phase 4 directive §7: "Preserve legitimate application query
 * strings unless source inspection identifies a sensitive parameter that
 * must be filtered" — source inspection of every `/app/**`/`/admin/**` page
 * found no query parameter that carries a credential, token, or secret;
 * they are pagination/filter/display-state values only, already re-derived
 * and re-validated server-side wherever they matter).
 */
export function resolveLegacyAppRedirectTarget(pathname: string, search: string): string {
  if (pathname === "/sign-in") {
    return toAppUrl("/sign-in", filterSignInSearch(search));
  }
  return toAppUrl(pathname, search);
}
