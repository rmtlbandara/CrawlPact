# Changelog

This file tracks engineering-level changes to the CrawlPact repository. For the customer-facing
changelog, see the `/changelog` page on the public website.

All notable changes are grouped by development "Part," per `docs/product/CRAWLPACT_FINAL_SRS.md`
§37.

## Cloudflare Infrastructure Alignment — Capacity Audit and Analysis (2026-07-26)

A 23-phase brief requested full alignment of CrawlPact's architecture with an approved Cloudflare
plan (Workers, D1, R2, Workers Static Assets/Pages, DNS/SSL/CDN, Cron Triggers, Paddle). Per the
user's explicit scope: R2 is not adopted (no current technical need), the analysis is framed
around extending Workers Free headroom rather than assuming an immediate Paid upgrade, and all
documentation/analysis phases were completed while risky code changes (wrangler.jsonc hardening,
cache-header implementation, D1 write batching, new tests) were deliberately deferred. See
`docs/status/IMPLEMENTATION_STATUS.md`'s matching entry for the full document list.

### Added

- **Verified current Cloudflare Free-plan limits** (`docs/deployment/CLOUDFLARE_RESOURCE_LIMITS.md`) —
  ~27 limits fetched live against official docs, including confirming D1's 500MB per-database cap
  is distinct from its 5GB account-wide total, and that Cloudflare Pages' "unlimited" claim is
  scoped to static-asset requests only, not Functions/dynamic requests.
- **A full current-state Cloudflare architecture audit** (`docs/deployment/CLOUDFLARE_ARCHITECTURE_AUDIT.md`)
  confirming R2 is unused anywhere in the codebase, production/preview D1 are structurally
  separate, and scan evidence lives entirely in D1 as capped TEXT.
- **ADR-0006**, formalizing the decision to keep Workers Static Assets over a Cloudflare Pages
  split, with the honest caveat that Workers Static Assets requests likely count against the
  shared Workers daily-request budget (unlike Pages' exempt static-asset requests) — not
  independently verified, flagged as a follow-up.
- **A D1/R2 data placement policy** (`docs/data/D1_R2_DATA_PLACEMENT_POLICY.md`) concluding R2 is
  not justified today, with five concrete, evidence-based triggers that would reopen the decision.
- **A D1 storage capacity model** (`docs/data/D1_STORAGE_CAPACITY_AUDIT.md`) finding the production
  database is expected to reach 45–70% of its 500MB cap within one year, and cross it entirely
  between year 1–2, at the SRS's own commercial target — driven by `scan_resources`'s `html_meta`
  rows capturing full homepage HTML rather than just meta tags, compounding across Pro/Agency's
  multi-year retention windows.
- **A scan capacity budget and monitoring capacity plan**
  (`docs/operations/SCAN_CAPACITY_BUDGET.md`, `docs/operations/MONITORING_CAPACITY_PLAN.md`)
  quantifying, for the first time, that a real scan's CPU cost (≈3–7ms typical, ≈12–25ms+ worst
  case) leaves thin-to-negative margin against Workers Free's 10ms ceiling — driven by an
  unbatched D1 write fan-out and an uncapped findings count — and that the scheduled monitoring
  sweep's current 20-domain default batch size is "essentially certain" to exceed that same
  ceiling, with backlog modeled to begin between 5 and 50 Solo customers.
- **Concrete upgrade triggers** (`docs/operations/CLOUDFLARE_UPGRADE_TRIGGERS.md`) and a **CDN
  cache policy** (`docs/deployment/CDN_CACHE_POLICY.md`, policy only — header implementation
  deferred) turning the above into warning/action thresholds.
- **A capstone capacity and cost report** (`docs/release/CLOUDFLARE_CAPACITY_AND_COST_REPORT.md`)
  synthesizing all of the above into a recommended launch configuration.

### Documentation corrections made along the way

- `docs/architecture/ARCHITECTURE.md` still described authentication, billing, monitoring, the
  scanner, and Super Admin as "architected for but not implemented" — stale since Part 1; all are
  now real, built features.
- `docs/deployment/ENVIRONMENTS.md` still described the environment indicator banner as pending
  ("once implemented") — it has been live since Part 3 Step 26.
- `docs/data/DATA_MODEL.md`'s migration table stopped at migration 8 of the now-16 that exist.

