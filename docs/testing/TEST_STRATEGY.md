# Test Strategy

## Layers

| Layer            | Tool                             | Location                                                   | What it covers                                                                                                                                                                                                                                                                                                            |
| ---------------- | -------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit             | Vitest (`--project unit`)        | `packages/*/src/**/*.test.ts`, `apps/web/src/**/*.test.ts` | Pure logic: normalisation, IP classification, crypto/envelope helpers, scoring, presets, conflicts, recommendations, findings, signals. No network, no D1.                                                                                                                                                                |
| Integration      | Vitest (`--project integration`) | `**/*.integration.test.ts`                                 | Real module boundaries against a real D1 (`tests/integration/d1-harness.ts`): auth, billing, domains, monitoring, notifications, agency features, and every Super Admin surface (see below).                                                                                                                              |
| End-to-end       | Playwright                       | `apps/web/tests/e2e`                                       | Real browser against a running dev server. Public landing/SEO pages, plus real WebAuthn ceremonies (CDP virtual authenticator) driving registration, sign-in, save-domain-and-scan, account deletion, report printing, and Super Admin flows (dashboard, user search, subscription filtering, webhook retry) — see below. |
| Accessibility    | Playwright + axe-core            | `apps/web/tests/a11y`                                      | Automated WCAG 2.2 AA scan of public routes (22 routes, sitemap-driven), skip-link focus, breadcrumb landmarks.                                                                                                                                                                                                           |
| Responsive smoke | Playwright                       | `apps/web/tests/e2e/responsive-smoke.spec.ts`              | Functional responsive assertions (no horizontal overflow, key content reachable, mobile nav opens/closes, keyboard focus visible) at 360/768/1280px. Part of the required E2E job — see below and ADR-0008.                                                                                                               |

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

`.github/workflows/ci.yml` runs two jobs concurrently (no dependency between them), plus a final
aggregate `ci-gate` job that fails if either required job fails, is cancelled, or is unexpectedly
skipped — that aggregate is the one required check:

- **`quality`**: format check, lint, typecheck, unit tests, integration tests, `db:validate`,
  production build (equivalent to `pnpm quality`).
- **`browser-smoke`**: builds the app for real, then runs the required E2E and accessibility
  suites — Chromium only (`pnpm test:e2e:chromium` / `pnpm test:a11y:chromium`) — against
  `wrangler dev --local` serving the actual generated `apps/web/dist/server/wrangler.json`, not
  Astro's dev server. This is a genuinely production-like target: real Cloudflare Assets binding
  behaviour (including its trailing-slash redirect on extension-less paths — see
  `seo-metadata.spec.ts`), real D1/KV bindings, no Vite dependency-optimizer races. Runs in the
  official version-matched Playwright container (`mcr.microsoft.com/playwright:v1.62.0-noble`),
  one worker, one retry — a flaky test is reported as a real failure, not silently re-run green.

Full cross-browser coverage (`mobile-safari`, via `pnpm test:e2e` / `pnpm test:a11y` without the
`:chromium` suffix) is not part of the required gate — run it locally before a major change or
release, per `docs/release/DEFINITION_OF_DONE.md`.

**Visual regression is intentionally not a CI gate.** A prior pixel-comparison suite
(`apps/web/tests/visual/**`) was removed after two separate readiness-signal fixes failed to make
it stable — it still failed ~9.5% of the time on a re-run of an identical, already-baselined
commit. See `docs/architecture/adr/ADR-0008-remove-pixel-visual-regression.md` for the full
evidence and what replaced it (the responsive-smoke tests above, plus `pnpm ui:review` for manual
human review — never a CI gate, never a committed baseline).

## Test data

See `docs/testing/TEST_DATA_POLICY.md` — no test may assert on or generate fake customer,
testimonial, or scan-result data presented as real.
