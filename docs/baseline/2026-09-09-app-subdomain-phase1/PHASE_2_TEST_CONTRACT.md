# Phase 2 Test Contract — App-Subdomain Migration

Date: 2026-09-09. Tests Phase 2 must add before its work can be considered complete. None of
these exist yet — Phase 1 adds no test code (no host-boundary behavior exists yet to test). This
contract exists so Phase 2 doesn't have to re-derive test scope from scratch, and so coverage can
be checked against this list rather than someone's memory of what mattered.

Use the repository's existing harnesses (Vitest for unit/integration, Playwright for E2E) — do not
introduce a new test framework.

## Host routing (unit/integration, extends `route-registry.test.ts` or a new `host-boundary.test.ts`)

- `GET`/`HEAD` `crawlpact.com/about/` → 200, served from the public surface.
- `GET`/`HEAD` `app.crawlpact.com/about/` → 301/308 to `crawlpact.com/about/`, **exact same path
  and query string preserved**, trailing-slash form intact.
- `GET`/`HEAD` `app.crawlpact.com/guides/some-slug/` → same redirect behavior for a
  content-collection-backed prerendered route (not just a static one).
- `GET`/`HEAD` `crawlpact.com/app` (legacy) → 301/308 to `app.crawlpact.com/` (post-cutover only;
  pre-cutover this should be a no-op, since Phase 2/3 must not enable this redirect yet — test both
  states explicitly, gated by whatever flag/config controls cutover).
- `GET`/`HEAD` `app.crawlpact.com/sign-in` → 200, serves the auth page (not a redirect).
- `POST` a mutating request to a `APP_ONLY` API path on the public host → rejected with an
  explicit non-success response, **never** replayed/redirected to the app host (Wrong-Host Policy).
- `POST` a mutating request to a `PUBLIC_ONLY` API path (e.g. `/api/audit/:id/continuation`) on the
  app host → rejected the same way.
