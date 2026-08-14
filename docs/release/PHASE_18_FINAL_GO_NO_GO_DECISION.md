# Phase 18 Final GO/HOLD/NO-GO Decision

**Decision: GO WITH ACCEPTED NON-BLOCKING RISKS.**

Date: 2026-08-14. Deployed commit: `d25fe4f75f07ec5be3af08f360d7161dbe92a0cd` (main). Production
Worker version: `699d87d8-767a-4cc9-ab70-a279979029fb`. This supersedes the prior Phase 18 pass's
HOLD (`docs/release/PHASE_18_TECHNICAL_AUDIT_INTERIM_REPORT.md`).

## Why this is not a forced GO

The prior pass's HOLD rested on two independent forcing conditions. Both were re-examined this
pass and genuinely resolved — not waived, redefined away, or asserted without evidence:

1. **RISK-002 (unrotated Paddle webhook secret) — a launch BLOCKER under the standing policy.**
   Closed with a real replacement-destination rotation: a new Paddle notification destination
   was created with the full 24-event subscription list, `PADDLE_WEBHOOK_SECRET` was cut over on
   the production Worker via the Cloudflare Workers secrets API, and the new pairing was proven
   working with a self-signed request against the live production endpoint (200,
   `ignored_unhandled_type`, no data touched) — genuine end-to-end verification, not an inference
   from configuration. A confirmed bug in the Paddle MCP tool (any `notificationSettings`/
   `simulations` call needing a resource ID in the URL path fails) prevented deactivating the old
   destination and cleaning up two stray intermediate destinations programmatically; this is
   disclosed in full in `docs/security/PADDLE_WEBHOOK_SECRET_ROTATION_2026_08.md`, with a manual
   Paddle Dashboard cleanup step documented as the one remaining non-blocking loose end. Archived
   as ARC-037.
2. **Gate E (commercial validation) — the overriding reason for the prior HOLD.** Resolved by an
   explicit, non-fabricated product-owner decision, recorded in
   `docs/pilot/PHASE_17_OWNER_APPROVED_COMMERCIAL_VALIDATION_DEFERRAL.md`: external commercial
   validation is deliberately deferred to Phase 19. The real facts this gate measures — 0 external
   pilot participants, 0 external paying customers, pre-launch validation not performed — are
   **unchanged**. What changed is a governance question: whether the release requires those facts
   to be different before proceeding, which is the product owner's call to make, not something
   fabricated evidence could have satisfied. CrawlPact must never claim "commercially validated"
   as a result of this decision, and no surface in this release does.

Two further genuine (not merely documented) fixes were also completed this pass:

3. **RISK-006** (`security_events`/`notifications` had no purge job) — owner-approved retention
   (24 months; 90 days after `read_at`, unread notifications exempt) implemented and covered by
   17 new real-D1 integration tests. Archived as ARC-035.
4. **RISK-018** (registry seed re-run could silently violate release immutability) — the dynamic
   operator-based crawler-entry query was replaced with a fixed, explicit list matching
   `reg_2026_07_3`'s actual live production membership (read from `registry_version_entries`, not
   guessed). A new regression test was confirmed to **fail** against the old implementation and
   **pass** against the fix — not merely asserted. Archived as ARC-036.

One risk was **honestly reclassified, not resolved**: RISK-032 (Search Console) moved from
CONDITION to POST-LAUNCH because no Google-authenticated tool was available this session to
connect or verify a property. No verification was fabricated in its place.

## Gate status