### Discovered, not fixed (out of scope for this docs-only pass — see `docs/status/KNOWN_RISKS.md`)

An unbatched D1 write fan-out and uncapped findings count in the scan-persistence path; a missing
`ON DELETE CASCADE` on `scan_diffs.previous_scan_id`/`current_scan_id` (same bug class as three
previously-fixed migrations); `product_events`/`security_events`/`notifications` having no purge
job; RSL parsing's missing pre-parse size bound; a sitemap sparse-`<loc>` full-scan gap; and the
scanner's subrequest counter undercounting true consumption by excluding redirect hops.

## UI/UX Conversion Audit — Trust and Consistency Fixes (2026-07-26)

A full route-by-route UI/UX and conversion audit (`docs/design/UI_UX_CONVERSION_AUDIT.md`) found
the product already faithful to the SRS and honest, with a short list of concrete, verifiable
bugs rather than a generic look needing a rebrand. This entry covers those fixes only — no new
brand/logo system or homepage rebuild was in scope for this pass.

### Fixed

- **Policy Health Score category breakdown now reaches real reports.** `computePolicyHealthScore`
  (`packages/policy/src/scoring.ts`) always computed a per-category breakdown, but it was
  discarded before persistence (`persist-scan.ts`) and absent from the API contract
  (`policyHealthScoreSchema`) — every real report (anonymous, saved-domain, shared-link) showed a
  bare score number, while only the landing page's synthetic demo showed the category detail.
  Added `scans.score_breakdown` (migration `0016_scan_score_breakdown.sql`), threaded it through
  the contract, `persist-scan.ts`, and `get-scan-report.ts`, and wired it into
  `AuditReportView`'s `ScoreComponent`. Also extracted the score→label mapping
  (`scoreLabelFor`) into `packages/policy` as the single source of truth, removing a duplicate
  private copy in `get-scan-report.ts`.
- **Domain detail page's score had no label.** `apps/web/src/pages/app/domains/[domainId].astro`
  passed a hardcoded empty label; now uses the shared `scoreLabelFor` helper.
- **Pricing page (`/pricing`) CTAs brought to parity with the homepage's own pricing teaser.**
  Added the same per-plan card pattern (per-plan CTA, "Recommended" badge on Pro) that already
  existed on the homepage — previously `/pricing` only had one generic "Create an account" link.
