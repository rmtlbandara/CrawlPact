# Phase 2 — Final Security & Implementation Validation

Status 2026-09-14. Re-audit of every Phase 2 security invariant against real source and live
Production. Evidence class marked per claim.

## 2.1 Origin trust (SOURCE INSPECTION)

`origin.ts`: `classifyOrigin`/`classifyRequestOrigin` compare exact origin strings only
(`origin === getPublicOrigin()`, `origin === appOrigin`) — no suffix/`endsWith` check anywhere.
`requestArrivalOrigin` reads the request's own `Host` header directly (matching how a real
Cloudflare Custom Domain routes), never `X-Forwarded-Host` or any other client-suppliable header.
Grepped the full `lib/` and `lib/auth/` trees for `X-Forwarded-Host` — the only occurrence is the
doc comment in `origin.ts` explaining why it is deliberately _not_ used. Unknown hosts resolve to
`"unknown"` / `null`, never silently trusted.

## 2.2 Session cookie (SOURCE INSPECTION)

`auth/session.ts`'s `buildSessionCookie`/`buildClearedSessionCookie`: `Path=/`, `HttpOnly`,
`SameSite=Lax`, `Secure` (non-local), **no `Domain=` attribute anywhere** — confirmed host-only.
Unchanged by this migration's Stage A work.

## 2.3 CSRF (SOURCE INSPECTION + AUTOMATED TEST)

`auth/same-origin.ts`'s `assertSameOrigin`: expected origin is always the request's _own_
validated arrival origin (`getValidatedRequestOrigin`) — never a fixed value, never "any trusted
origin unconditionally." All five required negative cases are covered by
`tests/integration/csrf.integration.test.ts`, re-run directly this pass:

```
csrf.integration.test.ts — 8/8 passed
```

Covering: same-origin GET exempt even with attacker Origin (read-only); mutating request with
mismatched Origin rejected; no Origin/Referer rejected; Referer fallback works when Origin absent;
**app target + apex Origin → reject**; **apex target + app Origin → reject**; app target + matching
app Origin → accept; sibling-origin Referer fallback rejected the same way. Malformed Origin and
unknown-host cases are covered by `getValidatedRequestOrigin` returning `null` unconditionally
(source-verified, `origin.ts`), which `assertSameOrigin` treats as an automatic reject.

## 2.4 Static Assets host boundary (AUTOMATED TEST + PRODUCTION LIVE HTTP)

`worker.host-boundary.test.ts` re-run directly this pass — 110/110 passed across the combined
security-relevant suite (host-boundary, agency-logo, legacy-redirect, origin). Covers canonical
page, trailing slash, no trailing slash, `/index`, `/index.html`, `.html`, collection routes,
`/for/*`, sign-in, app, admin, API, robots, sitemap. Live Production re-confirmation in
`PRODUCTION_CUTOVER_EVIDENCE.md` §5: app-host aliases (`/pricing`, `/pricing/`,
`/pricing/index.html`, `/for/agencies/`) all `308` to the apex canonical — never render public
HTML directly on the app host.

## 2.5 Agency-logo cross-origin contract (SOURCE INSPECTION, unchanged from Phase 4 Stage A)

`GET /api/agency-branding/logo/[...key]` remains `PUBLIC_ONLY` in `route-ownership.ts` — not
weakened to `SHARED`. Upload/mutation (`POST /api/agency-branding/logo`,
`POST /api/agency-branding/profile`) remain `APP_ONLY`. Storage stays relative-path based;
`toLogoDisplayUrl(publicOrigin, logoUrl)` builds the display URL using the **public** origin at
render time only — the fix already shipped and evidenced in Phase 4 Stage A
(`PHASE_4_STAGE_A_STATUS.md`).

## 2.6 First-party link inventory (SOURCE INSPECTION)

