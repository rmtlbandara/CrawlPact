# Active Risks

**Level 1 document (Current authoritative).** The single current source of open risk for
CrawlPact. Superseded/resolved risks live in `docs/risks/RISK_ARCHIVE.md`. Full historical
narrative and investigation detail for both active and archived risks remains in
`docs/status/KNOWN_RISKS.md` (now a **historical** document — see its notice), cited by reference
below rather than duplicated. Do not maintain a third active-risk list anywhere else.

Statuses: `open` · `mitigating` · `accepted` · `blocked` · `monitoring`.

Last reviewed: 2026-08-03 (Phase 1), consolidating `docs/status/KNOWN_RISKS.md`'s still-open
items with the 13 new risks Phase 0's baseline audit found
(`docs/baseline/2026-08-03/BASELINE_RISKS_AND_UNKNOWNS.md`).

---

### RISK-001 — Real paid Paddle checkout lifecycle has never been run

- **Category**: Billing · **Severity**: P1 · **Probability**: Certain (known gap, not yet attempted)
- **Impact**: Whether a real payment correctly links `custom_data.userId` and grants the plan has never been observed, only inferred from webhook simulation and code review.
- **Evidence**: `docs/status/KNOWN_RISKS.md` (webhook resolution entries), `docs/baseline/2026-08-03/BILLING_AND_PLAN_BASELINE.md`
- **Current mitigation**: Webhook delivery mechanism independently verified live 2026-07-28 (8 real signed events). Signature/idempotency/state-machine logic proven.
- **Owner**: Billing owner · **Trigger**: Before any commercial launch or real customer onboarding
- **Review date**: Before Gate B (Conversion-ready) · **Target phase**: Phase 6
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
- **Review date**: Phase 3 · **Target phase**: Phase 3
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

### RISK-011 — No legal entity, registered address, jurisdiction, or verified contact exists anywhere in the repository

- **Category**: Legal · **Severity**: P2 · **Probability**: N/A (explicitly deferred)
- **Impact**: Blocks a specific, scoped set of items only: jurisdiction-specific terms clauses, a named privacy data controller, `/.well-known/security.txt`, a public content-correction channel. Does **not** block the release as a whole.
- **Evidence**: `docs/release/LEGAL_INFORMATION_CHECKLIST.md`, `docs/status/KNOWN_RISKS.md`. **Not an SRS requirement** — see `docs/baseline/2026-08-03/DOCUMENTATION_CONFLICTS.md` DC-010; this is a product-owner governance decision, not an SRS-derived blocker.
- **Current mitigation**: Explicitly, deliberately deferred by the product owner 2026-07-31.
- **Owner**: Legal/business owner · **Trigger**: Any decision to publish the specific gated items above
- **Review date**: Phase 3 · **Target phase**: Phase 3
- **Status**: accepted
- **Acceptance criteria for closure**: Real, verified business details are published, or the deferral is re-confirmed at each review.

### RISK-012 — `billing-webhook.integration.test.ts`'s concurrent-race test flakes under load

- **Category**: Test coverage, Billing · **Severity**: P2 · **Probability**: Confirmed to occur under load
- **Impact**: The test's own concurrency simulation doesn't guarantee write order, so the (correct) out-of-order protection can legitimately classify the "later" request differently than the test assumes.
- **Evidence**: `docs/status/BILLING_WEBHOOK_RACE_TEST_FLAKE.md`
- **Current mitigation**: Deliberately not fixed — touches billing-critical ordering logic, needs dedicated review.
- **Owner**: Billing owner · **Trigger**: Next billing-webhook-adjacent change
- **Review date**: Phase 6 · **Target phase**: Phase 6
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

### RISK-016 — `packages/core/src/api/contracts/billing.ts` describes a checkout API shape that was never built

- **Category**: Documentation, Product · **Severity**: P2 · **Probability**: Certain (confirmed dead code)
- **Impact**: Field names (`plan` vs. real `planId`) and response shape (`checkoutUrl` vs. real `{priceId,customData,clientToken,environment}`) both mismatch the real implementation; anyone treating this file as ground truth would be wrong on every field.
- **Evidence**: `docs/baseline/2026-08-03/BILLING_AND_PLAN_BASELINE.md`
- **Current mitigation**: None — confirmed zero references to its exported schemas anywhere outside the file itself.
- **Owner**: Engineering owner · **Trigger**: Any future billing-contract refactor
- **Review date**: Phase 6 · **Target phase**: Phase 6
- **Status**: open
- **Acceptance criteria for closure**: The file is removed (dead code) or rewritten to match the real implementation.

### RISK-017 — Billing dashboard UI labels every non-current paid plan "Upgrade to X" regardless of actual tier direction

- **Category**: Product, Conversion · **Severity**: P2 · **Probability**: Certain (confirmed UI defect)
- **Impact**: A Pro subscriber sees "Upgrade to Solo" for a genuine downgrade; no server-side subscription-change endpoint exists to distinguish the flows.
- **Evidence**: `docs/baseline/2026-08-03/BILLING_AND_PLAN_BASELINE.md`
- **Current mitigation**: None.
- **Owner**: Product owner · **Trigger**: Next billing-UI change
- **Review date**: Phase 6 · **Target phase**: Phase 6
- **Status**: open
- **Acceptance criteria for closure**: UI correctly labels upgrade vs. downgrade, and the underlying Paddle checkout behavior for an existing subscriber is verified (see RISK-001).

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

---

## How to update this document

Add a new risk here the moment it's found, using the next sequential `RISK-NNN` ID. Move a risk to
`docs/risks/RISK_ARCHIVE.md` the moment it's resolved/superseded/no-longer-applicable — do not
leave a resolved risk here marked "Resolved" in place; move it. Every risk here must link to real
evidence, not a restated claim.
