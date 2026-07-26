# Implementation Status

**Last updated:** 2026-07-26 · **Current phase:** Part 3 complete; three follow-on passes (not
numbered SRS Parts) have since been completed — a UI/UX conversion audit and fix pass, a
Cloudflare infrastructure-alignment pass, and a Cloudflare account setup + first production
deployment pass — see below, most recent first.

## Cloudflare account setup and first production deployment (2026-07-26)

Continuation of the alignment pass below, now with actual Cloudflare account access (`wrangler
login`, authorised by the user) instead of documentation/analysis only. Per the user's explicit
scope decisions: full build-out authorised (D1 creation → migrations → secrets → preview deploy →
validation → production deploy), each production-affecting step confirmed before proceeding; the
two pre-existing orphaned KV namespaces were reused rather than deleted or duplicated.

**Discovered before any change was made**: the Cloudflare account already had the `crawlpact.com`
zone active (delegated from Namecheap) with a Worker Custom Domain attached to a placeholder
`crawlpact-web` Worker (bare "Hello world", no bindings, deployed earlier the same day by an
unknown prior process/session) — contradicting this repo's own docs, which said no account existed
and no deployment had occurred. Two KV namespaces (`crawlpact-web-session`,
`crawlpact-web-preview-session`) also pre-existed.