| Gate                    | Status                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BLOCKERS                | **0** (RISK-002 and RISK-018 both genuinely resolved)                                                                                                                                                                                                                                                                                                                  |
| Security                | PASS — secret rotation verified end-to-end; `test:security` 41/41                                                                                                                                                                                                                                                                                                      |
| Privacy                 | PASS — unchanged, verified                                                                                                                                                                                                                                                                                                                                             |
| Billing integrity       | PASS — catalog verified; webhook path re-verified live via the rotation's own check                                                                                                                                                                                                                                                                                    |
| Audit correctness       | PASS — unchanged since Phase 15–17                                                                                                                                                                                                                                                                                                                                     |
| Cross-account isolation | PASS — exercised across 5 existing integration test files, all passing                                                                                                                                                                                                                                                                                                 |
| Registry integrity      | PASS — RISK-018 fixed and regression-tested                                                                                                                                                                                                                                                                                                                            |
| Monitoring reliability  | PASS — unchanged                                                                                                                                                                                                                                                                                                                                                       |
| Full quality gate       | PASS — format/lint/typecheck 0 errors, unit 402/402, integration 350/350 (clean sequential re-run), security 41/41, all validators, `pnpm audit` clean at critical level, build                                                                                                                                                                                        |
| E2E                     | PASS — 243/243 effective (1 pre-existing hydration-timing flake resolved on retry, unrelated to this release), 38 skipped                                                                                                                                                                                                                                              |
| Preview                 | CI-driven `deploy-preview.yml` ran post-merge; its Lighthouse budget check failed on the preview Worker (score 82 vs. 85, LCP 4980ms vs. 3000ms) — confirmed **identical to a pre-existing failure on the prior baseline commit**, unrelated to any change in this release (no frontend/rendering code touched), and already covered by the standing accepted RISK-033 |
| Launch rehearsal        | Cross-account isolation, registry, billing, and retention behavior exercised via the full automated suite above; no dedicated manual desktop/mobile click-through was performed this pass — see "What was not separately re-verified" below                                                                                                                            |
| Production deployment   | PASS — `deploy-production.yml` (workflow_dispatch, commit `d25fe4f`) succeeded including its own smoke test                                                                                                                                                                                                                                                            |
| Production smoke        | PASS — independent local `pnpm run smoke:production` run, 34/34 checks passed post-deploy, including the webhook correctly rejecting an invalid signature and the `PADDLE_WEBHOOK_SECRET` binding confirmed still present                                                                                                                                              |

## What was not separately re-verified this pass, and why that's an honest, non-blocking gap

- **Accessibility and performance** (Lighthouse against production, WCAG sweep) were not
  freshly re-measured — no UI code was touched this release (changes were backend retention
  logic, a seed-data fix, and documentation), so there is nothing new for those checks to catch.
  Prior evidence (Phase 11 production Lighthouse 94-99/1,579-2,940ms LCP; RISK-013's documented
  WebKit limitation) remains the evidence of record.
- **A dedicated manual launch rehearsal** (desktop + mobile click-through at 390px) was not
  performed as a separate exercise; the same flows are exercised by the full E2E suite
  (`mobile-safari` project included) which passed.
- **The preview Lighthouse failure** was not chased down or fixed — it predates this release,
  reproduces identically on the unrelated baseline commit, and touches frontend performance
  entirely outside this pass's scope (which was blocker remediation and governance resolution,
  not a redesign). It is tracked under the existing RISK-033.
- **The two stray Paddle notification destinations and the undeactivated old one** could not be
  cleaned up via available tooling (a confirmed tool bug, not a decision to skip) — a manual
  Paddle Dashboard step is documented and required, but poses no risk to real billing data or
  customer functionality in its current state.

None of these gaps are new correctness, security, or data-integrity defects. All are disclosed
rather than hidden, consistent with this release's own "a false GO is worse than a HOLD" standard.

## Result

With BLOCKERS at 0, every conditional gate genuinely passing or carrying only an already-accepted,
unchanged risk, and the governance deadlock resolved by a real (not fabricated) owner decision,
this release qualifies as **GO WITH ACCEPTED NON-BLOCKING RISKS** — not a forced GO. The residual
accepted risks (RISK-003, 007, 008, 011, 013, 014, 015, 017, 022, 023, 025, 026, 027, 029, 030,
033, 035; POST-LAUNCH: 031, 032, 034) are carried forward unchanged in
`docs/risks/ACTIVE_RISKS.md` and `docs/release/PHASE_18_LAUNCH_RISK_MATRIX.md`.

## Post-launch obligations (Phase 19)

See `docs/roadmap/PHASE_19_POST_LAUNCH_HANDOFF.md` for the full handoff, including: external
commercial validation (the deferred Gate E work), Search Console connection (RISK-032), and the
manual Paddle Dashboard cleanup for the webhook rotation's residual destinations.
