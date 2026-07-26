# Implementation Status

**Last updated:** 2026-07-26 · **Current phase:** Part 3 complete; a follow-on UI/UX conversion
audit and fix pass (not a numbered SRS Part) has since been completed — see below.

## UI/UX conversion audit and fix pass (2026-07-26)

A full route-by-route UI/UX and conversion audit was requested against a much larger brief (new
brand/logo system, homepage/report/dashboard/pricing/billing/admin redesign, 22 phases). The
audit (`docs/design/UI_UX_CONVERSION_AUDIT.md`) found the product already faithful to the SRS,
honest (no fake trust signals anywhere), and passing the full quality gate cleanly — a short list
of concrete, verifiable bugs, not a generic product needing a rebrand. Per the user's explicit
choice, only those concrete findings were fixed; no new brand/logo system or homepage rebuild was
attempted.

Fixed (see `CHANGELOG.md`'s matching entry for full detail):

1. Policy Health Score `categoryBreakdown` now reaches every real report (was computed, then
   discarded before persistence — new `scans.score_breakdown` column, migration `0016`).
2. Domain detail page's blank score label fixed (shared `scoreLabelFor` helper).
3. `/pricing` CTAs brought to parity with the homepage's own pricing teaser (per-plan cards,
   "Recommended" badge).
4. Missing analytics events added (`crawler_reference_page_opened`, `source` on audit events) to
   satisfy SRS §9.20's "Hero audit started" vs. "Final CTA audit started" distinction.
5. Super Admin mobile/tablet navigation added (`AdminMobileNav.tsx`) — the desktop sidebar had no
   replacement below 1024px.
6. Automated a11y/visual-regression coverage extended to one authenticated route each
   (`/app`, `/admin`) — previously public-site-only.

A genuine, previously-undiscovered WCAG 2.2 AA violation was found and fixed as a direct result of
item 6: the admin sidebar's section headings had insufficient color contrast (3.63:1 against a
4.5:1 requirement). This is exactly the kind of regression extending automated coverage is meant
to catch — recorded here since it wasn't one of the 6 pre-identified findings, but a genuine
result of doing the work.

Two things were discovered but deliberately not fixed, since they are unrelated to any of the six
items above and out of this pass's scope — both recorded honestly in
`docs/status/KNOWN_RISKS.md`/`CHANGELOG.md` rather than silently left implicit: the existing
91-snapshot visual-regression baseline is now confirmed stale against the current app (every one
of the 13 pre-existing routes differs by exactly the height of the Part 3 Step 26 environment
banner, which post-dates when those baselines were captured); and a pre-existing `mobile-safari`
a11y test failure (a Playwright/WebKit keyboard-focus limitation on the homepage's skip link,
confirmed unrelated to any file this pass touched).

### Quality gate results (this pass, run 2026-07-26)

