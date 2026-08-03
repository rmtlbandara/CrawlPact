# CrawlPact Phase 0 Baseline Report

**Audit date**: 2026-08-03 (starting 10:09:42 UTC / 15:39:42 Asia/Colombo) · **Phase branch**:
`phase-00-baseline-governance` · **Starting/ending SHA**: `0d23f5a4b589ade5e14e7070aadb8607357c7d46`
(no product commit was made on this branch — this branch adds only Phase 0 documentation)

## 1. Executive summary

This is an inspection, evidence-preservation, documentation, and programme-governance phase. It
establishes the current, verified state of the CrawlPact repository and its connected production
infrastructure (Cloudflare Workers, D1, KV, R2, Paddle) as of 2026-08-03, before any of the 19
subsequent improvement phases begin. **No product, database, billing, infrastructure,
crawler-registry, pricing, or production-runtime behaviour was changed.**

Headline findings: production is real, live, and functioning — the anonymous audit engine
(`AUDIT_ENGINE_ENABLED=true`), Paddle billing, and the full Cloudflare stack are all confirmed live
via direct read-only checks this session, not merely documented. The local quality gate passes
cleanly end-to-end (0 errors, 379/379 unit+integration tests). Local and production database
migration state are in perfect sync (18/18 migrations, no drift). However, this audit found
**15 documentation conflicts** (3 rated P1) — most stemming from three "Final" audit/compliance/
readiness reports that are six days stale relative to real, subsequent production work (the audit
engine being enabled, Google Analytics added, R2 adopted, and an incident-tracking system
shipped) — and **13 new risks** (0 P0, 3 P1, 10 P2), none of which block continuing to Phase 1.

## 2. Scope and restrictions

Performed strictly under Phase 0's mandatory boundaries: no product behaviour, brand messaging,
homepage content, pricing, Paddle configuration, database migration, production data, crawler
registry, Cloudflare/DNS/Worker settings, cron schedule, secrets, analytics behaviour, or legal
page was modified. No production deployment occurred. GitHub governance (milestones/labels/issues)
was intentionally limited to a setup manifest per explicit user instruction, rather than live
writes, even though write access was available and confirmed working this session.

## 3. Audit timestamps

- Start: 2026-08-03T10:09:42Z UTC / 2026-08-03T15:39:42+05:30 Asia/Colombo.
- All infrastructure/production checks in this report were performed within this same session,
  timestamps recorded per-section in the individual baseline documents.

## 4. Repository baseline

- Repository: `https://github.com/rmtlbandara/CrawlPact.git`
- Default branch: `main`
- Default-branch HEAD at start: `0d23f5a4b589ade5e14e7070aadb8607357c7d46`
- Phase branch: `phase-00-baseline-governance`, branched directly from `main` at the same commit
- Working tree was clean before any Phase 0 work began (`git status` confirmed)
- Tooling: git 2.50.1, Node v22.23.1, pnpm 9.15.0, Wrangler 4.114.0

## 5. Production deployment baseline

- Production Worker: `crawlpact-web` (also `crawlpact-web-preview` for preview,
  `crawlpact-e2e-fixture` for test fixtures — all confirmed live via Cloudflare MCP).
- Production URL `https://crawlpact.com` confirmed live: `200`, HSTS + full CSP + security headers
  present, HTTP→HTTPS and `www`→apex both resolve correctly, custom 404 works.
- Production and default branch (`main`) are aligned — the current default-branch HEAD is the
  commit referenced throughout `docs/status/IMPLEMENTATION_STATUS.md`'s most recent entries.
- Full detail: `PRODUCTION_INFRASTRUCTURE_INVENTORY.md`.

## 6. Infrastructure baseline

- Cloudflare bindings (D1 ×2, KV ×2, R2 ×2, one cron trigger) all confirmed live via read-only MCP
  calls, matching `apps/web/wrangler.jsonc` exactly — zero drift between declared and deployed
  config.
- Paddle live catalog (3 products/prices, 1 active webhook destination) confirmed live via
  read-only MCP calls, matching `wrangler.jsonc`'s price-ID vars exactly.
