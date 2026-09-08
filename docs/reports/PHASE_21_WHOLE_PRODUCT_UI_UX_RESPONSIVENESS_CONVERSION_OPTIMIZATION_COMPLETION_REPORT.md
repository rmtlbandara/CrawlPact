# Phase 21 — Whole-Product UI, UX, Responsiveness & Conversion Optimization — Completion Report

**Verdict: PASS**

All quality-gate checks pass, the changes were validated against real (not mocked) authenticated
sessions, every finding is backed by a concrete measurement, and the changeset has since been
deployed to production with explicit, in-the-moment owner authorization and independently
verified live. See "Deployment" below for the full record.

## Scope actually delivered

See `docs/baseline/2026-09-08-phase21/README.md` for the full, honest scope disclosure. In short:
this was a focused, evidence-verified UI/UX pass (real screenshots, real DOM measurements, real
authenticated fixture sessions) across representative surfaces of the public site, the customer
app, and Super Admin — not an exhaustive per-route/per-state audit of all 170+ routes. Four real
defects were found, all four were fixed, and none required a design-language change, new
dependency, or new pixel-diff tooling (ADR-0008 stays intact).

## What was fixed

| #   | Finding                                                                                    | Files                                                                                                                              | Verified by                                                                                                 |
| --- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | `DataTable` long identifiers inflate row height at narrow widths (216.5px vs ~50px normal) | `packages/ui/src/components/DataTable.tsx` (+`xl` hideBelow tier) and 9 admin manager components (`break-all` on identifier spans) | Direct DOM measurement (216.5px → 72.5px); new regression test                                              |
| 2   | Super Admin header overflow at 768px ("Back to public site")                               | `apps/web/src/components/admin/AdminNav.astro`                                                                                     | `scrollWidth`/`clientWidth` measured equal at 360/768/1024/1280px; existing `responsive-smoke.spec.ts` test |
| 3   | Unbounded display-name width in both app headers                                           | `AdminNav.astro`, `apps/web/src/components/app/AppNav.astro`                                                                       | Same measurement as #2                                                                                      |
| 4   | Raw User-Agent string shown verbatim in Sessions list                                      | `apps/web/src/lib/user-agent-summary.ts` (new), `apps/web/src/components/app/SessionsManager.tsx`                                  | 6 new unit tests                                                                                            |

Full detail, including what was investigated and ruled out as a false positive (a locale-driven
Google Sign-In button label, and the Astro dev toolbar appearing in dev-only screenshots), is in
`docs/baseline/2026-09-08-phase21/UX_FINDING_REGISTER.md`.

## Quality gate

Run locally against this changeset (not against a hypothetical clean tree):

| Check                                                                                                             | Result                                                                                              |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `pnpm run format:check`                                                                                           | ✅ Pass                                                                                             |
| `pnpm run lint`                                                                                                   | ✅ Pass (`--max-warnings=0`)                                                                        |
| `pnpm run typecheck`                                                                                              | ✅ Pass (0 errors across all packages; pre-existing Zod-deprecation hints unrelated to this change) |
| `pnpm run test:unit`                                                                                              | ✅ 531/531 passed (incl. 6 new tests)                                                               |
| `pnpm run test:integration`                                                                                       | See below                                                                                           |
| `pnpm run db:validate`                                                                                            | ✅ 56 tables verified consistent                                                                    |
| `pnpm run build`                                                                                                  | ✅ Succeeds                                                                                         |
| `pnpm exec playwright test apps/web/tests/e2e/responsive-smoke.spec.ts --project=chromium`                        | ✅ 44/44 passed (incl. new row-height regression test)                                              |
| `pnpm exec playwright test --config=playwright.a11y.config.ts --project=chromium -g "Super Admin\|authenticated"` | 6/7 passed — see below                                                                              |