| Check                     | Command                                            | Result                                                                                       |
| ------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Format                    | `pnpm format:check`                                | ✅ Pass (4 files needed `pnpm format`, then re-checked clean)                                |
| Lint                      | `pnpm lint`                                        | ✅ Pass — 0 errors                                                                           |
| Typecheck                 | `pnpm typecheck`                                   | ✅ Pass — 293 files, 0 errors, 0 warnings, 31 informational hints                            |
| Unit tests                | `pnpm test:unit`                                   | ✅ Pass — 189/189, 18 files                                                                  |
| Integration tests         | `pnpm test:integration`                            | ✅ Pass — 137/137, 22 files, against real D1 (includes the new migration's schema)           |
| Migration/schema drift    | `pnpm db:validate`                                 | ✅ Pass — 38 tables verified consistent                                                      |
| Build                     | `pnpm build`                                       | ✅ Pass                                                                                      |
| E2E tests                 | `pnpm test:e2e` (all projects)                     | ✅ Pass — 23 passed, 7 skipped (WebAuthn-chromium-only skips)                                |
| Accessibility smoke tests | `pnpm test:a11y` (chromium)                        | ✅ Pass — 27/27, including the 2 new authenticated-route tests                               |
| Accessibility smoke tests | `pnpm test:a11y` (mobile-safari)                   | 24/25 — 1 pre-existing, unrelated WebKit keyboard-focus failure (see above)                  |
| Visual regression         | `pnpm test:visual` (new authenticated routes only) | ✅ Pass — 14/14 new snapshots, stable across repeated runs, all 7 breakpoints                |
| Visual regression         | `pnpm test:visual` (13 pre-existing routes)        | ❌ Fails uniformly — confirmed pre-existing baseline staleness, not a regression (see above) |

## Current phase

Part 3's mission was to deliver everything the customer-facing product (Part 2) didn't cover:
the Super Admin Control Center (SRS §28, all 20 subsections), agency-feature polish (§29), the
SRS §30.4 SEO content minimum, accessibility/visual/performance hardening, operational runbooks,
privacy/retention verification, and — as the final steps — a real, evidence-based audit against
the SRS, a security audit, a production-readiness audit, and production configuration
preparation (deliberately **not** a deploy). This document reflects the state at the end of that
full 26-step plan, re-verified directly against code and tests while writing this update, not
carried forward from earlier notes in this session.

## Completed work

### Super Admin Control Center (SRS §28, all subsections)

- **Global dashboard** (§28.2): every listed metric (users, subscriptions, domains, scans,
  findings, security events, revenue, ARR) queried live, with today/7d/30d/month/custom
  date-range filters — `lib/admin/dashboard.ts`, `lib/admin/date-range.ts`.
- **User management** (§28.3–§28.4): search by ID/name/Paddle ID/domain/plan/status; a read-only
  detail view; suspend/restore/revoke-sessions/pause-monitoring/revoke-feed-tokens/revoke-shared-
  reports/begin-deletion/cancel-deletion/add-notes — every sensitive one behind
  `requireAdminAction` (reason + step-up auth + automatic audit log). Self-suspend explicitly
  blocked. Impersonation deliberately not built (SRS explicitly excludes it from MVP).
- **Subscription/revenue/webhook administration** (§28.5–§28.7): filterable subscription table,
  Paddle resync (a real call to Paddle's API, never a local override), temporary entitlements
  (expiry + reason + audit required), transaction records, webhook event monitoring with
  idempotent retry.
- **Domain/scan operations** (§28.8–§28.9): global domain table, administrative scan trigger that
  does not consume the customer's quota, target blocklist management, failure-category breakdown.
- **Scheduler health** (§28.10): missed/overlapping/stuck/long-execution/excessive-failure-rate
  detection, global pause/resume with required reason.
- **Registry administration** (§28.11): crawler/operator CRUD, versioned release model
  (create/compare/publish/rollback), immutable published versions, domain re-evaluation on
  publish.
- **Findings analytics, security monitoring, content/notices, runtime configuration, maintenance
  mode** (§28.12–§28.17): all built with real lib modules and admin UI pages.
- **Roles** (§28.18): data model supports 6 roles; only `super_admin` is assignable this release,
  matching the SRS's own "initial release may use only the Super Admin role" wording exactly.
- **Audit log** (§28.19): `requireAdminAction` writes an `admin_audit_logs` row for every
  sensitive action automatically — verified this pass that zero mutating admin route bypasses it.
- **Admin security** (§28.20): passkey-only, 12-hour session TTL (vs. standard), step-up
  re-authentication, stricter rate limits, CSRF, non-indexable routes, and — added in Step 26 —
  an enforced minimum of 2 registered passkeys for active admin accounts.

Every lib module above has a corresponding `*.integration.test.ts` file under
`apps/web/tests/integration/admin-*` (20+ files) against a real D1 database.

### Agency features (SRS §29)

Client groups, batch domain import with per-row error reporting, portfolio filters (group/
monitoring-state/score-band/has-findings), client-safe share links with limited agency branding
(explicitly never removes CrawlPact's disclosed technical/legal limitations) —
`agency-features.integration.test.ts` (5 tests).

### SEO content minimum (SRS §30.4) — met and exceeded

| Requirement                                      | Minimum | Actual                                                       |
| ------------------------------------------------ | ------- | ------------------------------------------------------------ |
| Crawler-reference pages                          | 20      | 20 (all source-verified against real operator documentation) |
| Decision/comparison guides                       | 10      | 10                                                           |
| Implementation guides                            | 5       | 5                                                            |
| Troubleshooting guides                           | 5       | 5                                                            |
| Free validator pages                             | 4       | 5                                                            |
| Methodology / scoring / registry changelog pages | 1 each  | 1 each                                                       |

The 5 free tools (`/tools/*`) each genuinely lead with their own scoped section of a real scan
(via a `ReportFocus` reordering mechanism) rather than being relabelled duplicates of the same
form — one real scan pipeline, five honest entry points. One registry crawler (`crw_bingbot`)
deliberately has no content page yet: its official documentation is JS-rendered and could not be
fetched/read this pass — disclosed in `docs/registry/SOURCE_VERIFICATION_POLICY.md`, not silently
skipped. Full technical SEO (canonical, Open Graph, structured data, sitemap, noindex rules) is
verified automatically by `apps/web/tests/e2e/seo-metadata.spec.ts`, which is sitemap-driven —
coverage always matches the real indexable-page list with no hand-maintained duplication.

### Accessibility, visual regression, and performance

- Skip-link-focus, breadcrumb-landmark, and modal-focus-trap tests added; 22 public routes
  covered by an automated WCAG 2.2 AA scan (`apps/web/tests/a11y`), sitemap-driven.
- Visual-regression baseline: 13 routes × 7 breakpoints = 91 snapshots
  (`apps/web/tests/visual/core-pages.spec.ts`). Not yet wired into CI (platform-suffix mismatch:
  baseline generated on macOS, CI runs `ubuntu-latest`) — tracked, not silently dropped.
- Admin list queries rewritten to push filters into SQL with hard `.limit()` ceilings instead of
  fetch-then-filter-in-JS; 5 new database indexes (`migrations/0012_performance_indexes.sql`).

### Operational runbooks

`docs/operations/{RUNBOOK,BACKUP_AND_RECOVERY,INCIDENT_RESPONSE,SYSTEM_HEALTH}.md` rewritten with
real, verified admin routes and procedures (maintenance mode, scheduler pause, registry/ruleset
rollback, Paddle resync, compromised-session response, scanner-abuse response, incorrect-finding
correction, data-deletion procedures).

### Privacy and retention verification (Step 21) — a real bug found and fixed

Writing a real integration test that creates a user with billing/scan/admin-action history and
runs the actual daily retention purge against it (not previously exercised by any test) proved
that deleting such an account threw `SQLITE_CONSTRAINT_FOREIGNKEY` and **aborted the entire daily
retention job** — a systemic pattern across 14 "who did this" actor-reference columns
(`billing_customers`, `product_events`, `crawlers`, `registry_versions`, `ruleset_versions`,
`admin_role_assignments`, `temporary_entitlements`, `scans`, `system_notices`,
`security_events` ×2, `admin_audit_logs`, `blocked_targets`, `runtime_configuration`,
`internal_user_notes`), all defaulting to SQLite's `NO ACTION` instead of `SET NULL`. Fixed via
migrations 0013–0015, each proven by a test that failed against the old schema and passes against
the fix. Full detail: `docs/data/DATA_RETENTION.md`.

A secondary, genuinely non-obvious infrastructure bug surfaced while fixing this: `PRAGMA
foreign_keys=OFF` is silently a no-op inside a D1 migration file (D1 wraps the whole file in one
implicit transaction; SQLite ignores `foreign_keys` changes mid-transaction) — the fix migrations
initially shipped with it, passed against a fresh `sqlite3` CLI test, then failed against real D1
the first time a rebuilt table had real dependent rows. Fixed with `PRAGMA defer_foreign_keys=ON`
(which _is_ honored mid-transaction) and documented in `docs/data/MIGRATION_POLICY.md` so no
future migration repeats it.

### Codex handoff readiness (Step 22)

`apps/web/src/pages/api/admin/AGENTS.md` created (was missing entirely — the parent file still
said admin routes were "not-yet-created"); `packages/database/AGENTS.md` and
`packages/scanner/AGENTS.md` updated for the `defer_foreign_keys` finding and the now-complete
safe-fetch pipeline respectively; `CLAUDE.md`'s stale "(not-yet-created)" reference corrected.

### Final SRS traceability audit (Step 23)

Every SRS section was re-verified directly against code and tests — see
`docs/status/FINAL_SRS_COMPLIANCE_REPORT.md` and the fully updated
`docs/status/REQUIREMENTS_TRACEABILITY.md`. This pass built a real Playwright e2e suite
(`auth-and-account.spec.ts`, `admin-flows.spec.ts`) using a genuine Chromium DevTools Protocol
WebAuthn virtual authenticator — not a fabricated response — to close the largest real gap found:
SRS §35.3 (end-to-end tests) had almost no actual browser-driven coverage beyond the public
landing page. Building it surfaced a real, previously-unknown SSR crash (see "Known defects"
below) that no prior test — integration or otherwise — had exercised.

### Final security audit (Step 24)

`docs/status/FINAL_SECURITY_AUDIT.md` — all four SRS §33 launch-blocking areas (scanner/SSRF,
authentication, billing, admin) re-verified with zero critical/high findings. Found and corrected
two stale claims in `docs/security/SECURITY_CHECKLIST.md` (administrative audit logs, production/
preview separation) and two real, then-open gaps (two-passkey admin minimum, preview D1
separation) — both fixed in Step 26.

### Final production readiness audit (Step 25)

`docs/status/FINAL_PRODUCTION_READINESS_REPORT.md` and the fully re-audited
`docs/release/PRODUCTION_READINESS_CHECKLIST.md` (all 46 SRS §36 criteria individually
re-verified): **41 Done, 3 Partial, 2 Not started.** The single most important remaining gap:
Paddle sandbox lifecycle has never run against a real Paddle account (self-generated fixtures
match Paddle's documented shape, but that's not the same as verified against the real API).

### Production configuration preparation (Step 26) — no deploy performed

- `apps/web/wrangler.jsonc`'s `env.preview` previously had no distinct D1 database binding at
  all — it silently inherited production's, which would have let preview traffic (including
  admin testing) read/write real production data. Fixed with a separate `d1_databases` block.
- The same environment block was also missing its own `PUBLIC_SITE_URL` (would have made
  preview's CSRF checks, Atom feed URLs, and share links reference the production domain) and
  `WEBAUTHN_RP_ID`/`WEBAUTHN_RP_ORIGIN` **were missing from `wrangler.jsonc` entirely, for both
  environments** — found while fixing the above. Without these matching the real deployed
  domain, passkey registration/login fails outright for every user, since the browser strictly
  validates `rpId`/origin against the actual page origin. This was latent and untriggered locally
  (`.dev.vars` already had correct values) but would have been a total-outage-level bug on first
  real deploy. Fixed for production (real domain) and preview (placeholder, pending a real
  preview domain).
- SRS §10.43's environment indicator ("a non-production environment shall display a persistent
  label... production shall not display a distracting label") was never built despite
  `docs/deployment/ENVIRONMENTS.md` saying it should exist "once an authenticated shell exists" —
  added to `BaseLayout.astro` (covers every page), reading the same `PUBLIC_APP_ENV` that already
  drives CSP/HSTS decisions.
- Super Admin accounts now require keeping at least 2 registered passkeys (the other Step 24
  finding) — `removeCredential` in `lib/auth/credentials.ts` refuses to drop an active admin
  account below 2, proven in both directions by a new integration test.

## Known defects

- **A real SSR crash in the customer dashboard's Overview page, found and fixed this Part**: any
  brand-new, zero-domain account crashed `apps/web/src/pages/app/index.astro` with
  `Error: Objects are not valid as a React child` (an Astro-template `<a>` passed as a React
  `EmptyState` prop), which the dev server silently converted into a `200` response with an empty
  body instead of surfacing a 500 — invisible to anything checking only status codes. Found by
  the new e2e suite, since it was the first thing in this project's history to render that page
  for a genuinely empty account through a real browser. Fixed by rendering the equivalent markup
  natively in Astro; confirmed no other file uses the same anti-pattern.

No other defects found that block this Part's own scope. See `docs/status/KNOWN_RISKS.md` for the
full, current open-risk list.

## Security risks

See `docs/status/FINAL_SECURITY_AUDIT.md` and `docs/security/SECURITY_CHECKLIST.md` for the
item-by-item status. Summary: zero critical/high findings across all four SRS §33 launch-blocking
areas. Both real findings from this Part's audit (two-passkey admin minimum, preview/production
D1 separation) are fixed. What remains open and disclosed: Paddle payload field-shapes unverified
against a live account (the biggest remaining item before launch), CSP's `unsafe-inline`
allowance, no cross-request target-frequency abuse monitoring, and `env.preview`'s domain-specific
placeholder values pending a real preview domain.

## Decisions required from the user before production deployment

1. **This repository still has zero git commits.** All Part 1, 2, and 3 work exists only in the
   working tree. Per standing instructions, no commit is made without an explicit request.
2. **Cloudflare account / D1 databases**: still placeholders in `wrangler.jsonc` (now correctly
   _structured_ as two distinct databases — production and preview — but neither has a real ID
   yet). Nothing can be deployed until real accounts/databases exist.
3. **Paddle sandbox account**: needed to close the one real open verification gap in billing —
   the single most important item before production launch per
   `docs/status/FINAL_PRODUCTION_READINESS_REPORT.md`.
4. **Visual-regression CI wiring**: still needs a decision on generating a Linux baseline (a
   throwaway CI run or the official Playwright Docker image) — unchanged from Part 2's ask.
5. **Professional UI/UX review** (SRS §36 item 45): a human-judgement task this agent cannot
   self-certify, flagged for the user, not for continued agent work.

## Next recommended task

**Not more Part 3 feature work — the SRS is fully addressed.** The concrete next steps, in
priority order: (1) obtain Paddle sandbox credentials and run one real checkout lifecycle through
them; (2) make the four decisions listed above; (3) once a real Cloudflare account exists, create
the two real D1 databases and apply migrations to each; (4) get the professional UI/UX review
done; (5) only then consider production deployment, with explicit, in-the-moment authorisation.

---

## Quality gate results (Part 3 completion, run 2026-07-24)

| Check                     | Command                                                     | Result                                                                                                             |
| ------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Format                    | `pnpm format:check`                                         | ✅ Pass                                                                                                            |
| Lint                      | `pnpm lint`                                                 | ✅ Pass — 0 errors                                                                                                 |
| Typecheck                 | `pnpm typecheck` (`astro check` across all packages)        | ✅ Pass — 0 errors, 0 warnings, 31 informational hints                                                             |
| Unit tests                | `pnpm test:unit`                                            | ✅ Pass — **189/189**, 18 files                                                                                    |
| Integration tests         | `pnpm test:integration`                                     | ✅ Pass — **137/137**, 22 files, against real D1                                                                   |
| Migration/schema drift    | `pnpm db:validate`                                          | ✅ Pass — 38 tables verified consistent (parser fixed this Part for the SQLite table-rebuild pattern)              |
| Build                     | `pnpm build`                                                | ✅ Pass                                                                                                            |
| E2E tests                 | `pnpm exec playwright test apps/web/tests/e2e` (chromium)   | ✅ Pass — **15/15**, including 8 new tests using a real WebAuthn ceremony                                          |
| Accessibility smoke tests | `pnpm test:a11y` (chromium, 22 routes)                      | ✅ Pass — **25/25**, zero WCAG 2.2 AA violations                                                                   |
| Visual regression         | `pnpm test:visual` (13 pages × 7 breakpoints, 91 snapshots) | Baseline established this Part; not re-run in this specific final session pass — not yet wired into CI (see above) |

`pnpm quality` (the combined gate: format, lint, typecheck, unit+integration, db:validate, build)
passes end to end with exit code 0, re-run multiple times throughout this Part, most recently
immediately before this document was written.