- Full detail: `PRODUCTION_INFRASTRUCTURE_INVENTORY.md`, `ENVIRONMENT_AND_BINDING_INVENTORY.md`.

## 7. Route inventory summary

61 Astro pages + 93 API routes + 2 standalone route handlers, classified into 14 buckets
(Marketing, Free tool, Audit, Authentication, Account, Domain management, Monitoring,
Notifications, Billing, Agency, Admin, API, Status/trust/legal, Static asset/error/redirect).
Full detail: `ROUTE_INVENTORY.md`.

## 8. Capability summary

24 capabilities assessed. 8 `verified-live`, 5 `verified-partial`, 11
`code-present-not-production-verified`, 0 `documented-only`/`unknown`. The most consequential
finding: `AUDIT_ENGINE_ENABLED=true` in production is independently confirmed via three separate
evidence paths this session (live `wrangler.jsonc` read, live production `/status` HTTP check, and
cross-reference against `IMPLEMENTATION_STATUS.md`'s documented 2026-07-28 enablement). Full
detail: `CAPABILITY_MATRIX.md`.

## 9. Database and migration summary

18/18 migrations applied identically in local, production, and preview — **zero drift**. 40 tables
per local static validation; 39 tables per a live production `sqlite_master` query (discrepancy
logged, not resolved, in this phase). One known, still-open FK gap (`scan_diffs`'s missing
`ON DELETE` clause) reconfirmed unfixed. Full detail: `DATABASE_AND_MIGRATION_BASELINE.md`.

## 10. Billing summary

Paddle catalog confirmed live and matching code exactly: 3 annual-only plans ($79/$179/$399),
webhook destination active with the correct 24-event subscription set. A real, disclosed
inconsistency was found: `packages/core/src/api/contracts/billing.ts` describes a checkout
API shape that was never actually built and is entirely unused dead code. A real paid checkout
lifecycle has still never been run (pre-existing, disclosed gap, unchanged). Full detail:
`BILLING_AND_PLAN_BASELINE.md`.

## 11. Registry summary

23 crawlers across 9 operators (not "21/9" as two governance documents state — one of which
self-contradicts, separately claiming "23 crawlers total" elsewhere). A full admin registry
UI/API/test suite exists, contradicting a governance document's claim that no such UI exists.
Bingbot remains the one crawler with no public directory page (JS-rendered official source,
disclosed, unchanged). Full detail: `CRAWLER_REGISTRY_BASELINE.md`.

## 12. Analytics summary

Two systems coexist: Google Analytics (marketing pages, production-only, a disclosed, deliberate
SRS §6.2/§28.13 deviation) and a first-party `product_events` system. No cookie-consent mechanism
exists anywhere in the codebase. No automated test guards GA's layout-scope boundary. Full detail:
`ANALYTICS_AND_CONSENT_BASELINE.md`.

## 13. Test and CI summary

`pnpm quality` (this session): **exit code 0**, format/lint/typecheck all clean, 230/230 unit +
149/149 integration tests passing, `db:validate` 40 tables verified, build passing. CI's latest
run against the current HEAD on `main` (`Merge when green`): success. `main` has no GitHub
branch-protection rule (a known, disclosed platform constraint, not a new gap). One open
Dependabot PR currently has a failing CI run (new finding, low urgency). Full detail:
`TEST_AND_CI_EVIDENCE.md`.

## 14. Screenshot evidence

**Blocked** — no browser-automation tool was available in this session's environment. Disclosed
honestly, not fabricated or silently omitted. See `SCREENSHOT_MANIFEST.md`.

## 15. Documentation conflicts

15 conflicts found (DC-001 through DC-015), 3 rated P1: (a) `SECURITY_CHECKLIST.md` still says
Paddle webhook payloads are unverified against a live account — resolved 2026-07-28; (b)
`KNOWN_RISKS.md`'s own risk table still shows "keep `AUDIT_ENGINE_ENABLED` disabled" as current,
unstruck, despite the same document elsewhere reflecting the override; (c) the three "Final"
SRS-compliance/security/production-readiness reports all predate and omit six days of subsequent
real work (GA, R2, incident tracking). Full detail: `DOCUMENTATION_CONFLICTS.md`.

## 16. Risks and unknowns

13 new risks logged (0 P0, 3 P1, 10 P2) plus 6 access/scope-limited unknowns. No risk found this
session rises to P0 (launch-blocking). Full detail: `BASELINE_RISKS_AND_UNKNOWNS.md`.

## 17. Access limitations

- Cron execution history (vs. configuration) not queried.
- Zone-level DNS/SSL/WAF config not re-queried (zone-read-only API token, documented constraint).
- Production Worker secret _presence_ (not values) not re-verified this session.
- E2E/a11y/Lighthouse suites not re-run (no UI/behavior change occurred this phase).
- Screenshot capture blocked (no browser-automation tool available).

## 18. Future-phase routing

Every conflict and risk found in this audit has been assigned a recommended future phase in
`DOCUMENTATION_CONFLICTS.md` and `BASELINE_RISKS_AND_UNKNOWNS.md`, and is indexed in
`docs/roadmap/CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md`. Phase 1 (Repository Documentation and
Source-of-Truth Correction) is the natural next step.

## 19. Confirmation that no product behaviour changed

Confirmed: `git status` before this phase showed a clean working tree; every finding in this
report was produced by read-only inspection (file reads, read-only Cloudflare/Paddle/GitHub API
calls, read-only D1 `SELECT` queries, and public HTTP `GET` requests) or by running the repository's
own existing, non-destructive quality-gate commands. No migration was applied, no Paddle
configuration was changed, no Cloudflare resource was modified, no secret was rotated, no crawler
entry was changed, and no production deployment occurred. The only repository changes made are the
new files listed in this report and its companion documents, all under `docs/`, plus (pending) a
`scripts/baseline-validate.mjs` script and a `pnpm baseline:validate` command.

## 20. Phase 0 completion decision

**Phase result: Complete**, pending the remaining mechanical steps (baseline-validate script
execution, file hashing, and committing this branch) which are being finished as part of this same
session. All applicable Phase 0 acceptance criteria are met: repository and production baselines
recorded with evidence and citations; every significant capability inventoried with an approved
status value; billing/database/registry baselines complete with no live mutation; the strongest
safe quality gate executed and passed; documentation conflicts and risks recorded, not silently
fixed; GitHub governance provided as a manifest per explicit user instruction; the master roadmap
and release gates are documented. See `PHASE_0_BASELINE_REPORT.md` §19 for the explicit
no-runtime-change confirmation and the individual documents listed below for full evidence.

## Evidence precedence used in this audit

When sources conflicted, this audit classified evidence in this order: (1) direct observation of
current production behaviour, (2) current production deployment/infrastructure metadata,
(3) current production database schema/migration state, (4) current default-branch code,
(5) current automated tests, (6) current non-archived documentation, (7) historical/archived
documentation, (8) previous audit reports. Every material contradiction found via this ordering is
recorded in `DOCUMENTATION_CONFLICTS.md`, not silently resolved in favor of one source.

## Companion documents

- `ROUTE_INVENTORY.md`
- `CAPABILITY_MATRIX.md`
- `PRODUCTION_INFRASTRUCTURE_INVENTORY.md`
- `ENVIRONMENT_AND_BINDING_INVENTORY.md`
- `DATABASE_AND_MIGRATION_BASELINE.md`
- `BILLING_AND_PLAN_BASELINE.md`
- `CRAWLER_REGISTRY_BASELINE.md`
- `ANALYTICS_AND_CONSENT_BASELINE.md`
- `TEST_AND_CI_EVIDENCE.md`
- `SCREENSHOT_MANIFEST.md`
- `DOCUMENTATION_CONFLICTS.md`
- `BASELINE_RISKS_AND_UNKNOWNS.md`
- `phase-0-baseline.json` / `phase-0-baseline.schema.json`
- `file-hashes.sha256`
- `../../governance/GITHUB_GOVERNANCE_SETUP_MANIFEST.md`
- `../../roadmap/CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md`
