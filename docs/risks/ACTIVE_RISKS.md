# Active Risks

**Level 1 document (Current authoritative).** The single current source of open risk for
CrawlPact. Superseded/resolved risks live in `docs/risks/RISK_ARCHIVE.md`. Full historical
narrative and investigation detail for both active and archived risks remains in
`docs/status/KNOWN_RISKS.md` (now a **historical** document — see its notice), cited by reference
below rather than duplicated. Do not maintain a third active-risk list anywhere else.

Statuses: `open` · `mitigating` · `accepted` · `blocked` · `monitoring`.

Last reviewed: 2026-08-10 (Phase 13, Analytics, Consent, Product Measurement and Private-Repository
Exposure Governance). Phase 13 closed RISK-021 (see `docs/risks/RISK_ARCHIVE.md` ARC-031 — a real
consent mechanism now gates Google Analytics), closed RISK-004 (see ARC-030 — a deliberate product
decision to leave both Cloudflare Web Analytics and AI Crawl Control disabled/unchanged, documented
rather than silently accepted), and partially resolved RISK-006 (`product_events` now has a bounded
18-month purge job; `security_events`/`notifications` remain open), and closed RISK-020 (see
ARC-032 — `ga-boundary.test.ts` and `consent.test.ts`, 16 tests, now assert GA structurally cannot
reach authenticated/admin output). Prior review:
2026-08-09 (Phase 12, Security, CI, Dependency and Quality-Gate Improvements). Phase
12 closed RISK-012 (see `docs/risks/RISK_ARCHIVE.md` ARC-029 — found already fixed 2026-08-04, docs
just hadn't caught up), re-confirmed RISK-027 unchanged (private-repo Free-plan branch-protection
403 re-verified live), and de-risked RISK-015 (Wrangler bumped past both candidate-fix versions,
built-server CI swap itself deliberately deferred — see that risk's own entry for why). Prior
review: 2026-08-06 (Phase 8, Saved-Domain Experience and Change Timeline). Phase 8 closed a
real duplicate-simultaneous-scan gap (not previously tracked as a numbered risk — found and fixed
in the same pass, see `docs/reports/PHASE_08_SAVED_DOMAIN_CHANGE_TIMELINE_COMPLETION_REPORT.md`)
and added RISK-034 (a pre-existing N+1 query pattern found, deliberately left unfixed to keep the
phase's change surface focused). Prior review: 2026-08-05 (Phase 11, Database, Storage, Retention
and Performance Hardening).
Phase 11 closed RISK-005 and RISK-009 (see `docs/risks/RISK_ARCHIVE.md` ARC-025/ARC-026),
mitigated RISK-007 (P1→P3, `mitigating`) and re-modeled RISK-008 (concrete tightening measures
shipped, still `monitoring` — structural exposure at commercial scale unchanged), assessed
RISK-006 (decision matrix written, implementation deferred pending approval, still `monitoring`),
and recommends closing RISK-033 (real production re-measurement shows the gap already closed —
see `docs/reports/PHASE_11_DATABASE_STORAGE_PERFORMANCE_COMPLETION_REPORT.md`). Prior review:
2026-08-04 (Phase 7), consolidating `docs/status/KNOWN_RISKS.md`'s still-open items with the 13
new risks Phase 0's baseline audit found
(`docs/baseline/2026-08-03/BASELINE_RISKS_AND_UNKNOWNS.md`). Phase 6 closed RISK-016 (see
`docs/risks/RISK_ARCHIVE.md` ARC-024) and mitigated RISK-017. Phase 7 added RISK-031 (deferred
extended platform guides), RISK-032 (no Search Console property connected), and RISK-033.

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
- **Current mitigation**: Broader endpoints (zone list, DNS, ruleset list) confirm no custom WAF/rate-limit rules beyond Free-plan managed defaults. **Re-verified Phase 12 (2026-08-09)** via the Cloudflare MCP API tool (a different, broader-scoped credential than Phase 0's): `GET /zones/{id}/settings/ssl`, `/settings/always_use_https`, `/settings/min_tls_version`, `/settings/security_header` (HSTS), `/dnssec`, `/pagerules`, and `/rate_limits` all still return `401`/`403` ("Unauthorized to access requested resource" / "Authentication error") — the restriction is confirmed unchanged, not credential-specific. **New finding this pass**: `GET /zones/{id}/rulesets` (list-only, which IS readable) shows two zone-level custom rulesets beyond the Free-plan managed defaults — `http_request_dynamic_redirect` (v19, updated 2026-07-26) and **`http_request_firewall_custom`** (v18, updated 2026-07-31) — but their actual rule contents are not readable via this credential either (`GET /zones/{id}/rulesets/{id}` 403s). This means the prior "no custom WAF rules" claim cannot be fully confirmed — a custom firewall ruleset genuinely exists at the zone level; its contents need manual dashboard verification, not just its existence. **Recurred Phase 13 (2026-08-10)**: `POST /zones/{id}/purge_cache` returned `401 Authentication error` on the same restricted credential — confirmed the cache-purge gap first found 2026-07-29 (`docs/status/KNOWN_RISKS.md`) is still unresolved. Real-world consequence observed this time: the first Phase 13 production deploy's own automated smoke test (`deploy-production.yml` run `31397059938`) failed because Cloudflare's edge served a stale, pre-deploy copy of the homepage for a few minutes after deploy (`must-revalidate` alone does not force immediate revalidation at every edge PoP); a manual `scripts/smoke-test.ts` re-run 3 minutes later, and a full redeploy re-dispatch, both showed the correct post-deploy content. Not a code defect, but a real, disclosed operational gap worth carrying forward: any future deploy whose smoke test fails only on freshly-changed page content should be re-checked a few minutes later before assuming a real regression.
- **Owner**: Operations owner · **Trigger**: Any security review requiring zone-settings verification, or another deploy whose smoke test fails only on cache-sensitive content
- **Review date**: Next infrastructure phase (re-confirmed Phase 12, recurred Phase 13) · **Target phase**: Phase 12
- **Status**: accepted
- **Acceptance criteria for closure**: A broader-scoped Cloudflare API token is issued, or manual dashboard verification is performed and recorded.

### RISK-006 — `security_events` and `notifications` have no purge job

- **Category**: Database, Privacy · **Severity**: P2 · **Probability**: Low at current volume, structural
- **Impact**: Unlike scan-related tables (bounded by plan-tier retention), these two grow indefinitely regardless of plan or account lifetime.
- **Evidence**: `docs/data/DATA_RETENTION.md`, `docs/data/PHASE_11_RETENTION_DECISION_MATRIX.md`
- **Current mitigation**: **Partially resolved, Phase 13 (2026-08-10)** — `product_events` (the third category this risk originally covered) now has a bounded 18-month purge job (`purgeExpiredProductEvents()`, `apps/web/src/lib/data-retention.ts`, `PRODUCT_EVENT_RETENTION_DAYS = 548`), following the Phase 11 recommendation with explicit Phase 13-prompt approval — see `docs/analytics/PHASE_13_PRODUCT_EVENT_RETENTION_DECISION.md`. `security_events` and `notifications` remain assessed-but-not-implemented: Phase 11 found the SRS's own retention table (§34) is silent on these two categories specifically, so a recommendation (24mo/90-days-after-read respectively) is recorded but not implemented without explicit approval — the Phase 13 prompt did not extend approval to these two.
- **Owner**: Engineering owner · **Trigger**: Volume growth past current assumptions, or explicit approval of the Phase 11 recommendation for the remaining two categories
- **Review date**: Phase 13 (product_events closed); revisited Phase 14 (2026-08-06) — the Phase 14 prompt's own conditional language required an explicit product-owner acceptance of the Phase 11 recommended periods before implementation was authorised, and the prompt text provided contained no such acceptance, so both categories remain unimplemented per the prompt's own "otherwise leave the risk open" branch. See `docs/data/PHASE_14_SECURITY_EVENT_RETENTION_DECISION.md` and `docs/data/PHASE_14_NOTIFICATION_RETENTION_DECISION.md`. · **Target phase**: Next phase touching retention, pending approval for `security_events`/`notifications`
- **Status**: monitoring
- **Acceptance criteria for closure**: A retention decision is made and a purge job implemented for `security_events` and `notifications`, or the decision to leave them unbounded is explicitly and permanently accepted with a documented reason. (`product_events` — met, Phase 13.)

### RISK-007 — `scan_resources.snapshot_text` (`html_meta` type) stores the full truncated HTML body

- **Category**: Database, Performance · **Severity**: P1 → P3 (downgraded, see below) · **Probability**: Was certain at commercial scale; largest contributor now mitigated
- **Impact**: Was the largest quantified D1 storage growth driver.
- **Evidence**: `docs/data/D1_STORAGE_CAPACITY_AUDIT.md`, `docs/data/PHASE_11_STORAGE_OPTIMISATION_DESIGN.md`
- **Current mitigation**: Phase 11 implemented the first candidate fix for both dominant contributors — `html_meta` (measured production average 53,554 bytes/row, 5.4× the old estimate) and `sitemap` (20,891 bytes/row, 13.9× the old estimate) both now store a minimised evidence blob instead of the raw fetched body, reducing each by roughly two orders of magnitude. `resource_hash` also now populated for future dedup use. Old rows remain readable via a format-detecting fallback — no destructive rewrite.
- **Owner**: Engineering owner · **Trigger**: Post-deploy production re-measurement
- **Review date**: Phase 11 (mitigated) · **Target phase**: Stage 11I post-deploy verification for final closure
- **Status**: mitigating
- **Acceptance criteria for closure**: A post-deploy production re-measurement (not a local benchmark) confirms the real per-scan storage cost dropped in line with the projection in `docs/operations/PHASE_11_CLOUDFLARE_PLAN_DECISION.md`.

### RISK-008 — CrawlPact's real workload likely exceeds the Workers Free CPU budget at commercial scale

- **Category**: Infrastructure, Performance · **Severity**: P1 · **Probability**: Certain at the SRS's own 150+/1,000-domain commercial target; low at current real volume (2 users, 9 domains)
- **Impact**: `MAX_DOMAINS_PER_SWEEP=20`'s monitoring batch and per-scan CPU cost are modeled to exceed the 10ms/invocation ceiling well below the commercial target.
- **Evidence**: `docs/operations/SCAN_CAPACITY_BUDGET.md`, `docs/operations/MONITORING_CAPACITY_PLAN.md`, `docs/operations/CLOUDFLARE_UPGRADE_TRIGGERS.md`, `docs/operations/PHASE_11_CLOUDFLARE_PLAN_DECISION.md`
- **Current mitigation**: Phase 11 shipped the concrete tightening measures this risk's acceptance criteria named: D1 write batching (`db.batch()`, ~33:1 statement reduction), findings cap, RSL/sitemap size bounds, `html_meta`/`sitemap` storage reduction (RISK-007), and a monitoring-sweep fairness fix. Re-modeled in `docs/operations/PHASE_11_CLOUDFLARE_PLAN_DECISION.md`: real measured usage sits far below every Free-plan threshold, and a growth projection using the post-fix per-scan storage cost does not identify an imminent need to upgrade even at the SRS's commercial target. Still an accepted tradeoff, not a resolved risk — the underlying structural exposure at true commercial scale remains real.
- **Owner**: Operations owner · **Trigger**: Real customer volume approaching modeled thresholds (see `CLOUDFLARE_UPGRADE_TRIGGERS.md`)
- **Review date**: Phase 11 (re-modeled) · **Target phase**: Every material volume increase
- **Status**: monitoring
- **Acceptance criteria for closure**: Either tightening measures are implemented and re-modeled (done this phase), or a Workers Paid upgrade is made ahead of the trigger thresholds. Kept open (not closed) since the structural exposure at commercial scale is unchanged by mitigation alone.

### RISK-011 — No registered business address, registration number, or tax information exists anywhere in the repository

- **Category**: Legal · **Severity**: P2 · **Probability**: N/A (explicitly deferred)
- **Impact**: Blocks a specific, scoped set of items only: a registered address on any public page, a registration number, tax information, and a jurisdiction-specific consumer-protection-regime citation. Does **not** block the release as a whole.
- **Evidence**: `docs/release/LEGAL_INFORMATION_CHECKLIST.md`, `docs/trust/TRUST_AND_LEGAL_CONFIGURATION.md`. **Not an SRS requirement** — see `docs/baseline/2026-08-03/DOCUMENTATION_CONFLICTS.md` DC-010; this is a product-owner governance decision, not an SRS-derived blocker.
- **Current mitigation**: **Partially resolved (Phase 3, 2026-08-03)** — the product owner supplied and approved an operator name ("CrawlPact", no corporate suffix) and five contact addresses (privacy/security/support/corrections/billing), all live across `/privacy`, `/terms`, `/security`, `/contact`, `/about`, the footer, `apps/web/src/lib/trust-config.ts`, and `/.well-known/security.txt`. **Updated 2026-08-04**: the governing jurisdiction ("Sri Lanka") originally approved alongside these was subsequently removed at explicit product-owner instruction — no operating country or jurisdiction is published anywhere on the public site; see RISK-029 for the resulting Terms-of-Service governing-law gap this reopens. The registered address, registration number, and tax information remain explicitly, deliberately deferred — not invented.
- **Owner**: Legal/business owner · **Trigger**: Any decision to publish the three remaining gated items above
- **Review date**: Next release readiness review · **Target phase**: Phase 18 (Production Launch Readiness and Final Audit)
- **Status**: accepted
- **Acceptance criteria for closure**: Real, verified registered address, registration number, and tax information are published, or the deferral is re-confirmed at each review.

### RISK-013 — `mobile-safari` a11y test failure: skip-link keyboard focus

- **Category**: Accessibility, Test coverage · **Severity**: P2 · **Probability**: Confirmed, reproducible
- **Impact**: A Playwright/WebKit `Tab`-key limitation, not a real product defect (confirmed manually and via the Chromium project).
- **Evidence**: `docs/status/KNOWN_RISKS.md`
- **Current mitigation**: None needed for the product; documented as a known test-tooling limitation.
- **Owner**: Engineering owner · **Trigger**: Playwright/WebKit version upgrade that might resolve it
- **Review date**: Phase 12 · **Target phase**: Phase 12
- **Status**: accepted
- **Acceptance criteria for closure**: Either Playwright fixes the underlying WebKit `Tab` behavior, or the test is rewritten to avoid depending on it.

### RISK-014 — `deploy-preview.yml` fails at the deployed-bindings verification step, not a GitHub secret-naming mismatch (corrected Phase 12)

- **Category**: CI/CD, Operations · **Severity**: P2 · **Probability**: Was certain until fixed this phase
- **Impact**: Preview deploys failed on every run from at least 2026-08-04 through 2026-08-08 (20/20 runs checked).
- **Evidence**: `docs/status/KNOWN_RISKS.md` (original, since-corrected diagnosis); Phase 12 re-investigation: `gh run view <id> --log-failed` on run `31244429508` (commit `a5f1580`) showed the actual failure at the `deploy:verify-bindings:preview` step: `"deployed Worker \"crawlpact-web-preview\" drifted from apps/web/wrangler.jsonc: PADDLE_API_KEY: expected a secret_text binding but found nothing; PADDLE_WEBHOOK_SECRET: expected a secret_text binding but found nothing"`.
- **Current mitigation**: **Corrected, fixed, and verified live, Phase 12 (2026-08-09)**. The original diagnosis was wrong: `gh api repos/.../environments/preview/secrets` confirms `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN` were already present and correctly named in the `preview` GitHub Environment the whole time — the build/migrate/seed/deploy steps all succeeded on every failing run. The real gap, confirmed via the Cloudflare API's live bindings list for `crawlpact-web-preview`, was that the Worker itself was missing two `secret_text` bindings (`PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`) that were simply never set, unlike every other Paddle preview value which already used clearly-labeled sandbox placeholders. Set both via a direct Cloudflare API call (with the user's explicit confirmation first) — first attempt used made-up placeholder strings that didn't match `packages/config/src/env.ts`'s `KNOWN_PADDLE_PLACEHOLDER_VALUES`, surfacing a **second, previously-hidden bug**: `scripts/smoke-test.ts`'s billing-status assertion checked for `"Not configured..."` (capitalized) when `status.astro`'s actual rendered text is a correctly-grammared mid-sentence `"...not configured..."` (lowercase) — this assertion had simply never run before, since the binding-drift check always failed first. Both fixed (PR #97, PR #99). Final verification (`deploy-preview.yml` run `31348984572`): the pipeline now reaches all the way through build/migrate/seed/deploy/`deploy:verify-bindings:preview`/smoke-test successfully — it only fails at an unrelated Lighthouse performance threshold (median LCP 4984ms vs. 3000ms on `/`), which is not a Phase 12 concern (see RISK-033's own history of similar CI-runner Lighthouse variance).
- **Owner**: Operations owner · **Trigger**: N/A — closed
- **Review date**: Phase 12 (fixed and verified) · **Target phase**: N/A — closed
- **Status**: mitigating (kept, not archived, since a real preview deploy has still never gone fully green end-to-end — only the Paddle-secret and smoke-test bugs this phase targeted are confirmed fixed; the separate Lighthouse threshold is untouched by this phase and would need its own investigation before this risk could move to `RISK_ARCHIVE.md`)
- **Acceptance criteria for closure**: A `deploy-preview.yml` run completes successfully end-to-end, including `deploy:verify-bindings:preview`, after this phase's PR merges to `main`.

### RISK-015 — Built-server E2E (real `wrangler dev --local` against the built Worker) still not achieved

- **Category**: Test coverage, CI/CD · **Severity**: P2 · **Probability**: N/A — currently reverted to `astro dev`
- **Impact**: E2E/a11y suites test against Astro's dev server, not a genuinely production-like built Worker — a narrower but still real gap.
- **Evidence**: `docs/status/KNOWN_RISKS.md` ("Built-server E2E" entries)
- **Current mitigation**: `astro dev` target is stable and passing; the built-server approach caused two distinct real-CI-only crashes, both reverted after investigation. **Updated Phase 12 (2026-08-09)**: the documented next step (`docs/status/KNOWN_RISKS.md`'s "try the wrangler 4.115.0 upgrade first") is done — Wrangler bumped 4.114.0 → 4.120.0 (also clearing a second, newly-discovered peer-version floor: `@astrojs/cloudflare`'s bundled `@cloudflare/vite-plugin` requires Wrangler `^4.118.0`, the same root cause as RISK-026), `@cloudflare/workers-types` aligned to `5.20260809.1` across every workspace package to avoid a split drizzle-orm install, and the full quality gate (format/lint/typecheck/unit/integration/build) re-verified clean on the new version. The built-server CI swap itself was deliberately **not** re-attempted this phase: its own acceptance criteria requires 3 consecutive real-CI passes (not local — the prior two crashes never reproduced locally, only in real GitHub Actions runs), which cannot be satisfied inside one session, and attempting it inside this phase's own PR would risk destabilizing the CI gate this large a security/CI hardening change depends on to merge. Recommended next step: a small, dedicated follow-up PR that only swaps `astro dev` → `wrangler dev --local` in `ci.yml`'s `browser-smoke` job and `scripts/verify-push.sh`, run 3 times for real before trusting it.
- **Owner**: Engineering owner · **Trigger**: A dedicated follow-up attempt now that the Wrangler version blocker is cleared
- **Review date**: Phase 12 (de-risked, not closed) · **Target phase**: Next phase with budget for a dedicated 3-CI-run verification cycle
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

### RISK-022 — No cross-request target-frequency abuse monitoring

- **Category**: Security · **Severity**: P2 · **Probability**: Low
- **Impact**: A distributed set of anonymous callers (many IPs) could still direct many small in-bounds scans at one target — only per-caller limits exist today.
- **Evidence**: `docs/security/SECURITY_CHECKLIST.md`, `docs/status/REQUIREMENTS_TRACEABILITY.md` §33
- **Current mitigation**: **Fixed, Phase 12 (2026-08-09)**. Added `target_abuse_observations` (migration 0031) — a dedicated, detection-only table storing two opaque HMAC digests per allowed anonymous-audit request: `target_key` (canonical origin, keyed by a NEW dedicated `ABUSE_MONITORING_SECRET` — never `SESSION_SIGNING_SECRET`) and `caller_key` (reuses the existing `hashIp()` value). `getHighFrequencyTargets()` (`apps/web/src/lib/target-abuse.ts`) flags a target seen by ≥10 distinct callers within a 60-minute window; nothing reads this table to block a request — it only feeds a new `abuseMonitoring` block in the Super Admin operational capacity snapshot (`GET /api/admin/capacity`), giving the tooling this risk's acceptance criteria named. 8 new integration tests confirm: correct hashing, no false-positive on low caller diversity, correct detection at threshold, window exclusion, and that neither raw target nor raw IP ever appears in the capacity snapshot.
- **Owner**: Security owner · **Trigger**: Any observed abuse pattern
- **Review date**: Phase 12 (fixed) · **Target phase**: N/A — closed
- **Status**: mitigating
- **Acceptance criteria for closure**: Super Admin tooling for cross-request target-frequency alerting is built (done — `abuseMonitoring.highFrequencyTargetCount` in the capacity snapshot); kept `mitigating` rather than moved to the archive since the detection thresholds (60min / 10 callers) are a first, conservative default not yet tuned against real production abuse patterns.

### RISK-023 — CSP allows `'unsafe-inline'` for scripts/styles

- **Category**: Security · **Severity**: P2 · **Probability**: N/A (structural, ongoing)
- **Impact**: Reduces (doesn't eliminate) CSP's XSS mitigation value.
- **Evidence**: `docs/security/SECURITY_CHECKLIST.md`, `docs/security/THREAT_MODEL.md`
- **Current mitigation**: Astro island hydration + Tailwind's runtime both need it today; per-request nonce plumbing is unbuilt. **Investigated in depth, Phase 12 (2026-08-09) — deliberately not implemented, with concrete evidence why**: (1) the installed Astro version (7.1.3) has no built-in CSP nonce/hash support (`grep`'d its config schema — nothing) — implementing nonces would require either upgrading Astro (a separate, out-of-scope risk) or manually threading a nonce through every framework-injected inline `<script>`, which this codebase doesn't control. (2) Direct inspection of the built static output (`apps/web/dist/client/index.html`) confirms genuinely inline `<script>` content (a Google Analytics inline config script, JSON-LD structured data) exists even on fully prerendered, edge-cached marketing pages — these are static HTML served straight off the Workers Assets binding with **no per-request code path at all**, so a nonce (which must be unique per response) is architecturally inapplicable there regardless of framework support; the same is true for the 4 SSR routes that explicitly opt into `Cache-Control: public, max-age=N` (`changelog.astro`, `scanner.astro`, `for/[slug].astro`, `status.astro` — Phase 11's `PUBLIC_CACHE_POLICY.md`), where a nonce baked into one cached response would be replayed to every subsequent cache-hit visitor, defeating its purpose and risking exactly the cached-HTML/header divergence this phase was warned against. A hash-based CSP (allowlisting the exact SHA-256 of each static inline script/style at build time) is the architecturally correct fix for that static/cached surface, but is a genuinely separate, non-trivial build-pipeline initiative (deterministic content required, including GA's parameterized inline script) not safely attempted inside this already-large phase. Nonces remain theoretically viable for the private/no-store SSR surface only (admin/app routes, which never cache) but implementing that alone, while leaving every cached/static page unchanged, was judged not worth the split-CSP complexity and residual confusion it would add without the static-page half also being solved.
- **Owner**: Security owner · **Trigger**: A dedicated CSP-hardening initiative (Astro upgrade evaluation + hash-based CSP build step for static/cached pages)
- **Review date**: Phase 12 (investigated, not closed) · **Target phase**: Unscheduled — needs its own dedicated phase, not a sub-task of a broader security pass
- **Status**: accepted
- **Acceptance criteria for closure**: Either a hash-based CSP covers every static/cached page and per-request nonces cover every private SSR page (both, not one), or `'unsafe-inline'` is otherwise provably eliminated without weakening real functionality.

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
- **Current mitigation**: **Investigated and partially fixed, Phase 12 (2026-08-09)**. Root cause found via `gh run view --log-failed`: the newer `@astrojs/cloudflare@14.1.7`'s transitive `@cloudflare/vite-plugin` requires Wrangler `^4.118.0`, which the repo was pinned below (`4.114.0`) — this caused a hard `astro check` failure ("Unable to load your Astro config... does not satisfy the peer dependency"). Fixed by bumping Wrangler to `4.120.0` (PR #97) — re-ran PR #65's CI after this landed on `main` and confirmed the original typecheck failure is gone (0 errors). **A new, different failure has surfaced in its place**: the `quality` job now fails at the `pnpm build` step with a Rolldown/Vite build error (`aggregateBindingErrorsIntoJsError`, "Build failed"), and `browser-smoke` separately times out waiting for the dev server. This looks like a genuine compatibility issue with `@astrojs/cloudflare@14.1.7` itself (or its Vite/Rolldown chain), not the Wrangler-version issue this phase targeted — a real, still-open gap requiring its own dedicated investigation, not attempted this phase given its already-large scope.
- **Owner**: Engineering owner · **Trigger**: Next dependency-update review, or a dedicated Astro/Rolldown compatibility investigation
- **Review date**: Phase 12 (root cause #1 fixed, root cause #2 found) · **Target phase**: Next phase touching Astro/Vite tooling
- **Status**: open
- **Acceptance criteria for closure**: CI failure investigated and either fixed or the PR closed with a documented reason. (Partially met — the Wrangler-version cause is fixed; the Rolldown/Vite build failure remains open.)

### RISK-027 — `main` branch has no GitHub branch-protection rule configured

- **Category**: Operations, Security · **Severity**: P2 · **Probability**: N/A (known platform constraint)
- **Impact**: Merge safety depends entirely on the custom `merge-when-green.yml` workflow rather than a platform-enforced rule.
- **Evidence**: `docs/baseline/2026-08-03/PRODUCTION_INFRASTRUCTURE_INVENTORY.md`
- **Current mitigation**: `merge-when-green.yml` substitutes for native protection — private-repo GitHub Free-plan constraint, not a gap this repo introduced. **Re-confirmed live, Phase 12 (2026-08-09)**: `GET /repos/rmtlbandara/CrawlPact/branches/main/protection` still returns `403 "Upgrade to GitHub Pro or make this repository public to enable this feature"` — the constraint is unchanged.
- **Owner**: Operations owner · **Trigger**: A GitHub plan upgrade
- **Review date**: Phase 12 (re-confirmed, unchanged) · **Target phase**: Next GitHub plan upgrade
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

### RISK-033 — Production Lighthouse performance/LCP fails threshold on 3 of 5 tested pages (pre-existing, first measured this phase)

- **Category**: Performance · **Severity**: P2 · **Probability**: Certain (measured directly)
- **Impact**: A direct `scripts/lighthouse-check.mjs` run against `https://crawlpact.com` (first
  time this script was ever run against production rather than the preview Worker) found `/`
  (79/100, LCP 4,653ms), `/crawlers/amazonbot` (71/100, LCP 5,070ms), and `/for/agencies` (73/100,
  LCP 4,788ms) all fail the stated thresholds (performance ≥85, LCP ≤3000ms). This is **not** a
  Phase 7 regression — `/for/agencies` performs almost identically to the pre-existing, unmodified
  `/crawlers/amazonbot`, and Phase 7's other new page (`/platforms/cloudflare`, 90/100) actually
  outperforms both. `deploy-preview.yml` only ever runs this check against the preview Worker, so
  production's real Lighthouse numbers were previously unmeasured, not previously passing.
  Accessibility (100/100), SEO (100/100), Best Practices (92/92), and CLS (0/0) are unaffected and
  identical across every page tested.
- **Evidence**: `docs/seo/PHASE_07_SEARCH_PERFORMANCE_BASELINE.md` ("Real production Lighthouse run
  (post-deploy, 2026-08-04)")
- **Current mitigation**: Real production re-measurement in Phase 11
  (`docs/performance/PHASE_11_PAGE_PERFORMANCE_RESULTS.md`, `PHASE_11_PAGE_PERFORMANCE_ROOT_CAUSE.md`)
  found every previously-failing page now scores 94–99 (was 71–90) with LCP 1,579–2,940ms (was
  3,300–5,070ms) — the gap had already closed before this phase touched any frontend code (several
  commits landed between the two measurement dates; this phase's own investigation did not isolate
  which one, and discloses that honestly rather than claiming credit). `scripts/lighthouse-check.mjs`
  now gates on the median of 3 runs (not 1) and covers a previously-missing template
  (`/sample-report`), reducing the chance of this kind of gap going undetected again.
- **Owner**: Engineering owner · **Trigger**: A future Lighthouse run against production showing
  regression back below threshold
- **Review date**: Phase 11 (re-measured, recommend closing) · **Target phase**: N/A — no further
  phase work identified as necessary
- **Status**: monitoring
- **Acceptance criteria for closure**: A direct production Lighthouse run shows all tested pages
  meeting the stated performance/LCP thresholds — **met** by this phase's real re-measurement.
  Recommend moving to `RISK_ARCHIVE.md` upon this phase's merge.

### RISK-034 — `listDomains()`'s open-findings count is an N+1 query pattern (pre-existing, found during Phase 8)

- **Category**: Performance · **Severity**: P3 · **Probability**: Certain (confirmed by code
  reading, not yet measured under real load)
- **Impact**: `openFindingsCountFor()` (`apps/web/src/lib/domains.ts`) runs one `SELECT COUNT(*)`
  per domain when building the saved-domain list, rather than one batched query for the whole
  page. Bounded in practice by `savedDomainLimit` (≤100, the Agency ceiling), so this is not
  currently a correctness or unbounded-growth risk — but it is the exact pattern Phase 8's own
  query-architecture rules explicitly prohibit for new work, and this pre-existing instance was
  left as-is rather than opportunistically rewritten, to keep Phase 8's own change surface focused
  (see `docs/product/PHASE_08_SAVED_DOMAIN_EXPERIENCE_BASELINE.md`).
- **Evidence**: `apps/web/src/lib/domains.ts`'s `openFindingsCountFor`/`listDomains` (found while
  fixing the adjacent, real N+1 gap for the new "recent change" column in the same function, which
  _was_ fixed with a single batched query — `getLatestChangeEventPerDomain`).
- **Current mitigation**: None yet — bounded by the existing 100-domain plan ceiling.
- **Owner**: Engineering owner · **Trigger**: A future phase touching the saved-domain list, or
  real production D1-read measurement showing this pattern is a meaningful cost driver.
- **Review date**: Next phase touching `lib/domains.ts` · **Target phase**: Unscheduled — revisit
  only if real usage or measurement shows this is a meaningful cost driver.
- **Status**: accepted
- **Acceptance criteria for closure**: `listDomains()`'s open-findings count is computed via one
  batched query for the whole page, matching the pattern already used for `recentChangeOrigin`.

---

### RISK-035 — Public crawler directory is statically generated, not read live from the registry (Phase 15)

- **Category**: Data integrity, Trust · **Severity**: P3 · **Probability**: Low at current release
  cadence
- **Impact**: `/crawlers` and `/crawlers/:slug` are generated from a Markdown content collection
  (`apps/web/src/content/crawlers/*.md`), independent of the D1 `crawlers`/`registry_versions`
  tables. Publishing a new registry release does not automatically update these public pages — a
  human must separately edit the Markdown files and redeploy. If that step is missed, the public
  directory could describe a crawler's purpose/lifecycle/token differently than the actual active
  registry release evaluates against.
- **Evidence**: `docs/registry/PUBLIC_REGISTRY_RENDERING_ARCHITECTURE.md` (Phase 15 evaluation of
  Option A/B, both deferred).
- **Current mitigation**: `pnpm registry:public:validate` (Phase 15, wired into
  `quality:gate`/CI/`verify-push.sh`) fails the build if a content page's token doesn't exist in
  the registry, describes an unverified crawler as confirmed, or contains a prohibited
  public/internal field — and warns (non-blocking) on purpose/lifecycle drift between the content
  page and the current registry state. This catches drift at build/CI time for whatever is
  currently committed; it does not continuously monitor already-deployed production pages against
  a later registry release published without a corresponding content-collection commit.
- **Owner**: Engineering owner · **Trigger**: Registry releases become more frequent than roughly
  monthly, or a real customer-facing incident traces back to public-page staleness.
- **Review date**: Next phase touching the public crawler directory · **Target phase**:
  Unscheduled — build Option A (runtime release-backed directory) if the trigger above occurs.
- **Status**: accepted
- **Acceptance criteria for closure**: The public crawler directory reads its factual core
  (token/purpose/lifecycle/source/verification date) directly from the active registry release at
  request or build time, making drift structurally impossible rather than CI-detected.
- **Phase 16 note**: re-evaluated per `docs/product/PHASE_16_RISK_035_DECISION.md` — not closed
  (`/crawlers` itself is unchanged), but the new Policy Observatory (`/observatory/registry`) was
  built to read live from `registry_version_entries` from the start, so it carries none of this
  risk. Option A/B were still not applied to the existing `/crawlers` pages.

---

## How to update this document

Add a new risk here the moment it's found, using the next sequential `RISK-NNN` ID. Move a risk to
`docs/risks/RISK_ARCHIVE.md` the moment it's resolved/superseded/no-longer-applicable — do not
leave a resolved risk here marked "Resolved" in place; move it. Every risk here must link to real
evidence, not a restated claim.