- **Missing analytics events (SRS §9.20).** Added `crawler_reference_page_opened` (fired from
  crawler-reference pages) and a `source` property on `audit_started`/`audit_completed`/
  `audit_failed` (forwarding each `AuditForm`'s `idPrefix`) so "Hero audit started" and "Final CTA
  audit started" can be distinguished from the same event stream, as the SRS requires.
- **Super Admin shell had no mobile/tablet navigation.** The desktop sidebar is `hidden lg:flex`
  with no replacement below 1024px. Added `AdminMobileNav.tsx` (same Drawer/IconButton pattern as
  the public site's `MobileNav`) wired into `AdminNav.astro`'s header.
- **A real WCAG 2.2 AA color-contrast violation**, found by the a11y coverage extension below:
  the admin sidebar's section headings used `text-neutral-500` (3.63:1) against the dark
  `neutral-950` background. Fixed to `text-neutral-300` (already used elsewhere in the same file
  against the same background).
- **Automated a11y/visual-regression coverage was public-site-only.** Added authenticated-route
  coverage: `/app` and `/admin` to `tests/a11y/home.spec.ts` (Chromium-only, real WebAuthn
  ceremony); `/app` (empty state) and `/admin/settings` to `tests/visual/core-pages.spec.ts` (14
  new baseline snapshots across all 7 breakpoints).

### Discovered, not fixed (out of scope for this pass — see `docs/status/KNOWN_RISKS.md`)

- The existing 91-snapshot visual-regression baseline is now confirmed stale against the current
  app: every one of the 13 pre-existing routes fails a fresh comparison, uniformly, by the exact
  height of the `PUBLIC_APP_ENV` environment banner added in Part 3 Step 26 — the baseline
  predates that banner and was never regenerated. Not regenerated in this pass since it's
  unrelated to any of the fixes above and out of this pass's scope.
- A pre-existing, unrelated a11y test failure on the `mobile-safari` Playwright project (the
  homepage's "skip link" keyboard-focus test) — a known Playwright/WebKit `Tab`-key limitation,
  confirmed unrelated to any file touched in this pass.

## Part 3 — Super Admin, Agency, SEO Launch, and Production Hardening (2026-07-24)

Super Admin Control Center (all 20 SRS §28 subsections), agency features, the full SRS §30.4 SEO
content minimum, accessibility/visual/performance hardening, operational runbooks, a real
privacy/retention bug fix, a real SRS traceability + security + production-readiness audit with
a genuine new e2e test suite, and production configuration preparation. See
`docs/status/IMPLEMENTATION_STATUS.md` for the detailed, maintained record — this entry is a
summary, not the source of truth.

### Added

- **Super Admin Control Center**: global dashboard (every §28.2 metric, date-range filters),
  user management (search/inspect/suspend/restore/revoke/delete with reason + audit log), full
  subscription/revenue/webhook administration (Paddle resync, temporary entitlements, webhook
  retry), global domain/scan operations (admin scans don't consume customer quota), scheduler
  health monitoring (missed/overlapping/stuck/long-execution/excessive-failure-rate detection),
  registry administration (crawler/operator CRUD, versioned release/publish/rollback/compare),
  findings analytics, security monitoring (suspend/block/revoke), content/notices, runtime
  configuration (validated safe ranges), maintenance mode, role model (6 roles defined, only
  `super_admin` assignable per the SRS's own stated MVP scope), and an audit log every sensitive
  action writes to automatically via one `requireAdminAction` chokepoint.
- **Agency features**: client groups, batch domain import with per-row error reporting, portfolio
  filters (group/monitoring/score/findings), client-safe share links with limited agency branding.
- **SEO content minimum (SRS §30.4), met and exceeded**: 20 crawler-reference pages (all
  source-verified against real operator documentation), 20 guides (10 decision/comparison + 5
  implementation + 5 troubleshooting), 5 free validator tools (`/tools/*`) that each genuinely
  lead with their own scoped section of a real scan rather than being relabelled duplicates,
  methodology/scoring/changelog pages, full technical SEO (canonical, Open Graph, structured
  data, sitemap, noindex rules) verified by a sitemap-driven Playwright test.
- **Accessibility, visual, and performance hardening**: skip-link/breadcrumb/focus-management
  fixes, a 91-snapshot visual-regression baseline (13 routes × 7 breakpoints), SQL-pushed admin
  list filtering with hard limit ceilings, 5 new database indexes.
- **Operational runbooks**: backup/recovery, incident response, system health, and the main
  runbook, all rewritten with real, verified admin routes and procedures.
- **A real, previously-undiscovered privacy/retention bug, found and fixed**: deleting a user
  account with any historical billing, scan, or admin-action row threw and aborted the entire
  daily data-retention cron job (14 actor-reference foreign key columns across `billing_customers`,
  `product_events`, `crawlers`, `registry_versions`, `ruleset_versions`, `admin_role_assignments`,
  `temporary_entitlements`, `scans`, `system_notices`, `security_events`, `admin_audit_logs`,
  `blocked_targets`, `runtime_configuration`, `internal_user_notes` all defaulted to `NO ACTION`
  instead of `SET NULL`). Fixed via migrations 0013–0015.
- **A real e2e test suite** (`auth-and-account.spec.ts`, `admin-flows.spec.ts`) using a real
  Chromium DevTools Protocol WebAuthn virtual authenticator — not a fabricated response — driving
  real passkey registration/sign-in, save-domain-and-scan, account deletion, report printing, and
  four Super Admin journeys end-to-end.
- **Three final audit reports**, each a real evidence-based pass, not a restatement of plans:
  `docs/status/FINAL_SRS_COMPLIANCE_REPORT.md`, `docs/status/FINAL_SECURITY_AUDIT.md`,
  `docs/status/FINAL_PRODUCTION_READINESS_REPORT.md`.
- **Production configuration fixes**: `env.preview` in `wrangler.jsonc` now has its own D1
  database binding and `PUBLIC_SITE_URL`/`WEBAUTHN_RP_ID`/`WEBAUTHN_RP_ORIGIN` (previously
  silently inherited production's or were missing entirely — the latter would have broken
  passkey auth outright on first production deploy); an SRS §10.43 environment indicator banner.
- Super Admin accounts now require keeping at least 2 registered passkeys (SRS §28.20) —
  `removeCredential` refuses to drop below that for an active admin account.

### Fixed

Issues found by actually running things, not by inspection:

- `PRAGMA foreign_keys=OFF` is silently a no-op inside a D1 migration file (D1 wraps it in one
  implicit transaction; SQLite ignores `foreign_keys` pragma changes mid-transaction) — the
  retention-fix migrations above originally shipped with it, passed against a fresh `sqlite3`
  CLI test, then failed against real D1. Fixed with `PRAGMA defer_foreign_keys=ON` instead.
- `db:validate`'s static parser false-positived on the SQLite table-rebuild pattern's intermediate
  `_new` tables.
- A real SSR crash in the customer dashboard's Overview page for any brand-new, zero-domain
  account (`EmptyState`'s `action` prop received Astro template syntax instead of a real React
  element; the dev server silently returned `200` with an empty body instead of a 500) — found by
  the new e2e suite, since it was the first thing in the project's history to render that page
  for a genuinely empty account through a real browser.
- Two stale claims in `docs/security/SECURITY_CHECKLIST.md` (administrative audit logs marked
  "schema only" when fully built; production/preview separation marked done when it wasn't).
- Registry publication workflow's traceability row incorrectly still said "Part 3" after Part 3
  built it.

### Known gaps (see `docs/status/KNOWN_RISKS.md`)

Paddle field-shapes still unverified against a live sandbox account (the single most important
remaining item before production launch); visual-regression baseline still not wired into CI
(platform-suffix mismatch); e2e coverage against SRS §35.3's full journey list is real but not
exhaustive (scheduled scan, Paddle purchase/portal, agency report have no dedicated e2e test yet);
`env.preview`'s domain-specific values are structurally correct but still placeholders pending a
real preview domain; no cross-request target-frequency abuse monitoring. **This repository still
has zero git commits.**

## Part 2 — Customer-Facing SaaS (2026-07-23)

Complete customer-facing product: live scanner, robots.txt engine, crawler registry, policy
evaluation, findings/scoring, recommendations, full report pipeline, passkey authentication,
saved domains, customer dashboard, scheduled monitoring, notifications, Paddle billing, and
first-party analytics. See `docs/status/IMPLEMENTATION_STATUS.md` for the detailed, maintained
record — this entry is a summary, not the source of truth.

### Added

- `packages/scanner`: safe-fetch chokepoint with full timeout/redirect/size/request-count
  enforcement; `packages/robots`: RFC 9309 parser + evaluator; `packages/registry`: versioned
  crawler registry (13 crawlers, 8 operators); `packages/policy`: presets, additional-signal
  parsers (llms.txt, RSL, Content Signals, HTML/HTTP, sitemap), conflict detection, findings,
  Policy Health Score, deterministic recommendations.
- `POST /api/audit` now runs a real, bounded scan end-to-end when `AUDIT_ENGINE_ENABLED=true` —
  still returns the honest `AUDIT_ENGINE_DISABLED` error, never a fabricated result, when `false`.
- Passkey-only (WebAuthn) authentication: registration, login, credential management, DB-backed
  revocable sessions, hashed one-time recovery codes, step-up auth for sensitive actions.
- Saved domains, domain groups, ownership-scoped everywhere; customer dashboard (`/app/*`).
- Scheduled monitoring sweep with drift detection and failure backoff/pause; notification centre
  with a private, revocable Atom feed.
- Paddle Billing v2 integration: checkout, customer portal, signature-verified/idempotent webhook
  processing with out-of-order protection — not verified against a live sandbox account.
- First-party, cookie-free analytics and shared-report tokens.
- Security/privacy hardening: CSP + full security headers on every SSR response, CSRF defence
  (SameSite + Origin/Referer check), anonymous-audit rate limiting, target blocklist enforcement,
  CSV formula-injection prevention, daily data-retention purge job, IP hashing.
- 252 unit/integration tests (28 files) against a real Miniflare-backed D1 database; 8 e2e tests,
  16 accessibility tests, and a new 42-snapshot visual-regression baseline (6 pages × 7
  breakpoints) — all run and passing this Part.
- 51 real public domains audited respectfully (sequential, 3s gap, no parallelism) as a real-world
  correctness check — see `docs/status/PART2_REAL_DOMAIN_TEST_RESULTS.md`.

### Fixed

Issues found by actually running the quality gate and the real-domain test, not by inspection:

- **Total-scan timeout (FR-FET-007) was missing** — only a per-resource timeout existed, so a
  slow target's 5 sequential resource fetches could compound to ~5× the per-resource timeout
  (confirmed: `npr.org` took 104s). Added an enforced, configurable total-scan budget (default
  30s); the same domain now completes in 30.5s.
- `persist-scan.ts` primary-key collision when a robots.txt fetch was fully refused.
- CSRF rollout required fixing ~15 existing integration tests' missing `Origin` headers.
- One e2e test bug (missing hydration wait on the mobile nav test, same class of race already
  documented for the audit form).

### Known gaps (see `docs/status/KNOWN_RISKS.md`)

Paddle field-shapes unverified against a live sandbox account; visual-regression baseline not
wired into CI (platform-suffix mismatch between local macOS generation and Linux CI); no
cross-request target-frequency abuse monitoring; billing records have no retention/purge job;
Super Admin and agency-feature polish are Part 3 scope. **This repository has zero git commits —
all Part 1 and Part 2 work exists only in the working tree.**

## Part 1 — Engineering Foundation (2026-07-22)

Initial repository build-out. See `docs/status/IMPLEMENTATION_STATUS.md` for the detailed,
maintained record — this entry is a summary, not the source of truth.

### Added

- pnpm workspace monorepo: `apps/web` (Astro on Cloudflare Workers) + `packages/{core,scanner,
registry,database,ui,config}`.
- Architecture Decision Records ADR-0001 through ADR-0005.
- Full documentation tree under `docs/` (architecture, design, api, data, security, testing,
  operations, deployment, seo, registry, status, release).
- D1 schema: 8 migrations, 38 tables, matching Drizzle schema mirror, `db:validate` drift check.
- Local dev seed: subscription plans, a non-production Super Admin fixture, an 8-operator /
  13-crawler development crawler registry.
- Design system: tokens (`packages/ui/src/tokens/tokens.css`) and 36 accessible components
  (Radix UI + Tailwind CSS v4).
- Public website: landing page (all 15 required sections), crawler directory, guides, free
  tools index + 5 validator pages, pricing, methodology, scoring, scanner info, changelog,
  status, security, privacy, terms, acceptable-use, limitations, sign-in placeholder.
- `POST /api/audit`: validates and normalises input, returns `AUDIT_ENGINE_DISABLED` honestly —
  never a fabricated result.
- Typed API contracts for audit, auth, domains, groups, notifications, billing, sharing, admin.
- CI workflow: format, lint, typecheck, unit + integration tests, migration validation,
  dependency audit, secret scanning, build, e2e + accessibility smoke tests.
- Agent governance: `CLAUDE.md`, `AGENTS.md`, nested `AGENTS.md` for `packages/scanner`,
  `packages/database`, `apps/web/src/pages/api`; `.claude/settings.json`; three repo-local
  skills (`quality-gate`, `security-review`, `release-audit`).

### Fixed

Issues found by actually running the quality gate (format, lint, typecheck, unit/integration
tests, D1 migrations + seed against a local database, e2e, and axe-core accessibility scans),
not by inspection — see `docs/status/KNOWN_RISKS.md` for full detail:

- `Astro.locals.runtime.env` access, removed in Astro v6+/`@astrojs/cloudflare` 14.x; moved to
  `import { env } from "cloudflare:workers"` via a dedicated `apps/web/src/lib/env.ts`.
- Legacy `src/content/config.ts` location and collection API; migrated to `src/content.config.ts`
  with the `glob()` loader.
- Two design tokens (`--color-warning`, `--color-neutral-500`) failing WCAG AA 4.5:1 contrast.
- Inline prose links relying on hover-only underline, failing axe's `link-in-text-block` check.
- A horizontally-scrollable table not reachable by keyboard (WCAG 2.1.1).

### Known gaps (see `docs/status/KNOWN_RISKS.md`)

Scanner, authentication, monitoring, billing, and Super Admin are not implemented. SEO content
minimum (SRS §30.4) is not yet reached. No visual-regression baseline exists yet. Content
Security Policy is not yet configured.
