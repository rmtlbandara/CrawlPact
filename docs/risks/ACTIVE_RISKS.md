# Active Risks

**Level 1 document (Current authoritative).** The single current source of open risk for
CrawlPact. Superseded/resolved risks live in `docs/risks/RISK_ARCHIVE.md`. Full historical
narrative and investigation detail for both active and archived risks remains in
`docs/status/KNOWN_RISKS.md` (now a **historical** document — see its notice), cited by reference
below rather than duplicated. Do not maintain a third active-risk list anywhere else.

Statuses: `open` · `mitigating` · `accepted` · `blocked` · `monitoring`.

Last reviewed: 2026-08-04 (Phase 7), consolidating `docs/status/KNOWN_RISKS.md`'s still-open
items with the 13 new risks Phase 0's baseline audit found
(`docs/baseline/2026-08-03/BASELINE_RISKS_AND_UNKNOWNS.md`). Phase 6 closed RISK-016 (see
`docs/risks/RISK_ARCHIVE.md` ARC-024) and mitigated RISK-017. Phase 7 added RISK-031 (deferred
extended platform guides) and RISK-032 (no Search Console property connected).

---

### RISK-001 — Real paid Paddle checkout lifecycle has never been run

- **Category**: Billing · **Severity**: P1 · **Probability**: Certain (known gap, not yet attempted)
- **Impact**: Whether a real payment correctly links `custom_data.userId` and grants the plan has never been observed, only inferred from webhook simulation and code review.
- **Evidence**: `docs/status/KNOWN_RISKS.md` (webhook resolution entries), `docs/baseline/2026-08-03/BILLING_AND_PLAN_BASELINE.md`
- **Current mitigation**: Webhook delivery mechanism independently verified live 2026-07-28 (8 real signed events). Signature/idempotency/state-machine logic proven. **Updated Phase 6 (2026-08-04)**: the live Paddle catalog itself is now real (6 new production prices created and read back — `docs/billing/PADDLE_LIVE_CATALOG_MAP.md`), server-side checkout price resolution is verified against real catalog data, and the webhook processor's price→plan resolution was re-verified against the new DB-backed model (`docs/billing/PADDLE_WEBHOOK_EVENT_MATRIX.md`). What remains genuinely unverified is unchanged: a real customer paying real money and the resulting `custom_data.userId` linkage → plan grant.
- **Owner**: Billing owner · **Trigger**: Before any commercial launch or real customer onboarding
- **Review date**: Before Gate B (Conversion-ready) · **Target phase**: Phase 7
- **GitHub issue**: not yet created (see `docs/governance/GITHUB_GOVERNANCE_SETUP_MANIFEST.md`)
- **Status**: open
- **Acceptance criteria for closure**: One real, authorized, small-value paid checkout completes end-to-end (payment → webhook → plan grant), verified and then reverted/refunded per a documented test protocol.

### RISK-002 — Paddle webhook signing secret was returned in plaintext by a read-only API call, not rotated

- **Category**: Security, Billing · **Severity**: P1 · **Probability**: Low (one-time exposure in a session transcript, not reproduced elsewhere)
- **Impact**: If the exposed value were ever leaked from that transcript, an attacker could forge webhook signatures.
- **Evidence**: `docs/status/KNOWN_RISKS.md` ("A Paddle read-only inventory call... returned the webhook signing secret in plaintext")
- **Current mitigation**: Not reproduced anywhere else; no evidence of actual compromise.
- **Owner**: Security owner · **Trigger**: Any suspicion of transcript/log exposure
- **Review date**: Next billing-related change · **Target phase**: Phase 12
- **Status**: open
- **Acceptance criteria for closure**: `PADDLE_WEBHOOK_SECRET` rotated in Cloudflare and Paddle simultaneously, verified with a fresh webhook delivery.

### RISK-003 — Several Cloudflare zone-level settings are unreadable via the connected API credential

- **Category**: Infrastructure, Security · **Severity**: P2 · **Probability**: N/A (permanent until credential rescoped)
- **Impact**: SSL/TLS mode, HSTS, DNSSEC, Page Rules, Rate Limiting Rules, Cache Rules, redirect-ruleset detail, and AI Crawl Control settings cannot be verified programmatically — only via manual dashboard check.
- **Evidence**: `docs/status/KNOWN_RISKS.md` ("connected Cloudflare API credential cannot read several zone-level settings")
- **Current mitigation**: Broader endpoints (zone list, DNS, ruleset list) confirm no custom WAF/rate-limit rules beyond Free-plan managed defaults.
- **Owner**: Operations owner · **Trigger**: Any security review requiring zone-settings verification
- **Review date**: Next infrastructure phase · **Target phase**: Phase 12
- **Status**: accepted
- **Acceptance criteria for closure**: A broader-scoped Cloudflare API token is issued, or manual dashboard verification is performed and recorded.