- Request with an unrecognized `Host` header (e.g. the account's `*.workers.dev` fallback, or a
  typo'd hostname) → rejected/treated as untrusted, **never** silently mapped to either surface.
  This must be tested explicitly, not just implied by the allowlist's structure.

## Static assets (extends `worker.preview-isolation.test.ts` patterns to production config)

- A prerendered public HTML asset requested on `app.crawlpact.com` must never return the raw
  asset content directly — it must be intercepted by the Worker-first host check before any
  `env.ASSETS.fetch()` call. Test this for at least one entry from each of `PRERENDERED_ROUTES`
  and `PRERENDERED_COLLECTION_PREFIXES`, not just one example.
- The Phase 20 canonical trailing-slash contract must still hold on **both** hosts once
  `run_worker_first` is enabled on production (today it's preview-only) — reuse/generalize
  `needsTrailingSlashRedirectPreview()`'s existing test coverage rather than writing a parallel set.
- Actual response headers (CSP, HSTS, X-Content-Type-Options, etc.) must be asserted present on a
  real Worker-mediated static-document response in the new config — do not assume
  `public/_headers` still applies once `run_worker_first` intercepts the request.
- The small immutable-asset exclusion list (`/_astro/*`, `/branding/*`, `/og/*`, etc. — see
  `CLOUDFLARE_HOST_BOUNDARY_DESIGN.md`) must be asserted as still asset-first (i.e., a performance
  regression test: these should NOT go through the Worker).

## Session cookie

- A successful app-host login sets `crawlpact_session` as `Secure; HttpOnly; SameSite=Lax` with
  **no `Domain` attribute**, scoped to `app.crawlpact.com` only.
- A request to the public host never receives/echoes the app-host session cookie (host-only
  behavior, unit-testable by asserting no `Domain` is ever set, plus an integration test that a
  cookie set on one origin's mock request context isn't readable from the other's).
- Logout clears the app-host cookie correctly (existing `buildClearedSessionCookie` coverage,
  re-run against app-origin requests).

## CSRF (extends `same-origin.ts`'s test coverage with the new surface-aware design from `PUBLIC_SITE_URL_USAGE_AUDIT.md`)

- `APP_ONLY` mutation + `Origin: https://app.crawlpact.com` → succeeds.
- `APP_ONLY` mutation + `Origin: https://crawlpact.com` (the _other_ trusted CrawlPact origin) →
  **rejected**. This is the critical sibling-subdomain-CSRF negative test — it must fail exactly
  like an attacker origin would, not be silently accepted because it's "one of ours."
  the existing `google-auth-flow.integration.test.ts:254` lookalike-origin rejection test is the
  closest existing precedent to extend from.
- `PUBLIC_ONLY` mutation + `Origin: https://app.crawlpact.com` → rejected, same reasoning reversed.
- `SHARED_SAME_ORIGIN_SURFACE` route (`/api/analytics/track`) + `Origin` matching the request's own
  `Host` → succeeds on _either_ host; + `Origin` **not** matching the request's own `Host` (even if
  it's the other trusted CrawlPact origin) → rejected.
- Missing `Origin`, falling back to `Referer` → same matching rules as today, re-verified per
  surface.
- Attacker origin (`https://evil.example.com`) → rejected on every surface, unchanged from today.

## WebAuthn (see `WEBAUTHN_MIGRATION_CONTRACT.md` for full design — tests only summarized here)

- An existing real production passkey authenticates successfully with `expectedOrigin =
https://app.crawlpact.com`, `expectedRPID = crawlpact.com` (requires a controlled compatibility
  deployment — Phase 3, not a unit test, but must be run and its result recorded before cutover).
- New passkey registration + immediate login both succeed against the app origin.
- **Negative test, mandatory**: a challenge token whose signed `origin` field is `crawlpact.com`
  cannot be completed with a WebAuthn response whose actual origin is `app.crawlpact.com`, and
  vice versa — this is the dual-origin-replay protection and must be a unit test against the
  origin-pinning logic itself, not only an end-to-end check.
- Step-up/recent-auth and passkey management (list/rename/remove) work when the session was
  established via an app-origin ceremony.

## Google

- Sign-in/sign-up/account-linking/cancel/error paths all work when the page is served from
  `app.crawlpact.com` (same-origin POST to `/api/auth/google`, per the existing popup/callback
  design — no code change to the flow itself, only to the origin it runs on).
- CSP `connect-src`/`frame-src`/`script-src`/`style-src` entries for `accounts.google.com/gsi/*`
  are present in the app-host response headers, not only the public host's.
- A resulting session cookie is created on the app host only.

## Recovery codes

- Valid / invalid / already-used / rate-limited recovery-code redemption all behave identically
  when initiated from `app.crawlpact.com`, and the resulting session is app-host-only.

## API ownership

- At least one representative endpoint from each family in `ORIGIN_AND_ROUTE_OWNERSHIP_MATRIX.md`
  (`PUBLIC_ONLY`, `APP_ONLY`, `SHARED_SAME_ORIGIN_SURFACE`, `SERVER_TO_SERVER_PUBLIC`) is tested on
  both its correct host and its wrong host.
- The Paddle webhook (`SERVER_TO_SERVER_PUBLIC`) is confirmed reachable and functioning identically
  regardless of any host-boundary logic — it must never be gated by the new Host-header classifier
  in a way that could reject a legitimate Paddle-signed request.

## Audit continuation / pricing continuation (cross-origin redirect integrity)

- The `continuation` query parameter survives a redirect from a public-host audit page through
  `app.crawlpact.com/sign-in` to `app.crawlpact.com/app/continue` intact, and
  `/api/audit/continuation/:id` still enforces its existing one-time atomic-consume semantics
  unchanged.
- The `plan`/`interval` pair survives `crawlpact.com/pricing` → `app.crawlpact.com/sign-in` →
  `app.crawlpact.com/app/billing` intact, and the real price is still re-resolved server-side
  regardless of the query param (unchanged invariant, re-tested in the new cross-origin context).
- `isSafeRelativeRedirect()` continues to reject `//`, backslash-as-slash, and non-relative
  targets — unchanged, but re-run in the new context since call sites now need to reason about
  which origin's relative path they mean (design note, not a code change to the guard itself).

## Paddle

- Once the app checkout domain is Paddle-approved (Phase 3/4 only — this test is gated behind that
  external state, not run before it): `Paddle.Checkout.open()` initializes successfully from
  `app.crawlpact.com/billing`.
- Apex `/pay?_ptxn=...` continues to work unchanged, and the webhook's signature verification and
  idempotency-by-`paddle_event_id` behavior are unaffected by any host-boundary code.

## Analytics / privacy

- GA4/Clarity render on eligible public marketing routes (unchanged, existing `ga-boundary.test.ts`
  coverage) and **never** render on any `app.crawlpact.com` response — this must be tested by host,
  not only by path, since the same route string could theoretically be requested on either host
  once both exist (e.g. confirm there's no code path where an app-host request accidentally renders
  `MarketingLayout`).
- A new test must assert `sign-in.astro` (once migrated to the dedicated `AuthLayout`) never
  imports `GoogleAnalytics`/`MicrosoftClarity`/`AnalyticsConsent` — extending
  `ga-boundary.test.ts`'s existing source-inspection pattern to the new layout file.

## SEO

- App host's `robots.txt` disallows everything and carries **no** `Sitemap:` line.
- `sitemap.xml` never gains an `/app`, `/admin`, `/sign-in`, or `/audit/:id`-shaped entry.
- App-host `X-Robots-Tag: noindex` and `<meta name="robots">` continue to apply (existing
  `AppLayout`/`AdminLayout` `noindex={true}` behavior, re-verified once those layouts are served
  from a real second hostname rather than only reachable via the current single-origin `/app`
  path).

## CI/CD

- Preview deploy verification exercises **both** the public-preview and app-preview hosts once the
  latter exists (extends `deploy-preview.yml`'s existing smoke/Lighthouse steps).
- Production smoke test (`scripts/smoke-test.ts`) gains app-origin assertions alongside its
  existing `crawlpact.com`/`www.crawlpact.com` redirect-check fixtures (see
  `PUBLIC_SITE_URL_USAGE_AUDIT.md`'s note that this is the one gate that actually exercises a live
  Worker, unlike `pnpm quality`/`verify:push`).
- `pnpm env:validate:production`/`:preview` catch a missing or malformed `PUBLIC_APP_URL` once it
  becomes load-bearing (Phase 2 should consider whether to make it required at that point, given it
  is intentionally optional during Phase 1).