**test:integration**: run twice this session. First run: 20 failed test files. Second run
(nothing else competing for local resources): 7 failed test files, 354/355 individual tests
passed. Every single failure in both runs — all 21 distinct occurrences — carries the identical
signature: `Hook timed out in 10000ms` inside `createD1TestHarness()`'s `beforeAll`/`beforeEach`,
cascading into `TypeError: dispose is not a function` in the corresponding `afterAll`/`afterEach`
— on a _different, random subset_ of files each run, spread across domains with nothing in common
(billing, CSRF, monitoring, registry, admin capacity/findings, pilots, auth-flow, status feed) and
zero overlap with any file this changeset touches. Not one failure is a real assertion failure
anywhere in either run. That pattern — a fixed startup-timeout signature hitting a random subset
that shrinks when local load drops — is Miniflare D1 harness startup contention under parallel
test-worker load, consistent with this codebase's own already-documented Miniflare/wrangler
local-instability history (see `docs/risks/ACTIVE_RISKS.md` RISK-013's surrounding notes), not a
regression introduced by this changeset. CI's real runner environment is the authoritative gate
for this suite, matching Phase 20's precedent for local-environment-limited test results.

**test:a11y** (Super Admin/authenticated subset): 6 of 7 passed. The one failure ("a real
saved-domain detail page... has no automatically detectable WCAG 2.2 AA violations") times out
waiting for a real scan against `e2e-fixture.crawlpact.com` to complete — traced to this local
session's `AUDIT_ENGINE_ENABLED` not being enabled via a local `.env` (no such file exists in this
working copy), an environment-configuration gap, not a code defect; nothing in this changeset
touches the scanning/audit pipeline. CI carries the real secrets/flags this needs and is the
authoritative gate, matching the same category of local-environment limitation Phase 20 documented.

## What was not done this phase (see the evidence package for detail)

- Conversion funnel analysis (no analytics API access granted this session — see
  `CONVERSION_FUNNEL_BASELINE.md`).
- A fresh local Lighthouse/performance baseline (the existing CI-gated check remains authoritative
  — see `PERFORMANCE_LAB_BASELINE.md`).
- Manual screen-reader walkthrough, 200%-zoom manual verification on every page, real-device
  testing — all pre-existing, already-tracked open gaps, unchanged by this phase.
- Exhaustive per-route review of every one of the 170+ routes — see `SURFACE_STATE_MATRIX.md` for
  exactly what was and wasn't individually reviewed.

## Canonical URL contract, preview isolation, analytics architecture (Phase 20 guarantees)

Not touched. No changes in this diff affect routing, redirects, `robots.txt`, `sitemap.xml`, or
`apps/web/src/lib/analytics.ts`/GA4 wiring.

## Deployment

Followed the same trusted workflow established in Phase 20, across two PRs:

1. **PR #164** (the Phase 21 UI/UX fixes) — CI passed (after one fixup commit for a Prettier
   formatting miss in the new evidence docs, caught by CI, not by local `format:check`, which had
   been run before those docs were finished — a process gap on my part, corrected immediately),
   merged via `merge-when-green` into `main` at commit `05cc6227fd6b224cf5991b4ebbd6644c0f74acc8`.
2. Preview redeployed automatically for that commit. Deploy/migrate/bindings/smoke-test all
   passed, but the Lighthouse budget check failed on **every** page with an identical SEO score
   (66/100, threshold 90) — traced to a real, pre-existing gap this Phase 21 changeset did not
   cause: Preview intentionally sends `X-Robots-Tag: noindex` (Phase 20's search-isolation
   feature), which fails Lighthouse's `is-crawlable` audit by design. This was the _first time_
   this Lighthouse step had ever run to a real conclusion — `deploy-preview.yml`'s dispatch chain
   was broken until Phase 20 fixed it days earlier, so the conflict between two previously-correct
   features (search isolation and the SEO budget gate) had never actually been exercised before.
3. **PR #165** — a small, separately-disclosed fix: `scripts/lighthouse-check.mjs` now detects
   `noindex` at runtime (a real request to the target, not a hardcoded "always skip on preview"
   assumption) and skips only the SEO threshold when it's present, leaving
   performance/accessibility/best-practices/LCP/CLS fully gated. Verified locally against live
   Preview before pushing (performance 99-100, accessibility 100, best-practices 92, LCP
   ~1.5-1.8s, CLS ~0.0001 — all passing). CI passed, merged via `merge-when-green` into `main` at
   commit `72414dd872286e73bf88885191913aaab5aeff81`.
4. Preview redeployed again for that commit — **full pipeline green end to end**, including
   Lighthouse (run `34212855569`, 17m48s): performance 100, accessibility 100, best-practices 92,
   SEO correctly skipped (66, not gated), LCP ~1.46-1.5s, CLS ~0.0001 across all 6 representative
   pages. "Lighthouse check passed for all pages."
5. **Production deployment**, explicitly authorized by the owner in this session ("Okay, Release
   production correctly"): dispatched `deploy-production.yml` for commit `72414dd8...` (`main`'s
   tip at the time, confirmed an ancestor of `origin/main`, confirmed CI — including
   browser-smoke — had succeeded for that exact SHA). Every step passed: typed-confirmation guard,
   ancestor check, CI-succeeded check, full quality-gate re-run, production environment-contract
   validation, build, migrations (38/38, no new migration needed), reference-data seed, Worker
   deploy, binding verification, and the production smoke test. Run `34214659536`, 12m51s,
   **success**.
   - **Deployed Worker version**: `7641c131-3a10-4502-99ca-99a6733eb7d8`
   - **Build artifact checksum**: `4d6e9463b2eab9d81171d4d3932a14d088f1dd8717baebcaaa0248a0093822a7`
   - **Deployed commit**: `72414dd872286e73bf88885191913aaab5aeff81`
6. **Independent post-deploy verification** (direct `curl` against `https://crawlpact.com`, not
   just the workflow's own smoke test): home and `/pricing/` return 200; no `X-Robots-Tag` header
   and no environment banner (correct — production is indexable, unlike Preview); `/robots.txt`
   correctly allows crawling and includes the `Sitemap:` line (unlike Preview's deliberate
   disallow-all); `/sign-in` returns 200.

No database migration was required for either change in this phase. Canonical URL contract,
preview isolation, and analytics architecture (Phase 20 guarantees) were not touched by either
change and remain exactly as Phase 20 left them — confirmed by the same independent checks above.
