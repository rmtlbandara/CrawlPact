# Phase 19 Post-Launch Handoff

Status: current-authoritative, 2026-08-14. CrawlPact reached **GO WITH ACCEPTED NON-BLOCKING
RISKS** and is deployed to production as of this date
(`docs/release/PHASE_18_FINAL_GO_NO_GO_DECISION.md`). This document hands off everything that was
deliberately deferred, not fixed, or left for genuine post-launch ownership.

## 1. External commercial validation (deferred Gate E work)

The single largest deferred item. `docs/pilot/PHASE_17_OWNER_APPROVED_COMMERCIAL_VALIDATION_DEFERRAL.md`
records the owner's decision to launch before this was complete — it does **not** close the
underlying question. Real facts as of launch: 0 external pilot participants, 0 external paying
customers.

Phase 19 owns:

- Recruiting real external pilot participants (a manual, one-to-one product-owner action — no
  automation performs this).
- Using the already-built Phase 17 infrastructure (`pilot_cohorts`/`pilot_participants`/
  `pilot_feedback`, the `/admin/pilots` workspace, activation/monitoring/paid-conversion metrics)
  to actually observe real external usage once participants exist.
- Revisiting `docs/pilot/PHASE_17_COMMERCIAL_VALIDATION_DECISION.md`'s verdict once real evidence
  exists, rather than leaving it "insufficient evidence" indefinitely.
- Never describing CrawlPact as "commercially validated" until this is genuinely true.

## 2. RISK-032 — Search Console (reclassified POST-LAUNCH)

No Google-authenticated tool was available in any session to date to connect or verify a Search
Console property for `crawlpact.com`. This was honestly reclassified from a pre-launch CONDITION
to POST-LAUNCH rather than blocked on indefinitely or faked.

Phase 19 owns: connecting a real Search Console property (requires either a Google-authenticated
MCP/API tool or the product owner performing the verification manually via the Dashboard/DNS TXT
record), then checking indexation status for the Phase 7 `/for/*` and `/platforms/*` pages.

## 3. Paddle webhook rotation residue (RISK-002 cleanup) — resolved, no action needed

The rotation is complete and verified (`docs/security/PADDLE_WEBHOOK_SECRET_ROTATION_2026_08.md`).
The expected manual Dashboard cleanup turned out to be unnecessary: a direct check of the Paddle
Dashboard on 2026-08-14 showed Paddle had already auto-deactivated the old destination
(`ntfset_01kyfkc59d8h66prnhw220hnzy`) and the two stray destinations
(`ntfset_01kzzkm7yw1kww7pdp36wp2wg8`, `ntfset_01kzzmepmh2awqh7ce7gvg7yag`) when the new one was
created against the same URL — only `ntfset_01kzzmrf732n7y759nrnth7dnw` is `Active`. No log noise,
no manual step required. The 3 inactive rows can be deleted for tidiness whenever convenient, but
this is cosmetic, not functional.

Still worth filing with Paddle or re-testing periodically: the underlying MCP tool bug (any
`notificationSettings`/`simulations` call needing a resource ID in the URL path fails with
"URL called is invalid") — reported twice via `paddle:report_missing_tool` this session but not
independently confirmed fixed. It didn't end up mattering for this rotation's outcome, but would
block a future one.

## 4. RISK-033 — preview-environment Lighthouse budget failures

`deploy-preview.yml`'s Lighthouse check has now failed identically on two unrelated commits
(the prior baseline `352a4f8` and this release's `d25fe4f`): performance score 82 (threshold 85),
LCP ~4980ms (threshold 3000ms). Since this reproduces on commits with no frontend changes between
them, it's likely an environment/cold-start characteristic of the preview Worker or CI runner
network conditions rather than a real page-weight regression — production's own Lighthouse
evidence (Phase 11: 94-99 score, 1,579-2,940ms LCP) remains the evidence of record for real user
experience. Phase 19 should either: (a) investigate why preview specifically underperforms
production so consistently, or (b) adjust the preview budget thresholds to reflect the preview
environment's real baseline characteristics rather than reusing production's thresholds
unmodified.

## 5. Accepted risks carried forward unchanged

Everything in `docs/risks/ACTIVE_RISKS.md` marked ACCEPTED (RISK-003, 007, 008, 011, 013, 014,
015, 017, 022, 023, 025, 026, 027, 029, 030, 035) remains exactly as documented — no new
information this pass changed any of their risk calculus. Re-review each at its own stated
trigger/review date, not on a fixed Phase 19 schedule.

## 6. What Phase 19 does NOT need to re-litigate

- The Phase 17/18 governance decision itself (external validation deferred) — this is settled
  unless the product owner explicitly revisits it.
- RISK-002, RISK-006, RISK-018 — genuinely closed with real evidence, archived as ARC-035/036/037.
  Do not reopen without new contradicting evidence.
- Gate E/F's revised definitions in `docs/roadmap/CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md` —
  both now satisfied under their recorded, superseded/current definitions.
