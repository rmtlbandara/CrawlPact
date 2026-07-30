# Implementation Status

**Last updated:** 2026-07-28 · **Current as of commit:** `6320032` (`main`) ·
**Current phase:** Part 3 complete; eight follow-on passes (not numbered SRS Parts) have since been
completed — a UI/UX conversion audit and fix pass, a Cloudflare infrastructure-alignment pass, a
Cloudflare account setup + first production deployment pass, a release-engineering hardening
pass (CI/CD, environment contract, `/pay` and Paddle live-catalog verification, two live
production bugs found and fixed), a Paddle fulfillment/webhook live-delivery verification pass,
a production-stabilization pass that root-caused and fixed the long-standing real-CI e2e
instability, a full-scope production remediation pass that found and fixed the most severe
defect in the project's history (production account creation completely broken since launch),
and — superseding this document's own "keep disabled for now" decision below — the audit engine
was enabled in production and the crawler registry seeded, so the live scanner now returns real
scan results rather than the honest-disabled response described throughout most of this document
— see below, most recent first.

Real Cloudflare account, zone, Worker, D1 (production + preview), KV, and a live Paddle catalog
(Solo/Pro/Agency, client token, webhook destination) are connected and verified — see
`docs/deployment/CLOUDFLARE_CONFIGURATION.md`, `docs/deployment/PADDLE_LIVE_CONFIGURATION.md`, and
`docs/architecture/adr/ADR-0007-DEPLOYMENT-PIPELINE.md`. `/pay` is built, deployed, and verified.
The repository has real Git history (this is not a "zero commits" project) and a GitHub Actions
CI/CD pipeline (`.github/workflows/ci.yml`, `deploy-preview.yml`, `deploy-production.yml`).

## Production audit engine enabled, real crawler registry seeded (2026-07-28, commit `6320032`)

Per explicit user instruction, overriding the "decision: keep disabled for now" call recorded
below under "Production-stabilization pass" — that decision was this document's own, made
correctly at the time against the CPU-budget risk quantified in
`docs/operations/SCAN_CAPACITY_BUDGET.md`, and the override is the user's call to make, not a
walk-back of a mistake. `AUDIT_ENGINE_ENABLED=true` was set in `wrangler.jsonc` and deployed.

Enabling the flag surfaced a second, previously undiscovered blocker: production's crawler
registry tables (`crawler_operators`/`crawlers`/`registry_versions`/`ruleset_versions`) had never
been seeded, so `getActiveRegistry()` had nothing to return and no scan could complete even with
the engine on. Fixed by extracting the same real, source-verified-against-each-operator's-own-
documentation registry the public SEO content is already built around (not test data) from
`seed.sql` into an idempotent `reference-data.sql` seed, safe to re-run against production.

**Current state**: the live scanner is enabled in production and returns real scan results, not
the honest-disabled response. Every place that reflects this flag correctly reads it live at
request time (`status.astro`, `AuditForm.tsx`, `api/audit/index.ts`) — `scanner.astro` was found
to have it hardcoded into static build output during the Evidence Observatory redesign's Phase 4
work and was fixed to match the same live-read pattern (`feat/evidence-observatory-ui-ux-redesign`
branch). The CPU-budget risk documented in `docs/operations/SCAN_CAPACITY_BUDGET.md` is not
resolved by this change — it's an accepted, explicit tradeoff at current volume, not a claim that
the risk no longer exists; revisit if real usage approaches the modeled thresholds.

## Full-scope production remediation: critical account-creation defect found and fixed (2026-07-28)

A follow-on brief reported two "confirmed production failures": the audit engine's honest disabled
message, and "This passkey is not recognised" on sign-in. The first was verified against the live
Cloudflare Worker config and found to be the user's own just-made decision from the prior pass, not
a regression — not touched. The second was investigated properly rather than assumed, per
`CLAUDE.md`'s "reproduce before fixing" principle, and turned out to be real, but not an
authentication bug.

**Root cause, evidence-based**: direct D1 queries against production showed `users`,
`passkey_credentials`, and `sessions` all at 0 rows, with 11 real `auth_failure`/`unknown_credential`
security events — the correct response when no credential exists anywhere. Tracing why no account
had ever been created led to `register/finish.ts`'s `INSERT INTO users` failing on a real
`FOREIGN KEY` violation: `users.plan_id → plans.id`, and production's `plans` table (and
`admin_roles`) had never been seeded. Confirmed directly by running one real registration attempt
against `https://crawlpact.com` (Chromium + a CDP virtual authenticator), which returned a genuine
HTTP 500. **The core create-account journey had been completely broken in production since the
database was created on 2026-07-26** — nobody had ever been able to register a working account.

