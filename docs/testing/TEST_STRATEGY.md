# Test Strategy

## Layers

| Layer             | Tool                             | Location                                                                    | What it covers                                                                                                                                                                                                                                                                                                            |
| ----------------- | -------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit              | Vitest (`--project unit`)        | `packages/*/src/**/*.test.ts`, `apps/web/src/**/*.test.ts`                  | Pure logic: normalisation, IP classification, crypto/envelope helpers, scoring, presets, conflicts, recommendations, findings, signals. No network, no D1.                                                                                                                                                                |
| Integration       | Vitest (`--project integration`) | `**/*.integration.test.ts`                                                  | Real module boundaries against a real D1 (`tests/integration/d1-harness.ts`): auth, billing, domains, monitoring, notifications, agency features, and every Super Admin surface (see below).                                                                                                                              |
| End-to-end        | Playwright                       | `apps/web/tests/e2e`                                                        | Real browser against a running dev server. Public landing/SEO pages, plus real WebAuthn ceremonies (CDP virtual authenticator) driving registration, sign-in, save-domain-and-scan, account deletion, report printing, and Super Admin flows (dashboard, user search, subscription filtering, webhook retry) — see below. |
| Accessibility     | Playwright + axe-core            | `apps/web/tests/a11y`                                                       | Automated WCAG 2.2 AA scan of public routes (22 routes, sitemap-driven), skip-link focus, breadcrumb landmarks.                                                                                                                                                                                                           |
| Visual regression | Playwright                       | `apps/web/tests/visual` (baseline: 13 routes × 7 breakpoints, 91 snapshots) | Cross-breakpoint layout snapshots of public marketing/content pages, run explicitly via `pnpm test:visual`. Not yet wired into CI — see caveat below.                                                                                                                                                                     |

## What "integration" means here (SRS §35.2)

No test in this repository requires a real Paddle account, a real Cloudflare account, or any
production credential. Integration tests exercise real code paths (the actual Astro API route
handler, not a mock) against a real D1 database (`tests/integration/d1-harness.ts` — a real,
disposable D1 instance per test file, not a mock of D1), with constructed `Request`/`locals`
objects standing in for the Workers runtime. This includes every Super Admin lib/route (users,
domains, scans, registry, security, billing, webhooks, scheduler health, findings, runtime
config) — see the 20+ files under `apps/web/tests/integration/admin-*.integration.test.ts`.

## What e2e adds beyond integration (SRS §35.2 vs §35.3)

Integration tests prove the server-side logic is correct against real data. They do not exercise
the actual browser: real client-side JavaScript, real WebAuthn ceremonies, real page navigation,
real form interaction. `apps/web/tests/e2e/auth-and-account.spec.ts` and `admin-flows.spec.ts`
close that gap for the highest-priority §35.3-required journeys (passkey registration/sign-in,
save a domain and trigger a real manual scan, request/cancel account deletion, print a report,
and — as a fresh admin account granted `super_admin` directly against the local D1, since
passkeys are hardware-bound per browser context and there is no way to reach an existing admin
account through the browser alone — the Super Admin dashboard, user search, subscription table
filtering, and webhook retry). These use a real Chromium DevTools Protocol virtual authenticator
(`tests/e2e/helpers/webauthn.ts`), not the fabricated request/response objects
`tests/integration/virtual-authenticator.ts` builds for integration tests — the actual
`navigator.credentials.create()`/`.get()` ceremony runs in a real page context.

Remaining §35.3 items without dedicated e2e coverage yet (scheduled scan, Paddle purchase/portal,
agency report, table filtering beyond subscriptions, keyboard-only navigation beyond what
`tests/a11y` already covers) are a disclosed gap, not a silent one — see
`docs/status/KNOWN_RISKS.md`.

## A real, non-obvious bug this e2e work found

Building the save-domain-and-scan e2e journey surfaced a real SSR crash: `apps/web/src/pages/app/index.astro`
passed a literal `<a>...</a>` written in Astro template syntax as the `action` prop of the React
`EmptyState` component. Astro compiles that into its own internal chunk object, not a React
element, and React's SSR renderer throws ("Objects are not valid as a React child") when it
receives one — but the dev server swallowed the exception and returned a _200 with an empty body_
instead of a 500, so it was invisible to anything that only checks status codes. It only fired for
a genuinely domain-less new account, which no prior test (integration or otherwise) had exercised
against a real SSR render. Fixed by rendering the equivalent markup natively in Astro instead of
routing it through a React prop. This is exactly the class of defect real e2e testing exists to
catch and integration testing cannot.

## CI gate

`pnpm quality` (format check, lint, typecheck, unit tests, integration tests, db:validate,
build) must pass before merge. `test:e2e` and `test:a11y` run against a real dev server (with D1
migrated and seeded first) and are part of the CI workflow's dedicated job — see
`.github/workflows/ci.yml`. That job runs with `AUDIT_ENGINE_ENABLED=true` (unlike the `quality`
job's unit/integration tests, which construct their own local mock env per test and never read
that process-level variable) so the authenticated/admin/scan e2e journeys can exercise a real
scan — the one thing that flag being `false` used to smoke-test at the e2e layer (the honest
`AUDIT_ENGINE_DISABLED` response) is verified more precisely by `audit-api.integration.test.ts`.

**`test:visual` is intentionally not wired into that CI job yet.** Playwright's
`toHaveScreenshot` snapshot filenames are platform-suffixed (e.g. `-darwin.png`); the committed
baseline in `apps/web/tests/visual/core-pages.spec.ts-snapshots/` was generated on macOS, but
`.github/workflows/ci.yml`'s e2e/a11y job runs on `ubuntu-latest`. Adding a bare `test:visual`
step to that job would fail on every run (Linux has no matching `-linux.png` baseline), not
because of a real regression. Wiring it in correctly requires generating the baseline inside the
same environment CI uses (e.g. the official Playwright Docker image, or a one-off `ubuntu-latest`
run whose output is reviewed and committed) — tracked as follow-up. Until then, `test:visual` is
a local/manual gate (`pnpm test:visual`), matching CLAUDE.md's "check the change at
360px/768px/1280px" instruction for UI changes.

## Test data

See `docs/testing/TEST_DATA_POLICY.md` — no test may assert on or generate fake customer,
testimonial, or scan-result data presented as real.