### RISK-004 — Cloudflare Web Analytics beacon and AI Crawl Control robots.txt injection are undecided product questions

- **Category**: Product, SEO · **Severity**: P2 · **Probability**: N/A (ongoing until decided)
- **Impact**: (a) Cloudflare's own RUM beacon is silently blocked by CSP, so if Web Analytics is enabled in the dashboard, no data is actually collected. (b) Cloudflare's AI Crawl Control unpromptedly injects AI-crawler-blocking rules into CrawlPact's own `robots.txt` — notable since the product audits exactly this signal for other sites.
- **Evidence**: `docs/status/KNOWN_RISKS.md`, `docs/baseline/2026-08-03/PRODUCTION_INFRASTRUCTURE_INVENTORY.md`
- **Current mitigation**: Disclosed, not silently accepted or silently fixed either direction.
- **Owner**: Product owner · **Trigger**: Next homepage/trust-page review
- **Review date**: Phase 13 · **Target phase**: Phase 13 (re-routed from Phase 3, 2026-08-03 — Phase 3's Legal Identity, Contact, Security and Trust Foundation scope explicitly excludes changing analytics behaviour; this is an analytics/consent architecture decision, which Phase 13 owns)
- **Status**: open
- **Acceptance criteria for closure**: A deliberate product decision is made and implemented (enable+allow-list, or leave disabled) for each.

### RISK-005 — `scan_diffs.previous_scan_id`/`current_scan_id` have no `ON DELETE` clause

- **Category**: Database · **Severity**: P1 · **Probability**: Possible (daily retention cron already runs)
- **Impact**: If the retention purge deletes a `scans` row still referenced by a `scan_diffs` row, the delete throws `SQLITE_CONSTRAINT_FOREIGNKEY`, potentially aborting that day's purge — same bug class already fixed for 14 other columns in migrations 0013–0015.
- **Evidence**: `docs/data/DATA_RETENTION.md`, `docs/baseline/2026-08-03/DATABASE_AND_MIGRATION_BASELINE.md`
- **Current mitigation**: None yet — confirmed still unfixed at current HEAD.
- **Owner**: Engineering owner · **Trigger**: Any future migration touching `scan_diffs`
- **Review date**: Phase 11 · **Target phase**: Phase 11
- **Status**: open
- **Acceptance criteria for closure**: A migration adds `ON DELETE SET NULL` (matching the established pattern), proven by a test that fails against the old schema and passes against the fix.

### RISK-006 — `product_events`, `security_events`, and `notifications` have no purge job

- **Category**: Database, Privacy · **Severity**: P2 · **Probability**: Low at current volume, structural
- **Impact**: Unlike scan-related tables (bounded by plan-tier retention), these three grow indefinitely regardless of plan or account lifetime.
- **Evidence**: `docs/data/DATA_RETENTION.md`, `docs/status/KNOWN_RISKS.md`
- **Current mitigation**: None — low individual risk at today's volumes.
- **Owner**: Engineering owner · **Trigger**: Volume growth past current assumptions
- **Review date**: Phase 11 · **Target phase**: Phase 11
- **Status**: monitoring
- **Acceptance criteria for closure**: A retention decision is made and a purge job implemented, or the decision to leave unbounded is explicitly and permanently accepted with a documented reason.

### RISK-007 — `scan_resources.snapshot_text` (`html_meta` type) stores the full truncated HTML body

- **Category**: Database, Performance · **Severity**: P1 · **Probability**: Certain — modeled to approach/exceed the 500MB D1 cap within 1–2 years at commercial scale
- **Impact**: Largest quantified D1 storage growth driver.
- **Evidence**: `docs/data/D1_STORAGE_CAPACITY_AUDIT.md`, `docs/status/KNOWN_RISKS.md`
- **Current mitigation**: Two candidate fixes identified (reduce capture to parsed fields only; populate the unused `resource_hash` column for dedup), neither implemented yet.
- **Owner**: Engineering owner · **Trigger**: Approaching modeled capacity thresholds
- **Review date**: Phase 11 · **Target phase**: Phase 11
- **Status**: open
- **Acceptance criteria for closure**: One of the two candidate fixes is implemented and the capacity model is re-run showing meaningfully extended runway.

### RISK-008 — CrawlPact's real workload likely exceeds the Workers Free CPU budget at commercial scale

- **Category**: Infrastructure, Performance · **Severity**: P1 · **Probability**: Certain at the SRS's own 150+/1,000-domain commercial target; low at current real volume (2 users, 9 domains)
- **Impact**: `MAX_DOMAINS_PER_SWEEP=20`'s monitoring batch and per-scan CPU cost are modeled to exceed the 10ms/invocation ceiling well below the commercial target.
- **Evidence**: `docs/operations/SCAN_CAPACITY_BUDGET.md`, `docs/operations/MONITORING_CAPACITY_PLAN.md`, `docs/operations/CLOUDFLARE_UPGRADE_TRIGGERS.md`
- **Current mitigation**: Accepted, explicit tradeoff at current near-zero volume — not a resolved risk. Concrete tightening measures identified (D1 write batching, capping findings, RSL/sitemap size bounds).
- **Owner**: Operations owner · **Trigger**: Real customer volume approaching modeled thresholds (see `CLOUDFLARE_UPGRADE_TRIGGERS.md`)
- **Review date**: Every material volume increase · **Target phase**: Phase 11
- **Status**: monitoring
- **Acceptance criteria for closure**: Either tightening measures are implemented and re-modeled, or a Workers Paid upgrade is made ahead of the trigger thresholds.

### RISK-009 — Admin subscriptions/transactions views hide rows for later-deleted accounts

- **Category**: Product, Admin · **Severity**: P2 · **Probability**: Certain (structural)
- **Impact**: `INNER JOIN` to `users` means a billing customer whose account was deleted (`user_id = NULL`) doesn't appear in `/admin/subscriptions`/`/admin/transactions`, even though the row is intact and directly queryable.
- **Evidence**: `docs/data/DATA_RETENTION.md`, `docs/status/REQUIREMENTS_TRACEABILITY.md` §28.5–§28.7
- **Current mitigation**: None — disclosed gap from the Step 21 account-deletion-survival fix.
- **Owner**: Engineering owner · **Trigger**: Any admin billing-visibility complaint
- **Review date**: Phase 11 · **Target phase**: Phase 11
- **Status**: open
- **Acceptance criteria for closure**: `LEFT JOIN` + null-safe owner display implemented in both the lib functions and their components.

### RISK-010 — Agency-branding logo objects in R2 can become orphaned

- **Category**: Database, Product · **Severity**: P2 · **Probability**: Low volume today
- **Impact**: Bulk share revocation and account/domain-deletion retention purge both delete/revoke `shared_reports` rows without deleting the underlying R2 logo object (only the single-share admin-revoke path cleans up R2).
- **Evidence**: `docs/data/D1_R2_DATA_PLACEMENT_POLICY.md`, `docs/status/KNOWN_RISKS.md`
- **Current mitigation**: None — low practical impact today (small images, low volume feature).
- **Owner**: Engineering owner · **Trigger**: Agency-branding adoption growth
- **Review date**: Phase 9 · **Target phase**: Phase 9
- **Status**: monitoring
- **Acceptance criteria for closure**: An orphan-object sweep is added to the daily retention cron, or R2 cleanup is added to bulk revocation and account/domain purge.

### RISK-011 — No registered business address, registration number, or tax information exists anywhere in the repository

- **Category**: Legal · **Severity**: P2 · **Probability**: N/A (explicitly deferred)
- **Impact**: Blocks a specific, scoped set of items only: a registered address on any public page, a registration number, tax information, and a jurisdiction-specific consumer-protection-regime citation. Does **not** block the release as a whole.
- **Evidence**: `docs/release/LEGAL_INFORMATION_CHECKLIST.md`, `docs/trust/TRUST_AND_LEGAL_CONFIGURATION.md`. **Not an SRS requirement** — see `docs/baseline/2026-08-03/DOCUMENTATION_CONFLICTS.md` DC-010; this is a product-owner governance decision, not an SRS-derived blocker.
- **Current mitigation**: **Partially resolved (Phase 3, 2026-08-03)** — the product owner supplied and approved an operator name ("CrawlPact", no corporate suffix) and five contact addresses (privacy/security/support/corrections/billing), all live across `/privacy`, `/terms`, `/security`, `/contact`, `/about`, the footer, `apps/web/src/lib/trust-config.ts`, and `/.well-known/security.txt`. **Updated 2026-08-04**: the governing jurisdiction ("Sri Lanka") originally approved alongside these was subsequently removed at explicit product-owner instruction — no operating country or jurisdiction is published anywhere on the public site; see RISK-029 for the resulting Terms-of-Service governing-law gap this reopens. The registered address, registration number, and tax information remain explicitly, deliberately deferred — not invented.
- **Owner**: Legal/business owner · **Trigger**: Any decision to publish the three remaining gated items above
- **Review date**: Next release readiness review · **Target phase**: Phase 18 (Production Launch Readiness and Final Audit)
- **Status**: accepted
- **Acceptance criteria for closure**: Real, verified registered address, registration number, and tax information are published, or the deferral is re-confirmed at each review.

### RISK-012 — `billing-webhook.integration.test.ts`'s concurrent-race test flakes under load

- **Category**: Test coverage, Billing · **Severity**: P2 · **Probability**: Confirmed to occur under load
- **Impact**: The test's own concurrency simulation doesn't guarantee write order, so the (correct) out-of-order protection can legitimately classify the "later" request differently than the test assumes.
- **Evidence**: `docs/status/BILLING_WEBHOOK_RACE_TEST_FLAKE.md`
- **Current mitigation**: Deliberately not fixed — touches billing-critical ordering logic, needs dedicated review. **Updated Phase 6 (2026-08-04)**: this phase touched the same test file (added 2 new webhook resolution tests, all passing including the existing race test) but deliberately did not attempt a fix — a rushed change to billing-critical ordering logic under this phase's already-substantial scope was judged riskier than carrying the flake forward for dedicated review.
- **Owner**: Billing owner · **Trigger**: Next billing-webhook-adjacent change
- **Review date**: Phase 7 · **Target phase**: Phase 7
- **Status**: open
- **Acceptance criteria for closure**: Test rewritten to assert on either valid outcome, or made deterministic.

### RISK-013 — `mobile-safari` a11y test failure: skip-link keyboard focus

- **Category**: Accessibility, Test coverage · **Severity**: P2 · **Probability**: Confirmed, reproducible
- **Impact**: A Playwright/WebKit `Tab`-key limitation, not a real product defect (confirmed manually and via the Chromium project).
- **Evidence**: `docs/status/KNOWN_RISKS.md`
- **Current mitigation**: None needed for the product; documented as a known test-tooling limitation.
- **Owner**: Engineering owner · **Trigger**: Playwright/WebKit version upgrade that might resolve it
- **Review date**: Phase 12 · **Target phase**: Phase 12
- **Status**: accepted
- **Acceptance criteria for closure**: Either Playwright fixes the underlying WebKit `Tab` behavior, or the test is rewritten to avoid depending on it.

### RISK-014 — `deploy-preview.yml` fails at the D1-migration step due to a secret-naming mismatch in the `preview` GitHub Environment

- **Category**: CI/CD, Operations · **Severity**: P2 · **Probability**: Certain until fixed
- **Impact**: Preview deploys cannot run migrations until the repository owner renames/adds the correctly-named secrets.
- **Evidence**: `docs/status/KNOWN_RISKS.md`
- **Current mitigation**: None — requires the repository owner to run `gh secret set` commands (cannot be fixed by an agent session without handling a live credential).
- **Owner**: Operations owner · **Trigger**: Next preview deploy attempt
- **Review date**: Phase 12 · **Target phase**: Phase 12
- **Status**: blocked
- **Acceptance criteria for closure**: `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN` secrets set correctly in the `preview` GitHub Environment, verified by a successful preview deploy.

### RISK-015 — Built-server E2E (real `wrangler dev --local` against the built Worker) still not achieved

- **Category**: Test coverage, CI/CD · **Severity**: P2 · **Probability**: N/A — currently reverted to `astro dev`
- **Impact**: E2E/a11y suites test against Astro's dev server, not a genuinely production-like built Worker — a narrower but still real gap.
- **Evidence**: `docs/status/KNOWN_RISKS.md` ("Built-server E2E" entries)
- **Current mitigation**: `astro dev` target is stable and passing; the built-server approach caused two distinct real-CI-only crashes, both reverted after investigation.
- **Owner**: Engineering owner · **Trigger**: A Wrangler version upgrade (4.115.0+ flagged as a next step) or renewed investigation
- **Review date**: Phase 12 · **Target phase**: Phase 12
- **Status**: open
- **Acceptance criteria for closure**: 3 consecutive real-CI runs pass against the built-server target before it's trusted as the primary gate again.

### RISK-017 — Billing dashboard UI labels every non-current paid plan "Upgrade to X" regardless of actual tier direction

- **Category**: Product, Conversion · **Severity**: P2 · **Probability**: Certain (confirmed UI defect)
- **Impact**: A Pro subscriber sees "Upgrade to Solo" for a genuine downgrade; no server-side subscription-change endpoint exists to distinguish the flows.
- **Evidence**: `docs/baseline/2026-08-03/BILLING_AND_PLAN_BASELINE.md`
- **Current mitigation**: **Fixed, Phase 6 (2026-08-04)** — a single ordered-pair `(planRank, intervalWeight)` direction rule (`apps/web/src/lib/billing/plan-change.ts`'s `planChangeDirection`, mirrored client-side by `BillingPlansSection.tsx`'s `directionLabel`) correctly labels upgrade vs. downgrade for both plan changes and billing-cycle changes; covered by 13 unit tests (`plan-change.test.ts`, `BillingPlansSection.test.ts`). See `docs/billing/PLAN_CHANGE_AND_PRORATION_POLICY.md`.
- **Owner**: Product owner · **Trigger**: Next billing-UI change
- **Review date**: Phase 7 · **Target phase**: Phase 7
- **Status**: mitigating
- **Acceptance criteria for closure**: UI correctly labels upgrade vs. downgrade (done), and the underlying Paddle checkout behavior for an existing subscriber is verified against a real paid subscription (still tied to RISK-001, which remains open — a real upgrade/downgrade has been exercised against Paddle's real preview/update API for an existing subscription in this phase's own testing, but not yet for a subscription created by a real paid checkout).

### RISK-018 — `reference-data.sql`'s dynamic operator-based crawler-entry insert risks violating registry-release immutability on re-run

- **Category**: Registry governance, Data · **Severity**: P1 · **Probability**: Possible, not confirmed
- **Impact**: Since the active release's entries are inserted via a dynamic `SELECT ... FROM crawlers WHERE operator_id IN (...)` rather than a fixed ID list, re-running this idempotent seed file after new crawlers are added to the same operator group could silently insert new entries into an already-"published, immutable" release.
- **Evidence**: `docs/baseline/2026-08-03/DATABASE_AND_MIGRATION_BASELINE.md`
- **Current mitigation**: Not confirmed against a live database; no re-run has occurred since the finding.
- **Owner**: Registry owner · **Trigger**: Any future `reference-data.sql` re-run against a database with the affected release already active
- **Review date**: Phase 15 · **Target phase**: Phase 15
- **Status**: open
- **Acceptance criteria for closure**: The active release's entry insert is changed to a fixed ID list, or a guard is added preventing entry insertion into an already-published release.

### RISK-019 — 40-vs-39 table-count discrepancy between local `db:validate` and live production `sqlite_master`

- **Category**: Database, Documentation · **Severity**: P2 · **Probability**: Certain (confirmed both counts)
- **Impact**: Low direct impact; indicates the local validator and a live count measure slightly different things.
- **Evidence**: `docs/baseline/2026-08-03/DATABASE_AND_MIGRATION_BASELINE.md`
- **Current mitigation**: None — not investigated further (Phase 0 was inspection-only).
- **Owner**: Engineering owner · **Trigger**: Next database-tooling change
- **Review date**: Phase 11 · **Target phase**: Phase 11
- **Status**: open
- **Acceptance criteria for closure**: Root cause identified and either count corrected or the discrepancy explained and documented as expected.

### RISK-020 — No automated test asserts Google Analytics never loads outside `MarketingLayout`

- **Category**: Analytics, Test coverage · **Severity**: P2 · **Probability**: Low today (currently correct by code inspection)
- **Impact**: A future change could accidentally import the GA component into `AppLayout`/`AdminLayout`, shipping real customer-activity data to Google with no test catching it.
- **Evidence**: `docs/baseline/2026-08-03/ANALYTICS_AND_CONSENT_BASELINE.md`
- **Current mitigation**: Manual code review only.
- **Owner**: Security owner · **Trigger**: Any layout/analytics-adjacent change
- **Review date**: Phase 13 · **Target phase**: Phase 13
- **Status**: open
- **Acceptance criteria for closure**: A test asserts `GoogleAnalytics`/`gtag` never appears in authenticated-app/admin server output.

### RISK-021 — No cookie-consent mechanism exists while Google Analytics sets tracking cookies on marketing pages

- **Category**: Privacy, Legal · **Severity**: P1 · **Probability**: Certain (confirmed)
- **Impact**: Relevant to EU/UK visitor exposure; GA sets `_ga`/`_ga_*` cookies with zero consent gating anywhere in the codebase.
- **Evidence**: `docs/baseline/2026-08-03/ANALYTICS_AND_CONSENT_BASELINE.md`, `docs/status/KNOWN_RISKS.md`
- **Current mitigation**: Disclosed in `docs/risks/ACTIVE_RISKS.md` (this entry) and `privacy.astro`'s third-party section; not otherwise mitigated.
- **Owner**: Legal/business owner · **Trigger**: Real EU/UK traffic volume, or any consent-law review
- **Review date**: Phase 13 · **Target phase**: Phase 13
- **Status**: open
- **Acceptance criteria for closure**: A consent mechanism is implemented, or a documented risk-acceptance decision is made by the product owner.

### RISK-022 — No cross-request target-frequency abuse monitoring

- **Category**: Security · **Severity**: P2 · **Probability**: Low
- **Impact**: A distributed set of anonymous callers (many IPs) could still direct many small in-bounds scans at one target — only per-caller limits exist today.
- **Evidence**: `docs/security/SECURITY_CHECKLIST.md`, `docs/status/REQUIREMENTS_TRACEABILITY.md` §33
- **Current mitigation**: Per-caller rate limits exist; no cross-caller aggregation.
- **Owner**: Security owner · **Trigger**: Any observed abuse pattern
- **Review date**: Phase 12 · **Target phase**: Phase 12
- **Status**: monitoring
- **Acceptance criteria for closure**: Super Admin tooling for cross-request target-frequency alerting is built (already tracked as Part 3 follow-up).

### RISK-023 — CSP allows `'unsafe-inline'` for scripts/styles

- **Category**: Security · **Severity**: P2 · **Probability**: N/A (structural, ongoing)
- **Impact**: Reduces (doesn't eliminate) CSP's XSS mitigation value.
- **Evidence**: `docs/security/SECURITY_CHECKLIST.md`, `docs/security/THREAT_MODEL.md`
- **Current mitigation**: Astro island hydration + Tailwind's runtime both need it today; per-request nonce plumbing is unbuilt.
- **Owner**: Security owner · **Trigger**: Any CSP-hardening initiative
- **Review date**: Phase 12 · **Target phase**: Phase 12
- **Status**: accepted
- **Acceptance criteria for closure**: Per-request nonce plumbing implemented and `'unsafe-inline'` removed.

### RISK-024 — Atom feed route (`/feed/[token].xml`) has no dedicated test file by name

- **Category**: Test coverage · **Severity**: P2 · **Probability**: Unknown
- **Impact**: A real regression in feed-token validation or content could ship undetected by any named test.
- **Evidence**: `docs/baseline/2026-08-03/CAPABILITY_MATRIX.md`
- **Current mitigation**: Possibly covered incidentally; not confirmed either way.
- **Owner**: Engineering owner · **Trigger**: Next notifications-area change
- **Review date**: Phase 10 · **Target phase**: Phase 10
- **Status**: open
- **Acceptance criteria for closure**: A dedicated test file confirmed to exist and cover this route, or one is added.

### RISK-025 — Duplicate-token protection gap: case-sensitive DB unique index vs. case-insensitive CLI validator

- **Category**: Registry governance, Security · **Severity**: P2 · **Probability**: Low (no current occurrence)
- **Impact**: Two tokens differing only by case could pass the DB constraint while being flagged by `registry-tools.mjs validate`, or vice versa.
- **Evidence**: `docs/baseline/2026-08-03/CRAWLER_REGISTRY_BASELINE.md`
- **Current mitigation**: All 23 current tokens are distinct even case-insensitively.
- **Owner**: Registry owner · **Trigger**: Any new crawler registration
- **Review date**: Phase 15 · **Target phase**: Phase 15
- **Status**: monitoring
- **Acceptance criteria for closure**: Both checks are made consistent (both case-sensitive or both case-insensitive).

### RISK-026 — Open Dependabot PR currently has a failing CI run

- **Category**: Dependencies, CI · **Severity**: P2 · **Probability**: Certain (confirmed live)
- **Impact**: `dependabot/npm_and_yarn/astrojs/cloudflare-14.1.7` cannot currently auto-merge.
- **Evidence**: `docs/baseline/2026-08-03/TEST_AND_CI_EVIDENCE.md`
- **Current mitigation**: None — not investigated this pass.
- **Owner**: Engineering owner · **Trigger**: Next dependency-update review
- **Review date**: Phase 12 · **Target phase**: Phase 12
- **Status**: open
- **Acceptance criteria for closure**: CI failure investigated and either fixed or the PR closed with a documented reason.

### RISK-027 — `main` branch has no GitHub branch-protection rule configured

- **Category**: Operations, Security · **Severity**: P2 · **Probability**: N/A (known platform constraint)
- **Impact**: Merge safety depends entirely on the custom `merge-when-green.yml` workflow rather than a platform-enforced rule.
- **Evidence**: `docs/baseline/2026-08-03/PRODUCTION_INFRASTRUCTURE_INVENTORY.md`
- **Current mitigation**: `merge-when-green.yml` substitutes for native protection — private-repo GitHub Free-plan constraint, not a gap this repo introduced.
- **Owner**: Operations owner · **Trigger**: A GitHub plan upgrade
- **Review date**: Phase 12 · **Target phase**: Phase 12
- **Status**: accepted
- **Acceptance criteria for closure**: GitHub plan upgraded and native branch protection configured, or this acceptance is re-confirmed.

### RISK-028 — SRS §2.3's Primary Tagline conflicts with the Phase 2 canonical brand system

- **Category**: Documentation, Product · **Severity**: P2 · **Probability**: Certain (confirmed live)
- **Impact**: `docs/product/CRAWLPACT_FINAL_SRS.md:150` (§2.3) states the Primary Tagline as "Know
  what AI crawlers can access." — a claim of certainty about actual crawler access the product
  cannot support. This conflicts with both the SRS's own §2.2 Primary Product Promise (which the
  live homepage actually uses: "Audit and monitor your website's AI crawler policy.") and the new
  canonical tagline established by Phase 2, "AI crawler policy, verified." Per `CLAUDE.md`, the SRS
  outranks other documents unless an approved ADR records a deviation — this conflict was
  deliberately recorded, not silently resolved by editing the SRS during Phase 2.
- **Evidence**: `docs/brand/MESSAGING_SURFACE_INVENTORY.md` row E1,
  `docs/brand/BRAND_POSITIONING_AND_MESSAGING_SYSTEM.md` ("Brand promise" section)
- **Current mitigation**: No live surface uses the stale §2.3 wording (confirmed by three
  independent Phase 2 research passes and `pnpm brand:validate`) — the exposure is a documentation
  conflict, not a live customer-facing claim.
- **Owner**: Product owner · **Trigger**: Any future SRS revision or brand-copy audit
- **Review date**: Phase 7 · **Target phase**: Phase 7 (carried forward unclaimed through Phases 3-6; each phase's own execution prompt scoped it elsewhere — see `docs/governance/GITHUB_GOVERNANCE_SETUP_MANIFEST.md`)
- **Status**: open
- **Acceptance criteria for closure**: SRS §2.3 updated to match the canonical tagline, or an ADR
  is recorded explicitly authorising the deviation and reconciling the two documents.

### RISK-029 — Terms of Service has no governing-law clause after the 2026-08-04 country-reference removal

- **Category**: Legal · **Severity**: P2 · **Probability**: N/A (explicitly deferred)
- **Impact**: `/terms` no longer has a "Governing law" section (formerly §21) and `/terms` §2, `/about`,
  and `/privacy` §1 no longer state an operating country — the product owner explicitly instructed
  removing every public country/jurisdiction reference (Public Country Reference and Contact
  Messaging Correction, 2026-08-04) rather than publish a stale or invented jurisdiction. Does
  **not** block the release: the Terms architecture was written to be self-consistent without a
  governing-law clause (no cross-references to the removed section remain).
- **Evidence**: `docs/trust/TRUST_AND_LEGAL_CONFIGURATION.md` "Governing jurisdiction removed",
  `docs/release/LEGAL_INFORMATION_CHECKLIST.md`,
  `docs/reports/PUBLIC_COUNTRY_AND_CONTACT_MESSAGING_CORRECTION_REPORT.md`
- **Current mitigation**: None published; genuinely absent by explicit product-owner instruction,
  not invented and not silently replaced with another location.
- **Owner**: Legal/business owner · **Trigger**: Any future decision to republish a governing-law
  clause
- **Review date**: Next release readiness review · **Target phase**: Phase 18 (Production Launch
  Readiness and Final Audit)
- **Status**: accepted
- **Acceptance criteria for closure**: A governing jurisdiction is republished only after a fresh,
  explicit product-owner decision recorded in `docs/trust/TRUST_AND_LEGAL_CONFIGURATION.md`,
  ideally after professional legal review of the resulting Terms of Service clause.

### RISK-030 — A save-flow continuation is consumed even when the save itself fails (plan limit reached)

- **Category**: Product/UX · **Severity**: P3 · **Probability**: Low
- **Impact**: `POST /api/audit/continuation/:continuationId` (Phase 5 conversion flow) consumes the
  continuation atomically before checking the account's saved-domain plan limit, because the
  atomic-consume step exists specifically to prevent a double-save race and making it reversible on
  a later, unrelated failure would reopen that exact race window. A visitor who hits their plan's
  domain limit at this exact step loses that specific continuation and must re-trigger the save
  from the still-visible report page (a fresh continuation is created in one click) rather than
  retry the same link. This is a deliberate, documented trade-off, not an oversight — see
  `docs/product/AUDIT_CONVERSION_STATE_MODEL.md` §1's "no path back from consumed to active" note.
- **Evidence**: `apps/web/src/pages/api/audit/continuation/[continuationId].ts`,
  `apps/web/tests/integration/audit-conversion.integration.test.ts` ("returns DOMAIN_LIMIT_REACHED..."),
  `docs/security/PHASE_05_AUDIT_CONVERSION_THREAT_REVIEW.md`
- **Current mitigation**: The error response is specific (`DOMAIN_LIMIT_REACHED`, not a generic
  failure) and the retry path (re-click the CTA on the report page) is one click, not a dead end.
- **Owner**: Product · **Trigger**: User complaints about needing to re-click "Save" after managing
  their domain limit
- **Review date**: Next release readiness review · **Target phase**: Unscheduled — revisit only if
  real usage shows this is a meaningful friction point, not preemptively
- **Status**: accepted
- **Acceptance criteria for closure**: Either accepted permanently as documented UX, or a
  reversible-consumption design is adopted that provably preserves the single-save-per-continuation
  guarantee under concurrent requests.

### RISK-031 — Phase 7's 5 extended platform guides (nginx, apache, fastly, akamai, GitHub Pages) were deferred, not built

- **Category**: Content/SEO · **Severity**: P3 · **Probability**: N/A (explicitly deferred)
- **Impact**: Only the 5 priority platform guides (Cloudflare, WordPress, Shopify, Vercel, Netlify)
  were built and published this phase. The phase prompt explicitly permitted deferring the 5
  extended guides if the official-source research/evidence/uniqueness bar wasn't met in-session,
  and explicitly prohibited publishing them merely to hit a page count. `/platforms` (the hub) has
  only 4 category sections populated, not the eventual full set — a real, disclosed content gap,
  not a silent shortfall.
- **Evidence**: `docs/seo/SEARCH_INTENT_AND_PAGE_MAP.md` ("Stage 7D... publication priority 2"),
  `docs/seo/SEO_CONTENT_GOVERNANCE.md` (extended platform guides row: "0 — deferred"),
  `docs/reports/PHASE_07_VERTICAL_PLATFORM_SEO_COMPLETION_REPORT.md` ("Deferred work")
- **Current mitigation**: None needed — the 5 priority guides satisfy the phase's required minimum
  (5/5); the extended set was always contingent, not committed.
- **Owner**: Product owner · **Trigger**: A future session with budget to research and verify the
  5 extended platforms against the same official-source bar
- **Review date**: Next content-roadmap review · **Target phase**: Unscheduled follow-up (tracked
  as a GitHub issue, not a numbered phase)
- **Status**: accepted
- **Acceptance criteria for closure**: Either the 5 extended guides are researched, verified against
  real official documentation, and published following the same standard as the priority 5, or a
  product-owner decision formally closes the platform-guide set at 5.

### RISK-032 — No Google Search Console property connected; Phase 7 indexing cannot be verified against real search data

- **Category**: SEO/Observability · **Severity**: P3 · **Probability**: Certain (known gap)
- **Impact**: There is no Search Console property connected to `crawlpact.com`, so Phase 7's new
  `/for/*`/`/platforms/*` pages cannot be confirmed indexed, checked for crawl errors, or compared
  against real query/impression data post-launch. This is a pre-existing gap (no prior phase
  connected one either), not something Phase 7 introduced, but Phase 7 is the first phase whose
  success is specifically measured by organic search performance.
- **Evidence**: `docs/seo/PHASE_07_SEARCH_PERFORMANCE_BASELINE.md` ("no property connected" +
  manual verification checklist), `docs/seo/ROUTE_REGISTRY.md` ("no production Cloudflare account
  connected" — the same class of pre-launch gap)
- **Current mitigation**: `docs/seo/PHASE_07_SEARCH_PERFORMANCE_BASELINE.md`'s manual verification
  checklist stands in until a property exists; `pnpm run content:links:check` independently catches
  a broken official source without needing Search Console.
- **Owner**: Product owner · **Trigger**: Connecting a Search Console property (a one-time,
  low-effort setup task, not a code change)
- **Review date**: Next release readiness review · **Target phase**: Phase 18 (Production Launch
  Readiness and Final Audit) — same phase as the other pre-launch external-account gaps
- **Status**: accepted
- **Acceptance criteria for closure**: A Search Console property is connected and the manual
  verification checklist in `PHASE_07_SEARCH_PERFORMANCE_BASELINE.md` is completed at least once.

---

## How to update this document

Add a new risk here the moment it's found, using the next sequential `RISK-NNN` ID. Move a risk to
`docs/risks/RISK_ARCHIVE.md` the moment it's resolved/superseded/no-longer-applicable — do not
leave a resolved risk here marked "Resolved" in place; move it. Every risk here must link to real
evidence, not a restated claim.