**Fixed**: inserted the real SRS §8 plan catalog (4 rows) and the real admin-role catalog (6 rows)
directly into production D1 — additive real reference data matching migration 0001 exactly, not
test/fake data, no schema change. Verified immediately with a full real register → sign-out →
sign-in round trip against production; all three throwaway verification accounts and their rows
were deleted afterward, restoring production to 0 real users. See
`docs/status/KNOWN_RISKS.md` for full detail, including the still-open, lower-urgency
`runtime_configuration` seeding gap.

**E2E stability**: a real GitHub Actions run (triggered by the user's push of the prior pass's fix)
surfaced a third instance of the same Vite SSR dependency-optimizer race — the previous fix's
route warmup only covered page GETs, never the auth API routes' own separate module graph
(`@simplewebauthn/server`). Fixed by extending `global-setup.ts` with serial POST warm-ups against
those routes. Committed and a fresh PR (#31) opened for real-CI re-verification; not yet confirmed
green at the time of writing.

**Other verification this pass**: Cloudflare (Worker bindings, D1/KV/custom-domain separation, DNS,
10 available Worker versions for rollback, no duplicate/orphaned CrawlPact workers — the
already-documented broken "Workers Builds" duplicate pipeline is unchanged) and Paddle (all 3
products/prices active and exactly matching the Worker's configured price IDs, webhook destination
correct and active) were both re-verified read-first via their respective MCPs, no changes needed.
A minor, non-security CSP gap was found live (Cloudflare's own Web Analytics beacon silently
blocked by `script-src`) and disclosed, not fixed unilaterally (a product decision).

## Production-stabilization pass: E2E root cause fixed, recovery-code e2e gap closed (2026-07-28)

Requested as a broad production-readiness sweep (CI, audit engine, auth, recovery codes,
accessibility, security). Investigation first (per `CLAUDE.md`'s "verify docs against
implementation" rule) found several of the brief's assumed symptoms didn't match current reality:
the "audit engine not enabled" state and the e2e instability were both already known and disclosed
in `docs/status/KNOWN_RISKS.md`, not silent gaps, and no open defect was logged against sign-in/
create-account. The user directed effort at: fixing the real e2e failures, re-verifying auth/
recovery-code/audit-engine state, deciding on `AUDIT_ENGINE_ENABLED`, and a blocker sweep.

**E2E root-caused for the first time** (previously only "not runner speed" was ruled out, per
`docs/status/KNOWN_RISKS.md`'s 2026-07-27 entry) by reproducing the exact CI failure pattern
locally — mirroring CI's steps (`astro dev` backgrounded, `CI=1`, `wait-on`, full parallel
`pnpm test:e2e`) rather than guessing. Two distinct, confirmed causes, both fixed:

1. **A Vite SSR dependency-optimizer race.** Astro's dev server lazily pre-bundles each SSR-side
   dependency (`@paddle/paddle-js`, `@simplewebauthn/browser`) on first request; Playwright's real
   parallel workers hitting different never-before-seen routes concurrently raced that
   pre-bundling, corrupting in-flight requests with Vite's dependency-optimizer error and a
   blocking error overlay. Fixed with `apps/web/tests/e2e/global-setup.ts`, which serially warms
   every route (sitemap-driven, plus the non-indexed dependency-heavy ones) before any parallel
   worker starts.
2. **Shared per-IP rate-limit counters.** The anonymous-audit and recovery-code-redemption rate
   limits (real, correctly-working abuse protection) are shared per-IP `security_events` counters
   — repeated e2e runs from the same machine/CI-runner IP eventually trip the real lockout. Fixed
   with `clearAnonymousAuditRateLimit()`/`clearRecoveryCodeRateLimit()` test-setup helpers.

Verified stable: the full suite (34 tests, 2 browser projects) passed 3 consecutive local runs
after each fix (6 consecutive clean runs total), with one single pre-existing, already-documented
`SQLITE_BUSY` flake self-recovering via the existing retry wrapper exactly as designed. **Not yet
verified inside real GitHub Actions** — that needs an actual push, which needs separate explicit
authorization (this repo's own `settings.json` hard-denies `git push`/`wrangler deploy` by design).

**Recovery-code sign-in e2e gap found and closed**: real API-level integration coverage already
existed (`auth-flow.integration.test.ts`), but no browser test ever exercised the actual "Recovery
code" tab/form/redeem/reuse-rejection journey. Added to `auth-and-account.spec.ts`.

**`AUDIT_ENGINE_ENABLED` re-confirmed, not silently left stale**: live-checked via the Cloudflare
API that `crawlpact.com` is still on the Free Workers plan and both D1 databases are still
near-empty — the documented CPU-budget risk is current, not a stale claim. Presented to the user
as an explicit decision rather than flipped unilaterally; **decision: keep disabled for now**. See
`docs/status/KNOWN_RISKS.md` for detail.

**Superseded the same day**: see "Production audit engine enabled, real crawler registry seeded"
at the top of this document — the user's own subsequent, explicit instruction overrode this
decision later on 2026-07-28. Kept here unedited for an accurate record of the reasoning at the
time; do not treat this paragraph as the current state.

Full local quality gate re-run and passed after all changes: format, lint, typecheck (0 errors),
unit (202/202), integration (137/137), `db:validate` (38 tables), build.

## Paddle fulfillment/webhook live-delivery verification (2026-07-28)

Paddle onboarding item 03 ("Handle fulfillment and provisioning — listen to notifications from
Paddle in your app"). The webhook-receiving implementation (`webhook-processor.ts`,
`paddle-webhook.ts`, `/api/billing/webhook`, the admin webhooks dashboard) already existed and was
already covered by 10/10 self-generated-HMAC integration test scenarios; what was missing was any
proof it worked against genuinely Paddle-signed traffic, not just local fixtures — production's
`webhook_events` table was confirmed empty (zero rows) immediately before this pass.

With the user's explicit, separately-confirmed authorization: the existing production notification
destination's `traffic_source` was temporarily changed from `platform` to `all` (required for
Paddle's webhook simulator to reach it at all), a `subscription_creation` scenario simulation was
run against it, and 8 of the resulting real, `Paddle-Signature`-signed events were confirmed
correctly delivered, verified, parsed, dispatched, and audit-logged in production — all `200`
responses in the exact JSON shape the handler produces, and one intentionally-unsubscribed event
type (`payment_method.saved`) correctly never delivered at all. `traffic_source` was reverted to
`platform` immediately after. Per a second explicit user decision, the 11 synthetic
`webhook_events` rows this test created were then deleted from production D1 so the real webhook
audit log stays free of test noise — the evidence lives in
`docs/status/PADDLE_WEBHOOK_LIVE_DELIVERY_VERIFICATION.md` instead. No product, price, token,
checkout domain, customer, subscription, transaction, or charge was created or touched; no secret
was rotated. Zero application code changes were needed — the existing implementation was already
correct; this pass only proved it.

A secondary, disclosed finding: reading the notification setting via the Paddle MCP (`get`/`update`)
returns `endpoint_secret_key` in plaintext unrequested, confirming this is Paddle's standard
response shape for that endpoint (not a one-off), consistent with the same behavior the
2026-07-27 pass first flagged in `docs/status/KNOWN_RISKS.md`. Per explicit user decision, the
webhook secret was **not** rotated this pass — that risk entry remains open.

See `docs/status/PADDLE_WEBHOOK_LIVE_DELIVERY_VERIFICATION.md` for the full report,
`docs/deployment/PADDLE_LIVE_GO_LIVE_CHECKLIST.md` and `docs/status/KNOWN_RISKS.md` for the updated
checklist/risk entries, and `docs/security/BILLING_SECURITY.md` for the updated security posture.
No code changes were made this pass beyond docstring corrections in `webhook-processor.ts` and
`paddle-webhook.ts` reflecting the new verified status — `pnpm quality` was not re-run since no
functional code changed.

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
- ~~`status.astro`'s "Paddle billing: Available" label is hardcoded rather than checking real
  secret presence~~ **Resolved 2026-07-26**: `getAdminEnvironment()` now exposes
  `paddleBillingConfigured` via `isPaddleBillingConfigured()`, which checks
  `PADDLE_API_KEY`/`PADDLE_WEBHOOK_SECRET`/price IDs/`PUBLIC_PADDLE_CLIENT_TOKEN` are all present
  and not `.env.example` placeholder values; `/status` now shows "Not configured in this
  environment" when they aren't.
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

| Check                  | Command                 | Result                                                             |
| ---------------------- | ----------------------- | ------------------------------------------------------------------ |
| Format                 | `pnpm format:check`     | ✅ Pass (15 doc files needed `pnpm format`, then re-checked clean) |
| Lint                   | `pnpm lint`             | ✅ Pass — 0 errors                                                 |
| Typecheck              | `pnpm typecheck`        | ✅ Pass — 293 files, 0 errors, 0 warnings, 31 informational hints  |
| Unit tests             | `pnpm test:unit`        | ✅ Pass — 189/189, 18 files                                        |
| Integration tests      | `pnpm test:integration` | ✅ Pass — 137/137, 22 files, against real D1                       |
| Migration/schema drift | `pnpm db:validate`      | ✅ Pass — 38 tables verified consistent                            |
| Build                  | `pnpm build`            | ✅ Pass                                                            |

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
`agency-features.integration.test.ts` (5 tests), `admin-shared-reports-revoke.integration.test.ts`.

**2026-07-30**: the agency-branding logo field was changed from a customer-typed external URL to
a real image upload, stored in R2 (`AGENCY_LOGOS` bucket) — see
`docs/data/D1_R2_DATA_PLACEMENT_POLICY.md`'s 2026-07-30 entry, which formally reopened and
resolved the "R2 not adopted" decision for this one use case. Content is sniffed from real magic
bytes (`apps/web/src/lib/agency-logo.ts`), never a client-supplied `Content-Type`/filename; SVG is
rejected outright (XSS risk). `POST /api/admin/shared-reports/:shareId/revoke` deletes the R2
object after the D1 revoke commits (`docs/data/DATA_RETENTION.md`'s "Object storage cleanup"
section). Disclosed, not-yet-built gap: bulk revocation and account/domain-deletion purge don't
clean up orphaned logo objects yet — see `docs/status/KNOWN_RISKS.md`.

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

## Historical: decisions once required before production deployment — now resolved

The four items below (repository had no commits, Cloudflare account/D1 didn't exist, Paddle
account didn't exist, no CI/CD pipeline existed) were all true as of Part 3 completion and are all
resolved as of this pass. Kept here as a historical record, not a current blocker list.

1. ~~This repository has zero git commits.~~ **Resolved** — real Git history exists (`main`,
   currently 8+ commits at the 2026-07-27 pass, `git log` is authoritative for the exact count).
2. ~~Cloudflare account / D1 databases are placeholders.~~ **Resolved 2026-07-26** — real
   production and preview D1 databases exist, migrated, and bound.
3. ~~Paddle sandbox account needed.~~ **Resolved 2026-07-26** — a live Paddle account (Solo/Pro/
   Agency products, client token, webhook destination) is connected; see
   `docs/status/KNOWN_RISKS.md` for what real-webhook-lifecycle verification is still outstanding.
4. **Visual-regression CI wiring**: still open — unchanged from Part 2's ask, see
   `docs/status/KNOWN_RISKS.md`.
5. **Professional UI/UX review** (SRS §36 item 45): still a human-judgement task this agent
   cannot self-certify — still flagged for the user.

## Current real open items

See `docs/status/KNOWN_RISKS.md` for the full, current list. In short: the audit engine is now
**enabled** in production (`AUDIT_ENGINE_ENABLED=true`, see "Production audit engine enabled" at
the top of this document) — this paragraph previously said otherwise and was corrected
2026-07-28; a real Paddle webhook simulation has been delivered and correctly processed
end-to-end in production (`docs/status/PADDLE_WEBHOOK_LIVE_DELIVERY_VERIFICATION.md`), though a
real _paid_ checkout lifecycle (actual payment, plan grant) has still not been run and needs
separate explicit authorization; GitHub branch protection and Environment required-reviewer
approval are unavailable on this repository's current plan; visual-regression tests are not yet
CI-wired; the cron trigger is not yet covered by the new binding-drift check.

---

## Historical quality gate results (Part 3 completion, run 2026-07-24 — superseded, see current results in docs/release/RELEASE_CHECKLIST.md)

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
