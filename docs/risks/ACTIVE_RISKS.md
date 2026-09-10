# Active Risks

**Level 1 document (Current authoritative).** The single current source of open risk for
CrawlPact. Superseded/resolved risks live in `docs/risks/RISK_ARCHIVE.md`. Full historical
narrative and investigation detail for both active and archived risks remains in
`docs/status/KNOWN_RISKS.md` (now a **historical** document — see its notice), cited by reference
below rather than duplicated. Do not maintain a third active-risk list anywhere else.

Statuses: `open` · `mitigating` · `accepted` · `blocked` · `monitoring`.

Last reviewed: 2026-09-10 (App-Subdomain Migration Phases 1–3 closure reconciliation). Updated
RISK-036: severity reduced P2→P3, impact/mitigation corrected to reflect that origin-pinned
WebAuthn, self-referential CSRF, and the Cloudflare host boundary are now implemented and
live-attached (Phase 2/3), not merely designed — closure still gated on Phase 4's remaining live
authenticated proof (new passkey registration, cookie-attribute inspection, sibling-origin CSRF
mutation against a real session). No other risk status changed in this pass; full detail in
`docs/baseline/2026-09-10-app-subdomain-phases1-3-closure/`. Prior review: 2026-09-09
(App-Subdomain Migration Phase 1). Added RISK-036 (WebAuthn/CSRF/session
origin coupling during the planned `crawlpact.com`/`app.crawlpact.com` split — see
`docs/baseline/2026-09-09-app-subdomain-phase1/` and ADR-0010). No other risk status changed in
this pass. Prior review: 2026-08-17 (master engineering closure pass). Closed RISK-033 (see
`docs/risks/RISK_ARCHIVE.md` ARC-040 — the homepage was never actually slow; Lighthouse's default
simulated-throttling mode was misjudging it. Real-network measurement proved the homepage healthy
and, in switching to that measurement method, surfaced and fixed a second, genuinely real issue:
the analytics-consent banner's delayed reveal on `/sample-report`). Prior review: 2026-08-15 (Phase
19 continuous governance, ad hoc maintenance pass). Closed RISK-025 (see
`docs/risks/RISK_ARCHIVE.md` ARC-038 — migration `0037` makes the DB's own unique index
case-insensitive, matching `registry-tools.mjs`'s existing check) and RISK-026 (see
`docs/risks/RISK_ARCHIVE.md` ARC-039 — bumping `astro` and `@astrojs/cloudflare` together, not
`@astrojs/cloudflare` alone, resolves the missing-export build failure). Reclassified RISK-033 from
`monitoring` back to `open` (later superseded by the 2026-08-17 closure above): a controlled
production/preview Lighthouse comparison found what looked like a real, currently-active,
homepage-specific LCP regression present in both environments — see the archive entry for how that
turned out to be a measurement artifact, not a real regression. Prior review: 2026-08-14 (Phase 19
foundation, Post-Launch Optimisation and Continuous
Governance). No risk status changed in this pass — a full read-through confirmed every open entry
below remains accurate against live production, and confirmed no basis to reopen RISK-002,
RISK-006, or RISK-018 (all closed with evidence in the Phase 0-18 final reconfirmation pass, see
`docs/risks/RISK_ARCHIVE.md` ARC-035/036/037). RISK-032 (Search Console) and RISK-003 (Cloudflare
credential visibility) were specifically re-checked and remain accurately `accepted`/open exactly
as recorded — see `docs/optimization/PHASE_19_EVIDENCE_BACKLOG.md` for their Phase 19 trigger
status. Prior review: 2026-08-14 (Phase 0-18 final reconfirmation pass — resolved RISK-002,
RISK-006, RISK-018; reclassified RISK-032 to POST-LAUNCH; see
`docs/reports/PHASE_00_18_FINAL_RECONFIRMATION_AND_PRODUCTION_RELEASE.md`). Prior review:
2026-08-10 (Phase 13, Analytics, Consent, Product Measurement and Private-Repository
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

- **Category**: Billing · **Severity**: P1 (technical sub-question), commercial validation tracked separately · **Probability**: N/A — technical sub-question resolved by direct evidence this phase
- **Impact**: Whether a real payment correctly links `custom_data.userId` and grants the plan had never been directly observed, only inferred from webhook simulation and code review — **until Phase 17**.
- **Evidence**: `docs/status/KNOWN_RISKS.md` (webhook resolution entries), `docs/baseline/2026-08-03/BILLING_AND_PLAN_BASELINE.md`, **`docs/pilot/REAL_PAID_CHECKOUT_VALIDATION_PROTOCOL.md` (Phase 17, 2026-08-11)**.
- **Current mitigation**: Webhook delivery mechanism independently verified live 2026-07-28 (8 real signed events). Signature/idempotency/state-machine logic proven. Phase 6 (2026-08-04): the live Paddle catalog itself is real, server-side checkout price resolution verified against it. **Phase 17 (2026-08-11)**: two pre-existing, real (non-sandbox) production Paddle subscriptions were found and independently re-verified read-only against the live Paddle API — real checkout, real payment (`first_billed_at` populated), a linked webhook event, correct plan grant, correct billing period. **This satisfies the technical acceptance criteria** (real checkout → real payment → real webhook → correct user linkage → subscription created → plan granted). Both subscriptions belong to the product owner's own Super Admin account, however — per Phase 17's own doctrine (an owner-funded/owner-held transaction never proves commercial demand), this evidence closes the _technical_ sub-question only. Genuine commercial validation (an independent external customer voluntarily paying) remains open — tracked in `docs/pilot/PHASE_17_COMMERCIAL_VALIDATION_DECISION.md`, currently "insufficient evidence" (0 external participants).
- **Owner**: Billing owner · **Trigger**: Before any commercial launch or real customer onboarding
- **Review date**: Before Gate B (Conversion-ready) · **Target phase**: Phase 7 (technical), Phase 17 (commercial)
- **GitHub issue**: not yet created (see `docs/governance/GITHUB_GOVERNANCE_SETUP_MANIFEST.md`)
- **Status**: **technical sub-question closed (2026-08-11); commercial validation remains open**
- **Acceptance criteria for closure (technical)**: ✅ met — one real, live paid checkout completed end-to-end (payment → webhook → plan grant), independently re-verified read-only via the Paddle API and D1.
- **Acceptance criteria for closure (commercial)**: still open — requires ≥2 independent external customers voluntarily purchasing at the current public price (`docs/pilot/PHASE_17_SUCCESS_CRITERIA.md`), not yet met.

### RISK-003 — Several Cloudflare zone-level settings are unreadable via the connected API credential

- **Category**: Infrastructure, Security · **Severity**: P2 · **Probability**: N/A (permanent until credential rescoped)
- **Impact**: SSL/TLS mode, HSTS, DNSSEC, Page Rules, Rate Limiting Rules, Cache Rules, redirect-ruleset detail, and AI Crawl Control settings cannot be verified programmatically — only via manual dashboard check.
- **Evidence**: `docs/status/KNOWN_RISKS.md` ("connected Cloudflare API credential cannot read several zone-level settings")
- **Current mitigation**: Broader endpoints (zone list, DNS, ruleset list) confirm no custom WAF/rate-limit rules beyond Free-plan managed defaults. **Re-verified Phase 12 (2026-08-09)** via the Cloudflare MCP API tool (a different, broader-scoped credential than Phase 0's): `GET /zones/{id}/settings/ssl`, `/settings/always_use_https`, `/settings/min_tls_version`, `/settings/security_header` (HSTS), `/dnssec`, `/pagerules`, and `/rate_limits` all still return `401`/`403` ("Unauthorized to access requested resource" / "Authentication error") — the restriction is confirmed unchanged, not credential-specific. **New finding this pass**: `GET /zones/{id}/rulesets` (list-only, which IS readable) shows two zone-level custom rulesets beyond the Free-plan managed defaults — `http_request_dynamic_redirect` (v19, updated 2026-07-26) and **`http_request_firewall_custom`** (v18, updated 2026-07-31) — but their actual rule contents are not readable via this credential either (`GET /zones/{id}/rulesets/{id}` 403s). This means the prior "no custom WAF rules" claim cannot be fully confirmed — a custom firewall ruleset genuinely exists at the zone level; its contents need manual dashboard verification, not just its existence. **Recurred Phase 13 (2026-08-10)**: `POST /zones/{id}/purge_cache` returned `401 Authentication error` on the same restricted credential — confirmed the cache-purge gap first found 2026-07-29 (`docs/status/KNOWN_RISKS.md`) is still unresolved. Real-world consequence observed this time: the first Phase 13 production deploy's own automated smoke test (`deploy-production.yml` run `31397059938`) failed because Cloudflare's edge served a stale, pre-deploy copy of the homepage for a few minutes after deploy (`must-revalidate` alone does not force immediate revalidation at every edge PoP); a manual `scripts/smoke-test.ts` re-run 3 minutes later, and a full redeploy re-dispatch, both showed the correct post-deploy content. Not a code defect, but a real, disclosed operational gap worth carrying forward: any future deploy whose smoke test fails only on freshly-changed page content should be re-checked a few minutes later before assuming a real regression.
- **Owner**: Operations owner · **Trigger**: Any security review requiring zone-settings verification, or another deploy whose smoke test fails only on cache-sensitive content
- **Review date**: Re-confirmed Phase 18 (2026-08-14) · **Target phase**: Phase 12 (recurring re-confirmation)
- **Current mitigation (Phase 18 update)**: SSL mode, `always_use_https`, `min_tls_version`, HSTS, and DNSSEC all still `401`/`403` via the connected credential — unchanged. The two zone-level custom rulesets (`http_request_dynamic_redirect` v19, `http_request_firewall_custom` v18) still exist, still unchanged since 2026-07-26/07-31, still unreadable in content via this credential. Nothing has changed since Phase 13's finding; the gap remains a manual-dashboard-only verification item.
- **Status**: accepted
- **Acceptance criteria for closure**: A broader-scoped Cloudflare API token is issued, or manual dashboard verification is performed and recorded.

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
- **Retried and reverted again, 2026-08-15**: the wrangler-version lead from Phase 12 was finally acted on directly — `ci.yml`'s `browser-smoke` job and `scripts/verify-push.sh` were swapped to `wrangler dev --local` against the built Worker (wrangler now 4.120.0, well past the 4.115.0 lead). Build/typecheck against the built Worker succeeded cleanly. Running the full Chromium E2E suite against it crashed the server mid-run (47/143 passed before the crash, then cascading connection failures) — **this is new, more useful evidence than before**: the exact same signature (`castErrorCause` → `ProxyController2.emitErrorEvent` → Miniflare's `#handleLoopbackCustomFetchService`, empty `[ERROR]`, no message body) reproduced **locally on macOS this time**, immediately after a real `POST /api/auth/register/finish` passkey ceremony — previously this class of crash had only ever reproduced in real GitHub Actions CI, never locally, across 4+ local runs. Local reproduction updates the working theory: this is very likely an upstream `wrangler`/Miniflare bug in the dev-proxy's loopback custom-fetch handling triggered by a real WebAuthn ceremony's response shape, not a Linux-CI-runner-specific or Wrangler-version-specific instability — the version bump did not fix it, disproving Phase 12's stated hypothesis. **Reverted again** (`ci.yml`/`verify-push.sh` back to `astro dev`); not filed upstream against `cloudflare/workers-sdk` this pass (out of scope for this session, but now has a concrete, reproducible local repro case that would make a strong bug report). Next step, if picked up again: capture a minimal repro (a single WebAuthn registration-finish request against a bare `wrangler dev --local` instance, no Playwright/CI involved) and either file it upstream or bisect wrangler/Miniflare versions to find where it was introduced.
- **Owner**: Engineering owner · **Trigger**: A future wrangler/Miniflare release that plausibly fixes loopback custom-fetch handling, or bandwidth for a proper upstream bisect/bug report
- **Review date**: 2026-08-15 (retried, reverted with better evidence) · **Target phase**: Next phase with budget for an upstream bisect/bug report, not just another retry
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

### RISK-027 — `main` branch has no GitHub branch-protection rule configured

- **Category**: Operations, Security · **Severity**: P2 · **Probability**: N/A (known platform constraint)
- **Impact**: Merge safety depends entirely on the custom `merge-when-green.yml` workflow rather than a platform-enforced rule.
- **Evidence**: `docs/baseline/2026-08-03/PRODUCTION_INFRASTRUCTURE_INVENTORY.md`
- **Current mitigation**: `merge-when-green.yml` substitutes for native protection — private-repo GitHub Free-plan constraint, not a gap this repo introduced. **Re-confirmed live, Phase 12 (2026-08-09)**: `GET /repos/rmtlbandara/CrawlPact/branches/main/protection` still returns `403 "Upgrade to GitHub Pro or make this repository public to enable this feature"` — the constraint is unchanged. **Re-confirmed again, Phase 18 (2026-08-14)**: identical `403` response, identical message. No change.
- **Owner**: Operations owner · **Trigger**: A GitHub plan upgrade
- **Review date**: Re-confirmed Phase 18 (2026-08-14) · **Target phase**: Next GitHub plan upgrade
- **Status**: accepted
- **Acceptance criteria for closure**: GitHub plan upgraded and native branch protection configured, or this acceptance is re-confirmed.

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
- **Review date**: Next release readiness review · **Target phase**: **Reclassified POST-LAUNCH /
  Phase 19, 2026-08-14** (Phase 0-18 final release, owner-authorized §39-43) — no Google-
  authenticated Search Console tool/session is available to this agent, and none was guessed or
  fabricated. Search Console is search observability, not a security/billing/audit-correctness/
  customer-data prerequisite, so it no longer blocks the first production release. It remains a
  real, undone task — see `docs/release/PHASE_18_SEARCH_CONSOLE_REQUIRED_ACTION.md` for the exact
  manual owner steps, unchanged from before this reclassification.
- **Status**: **resolved and independently verified (2026-09-08, Phase 20)** — a Search Console
  property (`sc-domain:crawlpact.com`, Domain property, `siteOwner` permission) is connected.
  2026-09-07's session had no GSC API/OAuth tool available and recorded this as supplied,
  unverified evidence; 2026-09-08's session had direct read-only API access
  (`~/.config/crawlpact-gsc/`) and independently confirmed the connection, queried real 28-day and
  90-day performance data, and analyzed a pre-existing 79-URL bulk Inspection snapshot — see
  `docs/baseline/2026-09-08-phase20/SEARCH_CONSOLE_BASELINE.md`. The trigger condition this risk
  tracked ("no property connected") is fully resolved; ongoing search-performance monitoring (not
  connection status) is the live concern going forward and does not itself need tracking here.
- **Acceptance criteria for closure**: A Search Console property is connected (met) and the manual
  verification checklist in `PHASE_07_SEARCH_PERFORMANCE_BASELINE.md` is completed at least once
  (met, 2026-09-08 — real API access used for 28d/90d performance, device/country, brand/non-brand,
  and analysis of a 79-URL bulk Inspection snapshot; see
  `docs/baseline/2026-09-08-phase20/SEARCH_CONSOLE_BASELINE.md`). **Fully closed.**

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

### RISK-036 — App-subdomain origin separation: implemented and live-attached; full dual-origin authenticated proof still pending Phase 4

- **Category**: Architecture, Security (WebAuthn origin binding, CSRF, session cookie scope) ·
  **Severity**: P2 → **P3, reduced 2026-09-10** (Phase 1–3 closure review) — the coupling this risk
  originally warned about is now implemented correctly and partially live-proven, not merely
  designed; residual risk is "the remaining unverified-live cases turn out to be wrong," not "the
  mechanism doesn't exist."
- **Impact**: ~~CrawlPact's authentication is currently single-origin by design... no code
  implementing any of this exists yet~~ **Superseded.** `app.crawlpact.com` is a real, live
  Cloudflare Custom Domain of the same Worker as of Phase 3 (2026-09-10). WebAuthn ceremonies are
  origin-pinned per-ceremony (never an unpinned two-origin array — confirmed by source and by two
  real cross-origin replay tests using a live software authenticator in Phase 2); CSRF is
  self-referential to the request's own validated arrival origin, confirmed rejecting the sibling
  origin via 4 dedicated integration tests. The residual gap is proof, not design: a **new**
  passkey registered directly against the live `app.crawlpact.com` origin, a live authenticated
  cookie-attribute inspection, and a live authenticated sibling-origin CSRF mutation attempt have
  not yet been performed against real production — Phase 3's own completion report says so
  explicitly, and the Phase 1–3 closure pass did not perform them either (they require either a
  real customer/test account and physical passkey interaction, or a specific owner go-ahead to
  mutate real production auth/session state — held for that rather than done unilaterally).
- **Evidence**: `docs/baseline/2026-09-09-app-subdomain-phase1/` (design), `docs/baseline/2026-09-09-app-subdomain-phase2/`
  (implementation + cross-origin replay test evidence, `TEST_EVIDENCE.md`), `docs/baseline/2026-09-09-app-subdomain-phase3/`
  (Custom Domain attachment, real pre-migration passkey continuity test — PASS), and
  `docs/baseline/2026-09-10-app-subdomain-phases1-3-closure/` (this reconciliation) —
  and `docs/architecture/adr/ADR-0010-PUBLIC-APP-ORIGIN-SEPARATION.md`.
- **Current mitigation**: Origin-pinned WebAuthn (`auth/webauthn.ts`), self-referential CSRF
  (`auth/same-origin.ts`), and the Cloudflare host boundary (`worker.ts`, `lib/origin.ts`,
  `lib/route-ownership.ts`) are all implemented, unit/integration-tested (host-boundary, CSRF
  sibling-origin, WebAuthn cross-origin-replay suites all green), and live-attached in production.
  `WEBAUTHN_RP_ID` remains `crawlpact.com`, unchanged and unnarrowed. The one real human
  continuity test performed live (existing pre-migration passkey sign-in against the real attached
  domain) passed with no anomalies.
- **Owner**: Engineering owner · **Trigger**: Phase 4 cutover planning
- **Review date**: Phase 1–3 closure (2026-09-10, this review) · **Target phase**: Phase 4 (cutover)
  for the remaining live authenticated proof and final closure
- **Status**: monitoring
- **Acceptance criteria for closure**: the remaining live proof gap closes — a new passkey
  registered and later used to authenticate against the real `app.crawlpact.com` origin, a live
  authenticated session's cookie attributes independently confirmed host-only with no `Domain`
  attribute, and a live authenticated sibling-origin CSRF mutation attempt confirmed rejected — in
  addition to the mandatory negative tests in `PHASE_2_TEST_CONTRACT.md`, which already pass.

---

## How to update this document

Add a new risk here the moment it's found, using the next sequential `RISK-NNN` ID. Move a risk to
`docs/risks/RISK_ARCHIVE.md` the moment it's resolved/superseded/no-longer-applicable — do not
leave a resolved risk here marked "Resolved" in place; move it. Every risk here must link to real
evidence, not a restated claim.