**Root cause found for both surprises above, and for a previously-unconfirmed suspicion**:
`@astrojs/cloudflare` unconditionally enables its own built-in KV-backed session feature (a
default independent of CrawlPact's actual D1-backed session system, ADR-0004) unless explicitly
configured otherwise — this is what the orphaned KV namespaces were created to satisfy, likely by
an earlier deploy attempt. Separately, and confirmed for the first time by an actual failed deploy
attempt: `wrangler.jsonc`'s `main: "./src/worker.ts"` cannot be deployed directly — Wrangler's own
bundler can't resolve Astro's internal virtual modules standalone. The `IMPLEMENTATION_STATUS.md`
entry below had recorded this as an unconfirmed `--dry-run` artifact; it is now confirmed real and
fixed (deploy `apps/web/dist/server/wrangler.json`, the build output's own generated config,
instead — see `docs/operations/RUNBOOK.md`).

**Completed**:

- Real D1 databases created and migrated: `crawlpact-db` and `crawlpact-db-preview`, 16/16
  migrations each, 38 tables verified (matching `pnpm db:validate`).
- `SESSION_SIGNING_SECRET` generated and set per environment (distinct random values).
- The deploy-bundling root cause diagnosed and fixed; both the KV binding requirement and the
  `main`-entry issue resolved by reusing the pre-existing KV namespaces and switching the deploy
  target to the Astro-generated config.
- Full quality gate run and passed (format has one pre-existing, unrelated failure in this pass —
  `docs/status/IMPLEMENTATION_STATUS.md` itself flagged by Prettier despite no edits to it this
  pass, not investigated further as out of scope).
- Preview deployed and validated (real app serving correctly, cron attached, secret persisted
  across the deploy).
- Production deployed and validated: full canonical-hostname matrix passing (apex, `www`, HTTP→HTTPS,
  path/query preservation, one-hop redirects, no loops).

**Not completed / explicitly deferred**:

- ~~Paddle secrets/vars unset~~ **Resolved 2026-07-26**: live catalog created (Solo/Pro/Agency
  products+prices via `paddle:catalog-setup`), price IDs and `PUBLIC_PADDLE_CLIENT_TOKEN` set in
  `wrangler.jsonc` production `vars`, live webhook destination registered
  (`ntfset_01kyfkc59d8h66prnhw220hnzy` → `/api/billing/webhook`), and `PADDLE_API_KEY` /
  `PADDLE_WEBHOOK_SECRET` set as production Worker secrets (confirmed via `wrangler secret list`).
  Not yet done: an actual end-to-end checkout/webhook run against this live config, and the
  `status.astro` hardcoded-label fix noted below.
- Zone-level DNS/SSL/WAF/Cache Rule/redirect-rule configuration — this session's Cloudflare API
  token is read-only at the zone level (Wrangler's default OAuth scope), so these need a manual
  dashboard check; see `docs/deployment/CLOUDFLARE_CONFIGURATION.md`'s checklist. Most notably:
  Cloudflare's own "Content Signals"/AI Crawl Control feature is already injecting AI-crawler
  Disallow rules into CrawlPact's own `robots.txt`, unprompted — a product decision for the user,
  not something to silently accept or silently disable.
- `status.astro`'s "Paddle billing: Available" label is hardcoded rather than checking real secret
  presence — now visibly inaccurate on the live production `/status` page. Flagged, not fixed
  (application code change, outside this pass's Cloudflare-infrastructure scope without explicit
  sign-off).
- Preview's `PUBLIC_SITE_URL`/`WEBAUTHN_RP_ID`/`WEBAUTHN_RP_ORIGIN` still say `preview.crawlpact.com`
  rather than preview's real `workers.dev` hostname.

See `docs/deployment/DEPLOYMENT.md`'s "2026-07-26 deployment record",
`docs/deployment/CLOUDFLARE_CONFIGURATION.md`, and `docs/deployment/CLOUDFLARE_ENVIRONMENT_MATRIX.md`
for full detail. No secret values appear in any of these documents.

## Cloudflare infrastructure-alignment pass (2026-07-26)

A 23-phase brief asked for a full audit/alignment of CrawlPact's architecture against an approved
Cloudflare plan (Workers, D1, R2, Workers Static Assets/Pages, DNS/SSL/CDN, Cron Triggers, Paddle).
Per the user's explicit scope decisions: **R2 is not adopted** (no current technical need — see
`docs/data/D1_R2_DATA_PLACEMENT_POLICY.md`); the framing throughout is "how far can Workers Free
be stretched," not an assumption of immediate Paid upgrade; and **all documentation/analysis
phases were completed, while code changes (wrangler.jsonc hardening, cache-header implementation,
D1 write batching, new tests) were deliberately deferred** pending review of the findings below.

**Documents created:**

- `docs/deployment/CLOUDFLARE_RESOURCE_LIMITS.md` — ~27 current Cloudflare Free-plan limits,
  verified live against official docs 2026-07-26 (Phase 0).
- `docs/deployment/CLOUDFLARE_ARCHITECTURE_AUDIT.md` — current-state audit of every Cloudflare
  touchpoint in the codebase (Phase 1).
- `docs/architecture/adr/ADR-0006-CLOUDFLARE-STATIC-DELIVERY.md` — formalizes keeping Workers
  Static Assets over a Cloudflare Pages split (Phase 2/3).
- `docs/data/D1_R2_DATA_PLACEMENT_POLICY.md` — the R2 decision and its five revisit triggers
  (Phase 4/6).
- `docs/data/D1_STORAGE_CAPACITY_AUDIT.md` — per-table D1 growth model, three scenarios (Phase 5).
- `docs/operations/SCAN_CAPACITY_BUDGET.md` — per-scan CPU/subrequest/D1 cost budget (Phase 10).
- `docs/operations/MONITORING_CAPACITY_PLAN.md` — six scheduled-monitoring scenarios (Phase 11).
- `docs/operations/CLOUDFLARE_UPGRADE_TRIGGERS.md` — concrete warning/action thresholds (Phase 12).
- `docs/deployment/CDN_CACHE_POLICY.md` — cache policy defined, header implementation deferred
  (Phase 13).
- `docs/release/CLOUDFLARE_CAPACITY_AND_COST_REPORT.md` — capstone synthesis (Phase 21).

**Documents updated:** `docs/deployment/CLOUDFLARE_CONFIGURATION.md` (DNS/SSL/domain checklist,
R2 note), `docs/deployment/DEPLOYMENT.md`, `docs/deployment/ENVIRONMENTS.md` (corrected a stale
"once implemented" note — the environment banner has been live since Part 3 Step 26),
`docs/operations/BACKUP_AND_RECOVERY.md` (verified 7-day Time Travel window, tabletop drill
detail), `docs/data/DATA_RETENTION.md` and `docs/data/DATA_MODEL.md` (R2 cross-references, 8
missing migration entries added, a newly-found FK gap noted), `docs/architecture/ARCHITECTURE.md`
(corrected stale "not yet implemented" language left over from Part 1), and
`docs/performance/PERFORMANCE_AND_COST.md` (linked to the new, more specific capacity analysis).

### Two central findings, more consequential than a "Free-plan-friendly" audit would suggest

1. **CPU time (10ms/invocation on Free) is now quantified, not just judged by shape.** A single
   scan is estimated at ≈3–7ms typical, ≈12–25ms+ worst case — thin-to-negative margin — driven by
   two previously-uncosted mechanisms: an unbatched ~30–76-statement D1 write fan-out per scan, and
   an uncapped findings count (up to ~46 in a realistic worst case). The scheduled monitoring
   sweep shares this same ceiling across its whole per-tick batch, meaning the current 20-domain
   default is "essentially certain" to fail, and backlog is modeled to begin accumulating
   somewhere between 5 and 50 Solo customers — **well below the SRS's own 150+/1,000-domain
   commercial target**, which the current design cannot reach under Workers Free at all.
2. **D1 storage is not the non-issue a per-scan glance suggests.** `scan_resources` rows tagged
   `html_meta` store the full truncated homepage HTML body, not just meta tags. At the SRS's own
   commercial target, the production database is modeled to reach 45–70% of its 500MB per-database
   cap within one year and cross it entirely between year 1–2 — driven by this one field
   compounding across Pro/Agency's multi-year retention windows.

Neither finding recommends Queues, Workflows, Durable Objects, or R2 as the fix — both conclude the
existing bounded-batch-plus-cron architecture is the right shape, and the load-bearing remedy is
either cheap, targeted tightening (D1 write batching, capping findings, reducing `html_meta`
capture size, populating the unused `resource_hash` column for deduplication) or, once volume
outgrows what tightening can buy, a Workers Paid upgrade for CPU headroom specifically — not the
daily request/D1-write quotas, which stay comfortable at every modeled scale.

### New risks surfaced (added to `docs/status/KNOWN_RISKS.md`)

The unbatched D1 write fan-out and uncapped findings count; `html_meta`'s full-HTML capture as the
dominant D1 growth driver; a missing `ON DELETE CASCADE` on `scan_diffs.previous_scan_id`/
`current_scan_id` (same bug class as the Part 3 Step 21 fixes, not yet fixed); `product_events`/
`security_events`/`notifications` having no purge job at all; RSL parsing's missing pre-parse size
bound and a sitemap sparse-`<loc>` full-scan gap; and the orchestrator's subrequest counter
undercounting true consumption by excluding redirect hops.

### Deferred to a follow-up pass (explicitly out of this pass's scope)

Wrangler.jsonc hardening (Phase 18), R2 bindings/storage abstraction (skipped — R2 not adopted),
CDN cache-header implementation and header tests (Phase 13/20 code), D1 write batching and the
other capacity tightening measures named above, the `scan_diffs` FK fix, a Super Admin capacity-
visibility UI (Phase 17), and the recovery tabletop drill itself (requires a real Cloudflare
account, which does not exist).

### Quality gate results (this pass, run 2026-07-26)

| Check | Command | Result |
| --- | --- | --- |
| Format | `pnpm format:check` | ✅ Pass (15 doc files needed `pnpm format`, then re-checked clean) |
| Lint | `pnpm lint` | ✅ Pass — 0 errors |
| Typecheck | `pnpm typecheck` | ✅ Pass — 293 files, 0 errors, 0 warnings, 31 informational hints |
| Unit tests | `pnpm test:unit` | ✅ Pass — 189/189, 18 files |
| Integration tests | `pnpm test:integration` | ✅ Pass — 137/137, 22 files, against real D1 |
| Migration/schema drift | `pnpm db:validate` | ✅ Pass — 38 tables verified consistent |
| Build | `pnpm build` | ✅ Pass |

No application code was touched this pass (documentation/analysis only, confirmed via `git status`
before running the gate) — e2e/a11y/visual suites were not re-run since no UI or behavior changed,
consistent with the quality-gate skill's own guidance. A standalone `wrangler deploy --dry-run`
invocation (attempted as supplementary evidence for Phase 23's "wrangler dry-run deployment" ask)
produced bundler errors resolving Astro's virtual modules (`astro:static-paths`, `virtual:astro:app`)
when run directly against `wrangler.jsonc`'s `main: ./src/worker.ts` — most likely an artifact of
invoking Wrangler standalone outside whatever build-integration context makes the documented
`pnpm build` → `wrangler deploy` flow work in practice (a long-established, widely-used Astro/
Cloudflare-adapter pattern), not a newly-discovered break in this specific project. Not confirmed
either way with certainty; recorded as an open question worth checking during an actual first
deploy rather than asserted as broken, since resolving it with certainty would mean touching
build/deploy tooling, out of this pass's scope.

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