Re-grepped the full runtime tree for `/sign-in`, `/app`, `/admin`, `PUBLIC_SITE_URL`,
`PUBLIC_APP_URL` literal usage: every first-party entry point
(`SiteHeader.astro`, `pricing.astro`, `PricingPlans.tsx`, `AuditConversionCta.tsx`) already
constructs its URL via `toAppUrl()`/`appOrigin`, confirmed in Phase 4 Stage A and re-verified live
in `PRODUCTION_CUTOVER_EVIDENCE.md` §10 (pricing `plan`/`interval` and audit `continuation`
params survive the app-origin construction). No first-party navigation relies on the legacy apex
redirect as its permanent mechanism — the redirect exists solely for stale bookmarks/external
links/search results.

## 2.7 Dependency/security audit (AUTOMATED TEST)

```
pnpm audit --audit-level=critical → exit 0, zero critical
pnpm audit --audit-level=high → 20 findings (13 high, 7 moderate), zero critical
```

Every one of the 20 findings is a transitive dependency of **dev/build-only tooling** —
`@typescript-eslint/*`/`eslint` (brace-expansion, js-yaml), `@astrojs/check`'s language server
(fast-uri via ajv/yaml-language-server), `miniflare` (undici, sharp — the local dev/test Workers
runtime, not the deployed Worker), and `astro`'s build-time SVG optimizer (svgo). Confirmed via
`pnpm why <package> --prod` for all 7 root packages (`brace-expansion`, `undici`, `js-yaml`,
`nanoid`, `fast-uri`, `sharp`, `svgo`) — **every query returned empty**, i.e. none appear in the
production dependency tree at all. Zero critical. Zero material runtime-reachable high-severity
vulnerability.

Patches exist upstream for most of these leaf packages, but the direct dependents haven't yet
bumped their own pins — this is exactly what Dependabot's already-open PRs address (`#181`
pnpm/action-setup, `#184` `@simplewebauthn/server`, `#185` `@astrojs/cloudflare`, `#186` `zod`,
`#187` `astro`, `#188` dev-dependencies group). Merging the Dependabot queue is out of scope for
this migration directive (unrelated dependency-bump review, its own risk surface) and is not
performed here. Recorded honestly in `docs/status/KNOWN_RISKS.md` rather than silently accepted.

## 2.8 Full quality gate

| Check                                                                                                 | Result                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run typecheck`                                                                                  | 0 errors, 0 warnings (559 files)                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `pnpm run docs:validate`                                                                              | PASSED                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `pnpm run content:validate`                                                                           | PASSED (4 verticals, 5 platforms)                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `pnpm run repo-privacy:validate`                                                                      | PASSED                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `pnpm run analytics:validate`                                                                         | PASSED (468 files)                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `pnpm run trust:validate`                                                                             | PASSED (557 files)                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `pnpm run db:validate`                                                                                | PASSED (56 tables)                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `route-ownership.test.ts`                                                                             | 31/31 (includes the exhaustive real-filesystem-walk, zero `UNKNOWN`)                                                                                                                                                                                                                                                                                                                                                                                 |
| `worker.host-boundary.test.ts` + `agency-logo.test.ts` + `legacy-redirect.test.ts` + `origin.test.ts` | 110/110                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `webauthn.test.ts`                                                                                    | 9/9 (Stage C not introduced — ceremony still succeeds at the public origin)                                                                                                                                                                                                                                                                                                                                                                          |
| `csrf.integration.test.ts`                                                                            | 8/8                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Security suite (`vitest --project security`)                                                          | 45/45                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `main` CI on current tip (`2c5b712`)                                                                  | **success** — initial run showed 2 failures matching the exact documented pre-existing flake signatures (Miniflare `dispose is not a function`/hook timeouts; a11y/hydration timing under CI-runner load) on a docs-only commit that cannot have caused either; a full rerun of both jobs passed clean. Not a new deterministic failure — classified as flake per the directive's own bar (exact known signature, unrelated code area, clean rerun). |

Full `pnpm test:e2e`/`pnpm test:integration` local runs were not additionally re-run beyond what
CI's own isolated environment already covers — this repository's established, standing practice
(documented repeatedly across this migration) treats CI as the authoritative check for these
suites, given local Miniflare resource contention produces false failures unrelated to code
correctness.

## Gate

```
PHASE 2 — SECURITY & IMPLEMENTATION FINAL PASS
```
