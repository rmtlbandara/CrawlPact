# Phase 23 Product-Led Distribution Review

## Free tools (Section 28)

Reviewed `/tools/robots-txt-ai-validator/` (the highest-traffic tool) and confirmed the other four
share the same `AuditForm`-based pattern. Current state: no copy-result, no copy-tool-URL, no
share affordance, no bookmark-friendly result state exists on any free tool page today.

**Decision: no code change made this phase.** Reasoning:

- Section 32's product-led distribution principle is explicit: "Every growth loop should begin
  with a user obtaining value... do not place growth mechanics before user value." Current GA4
  evidence (`AUTHORITY_AND_DISTRIBUTION_BASELINE.md`) shows the tools receive essentially zero
  distinguishable organic traffic today (7 total GA4 active users in 28 days, owner/test
  contaminated). Building a share affordance for an audience that isn't yet arriving would be
  exactly the "growth mechanics before user value" anti-pattern the phase warns against.
- Section 28 itself frames these as "possible improvements only when justified" — not a mandate.
  No justifying evidence (a real user asking for it, a real distribution channel that would
  benefit from it) exists yet.
- Recorded as a `READY` backlog item in `GROWTH_EXPERIMENT_REGISTER.md`'s companion backlog
  (`GROWTH_CHANNEL_MATRIX.md`'s notes) for implementation once a specific distribution effort
  (e.g., a technical-community post linking the tool) creates a concrete reason to prioritize it.

## Shared reports (Sections 33-34)

`/shared/[token]` reports render inside `MarketingLayout.astro`, which already includes the full
site header (logo, product name) and footer (product description, links) — confirmed by reading
the page source this session. This already satisfies Section 34's requirement ("what CrawlPact is,
what generated the report, how the recipient can learn more") without any additional change.
Reports remain `noindex`, excluded from the sitemap, and are not used as a backlink mechanism —
verified unchanged from Phase 20's original design. **No change needed.**

## Widgets/embeds/badges (Sections 35-36)

CrawlPact does not currently have any embeddable widget, badge, or "Powered by CrawlPact" snippet.
No such feature was built this phase — none was requested, and Section 36's own framing ("brand
recognition, not distributed link equity") means this would need a real, specific collaboration
use case (e.g., an agency wanting to show a client-facing policy-status indicator) before it's
worth building. Recorded as `INVESTIGATE` in the growth backlog, not implemented.

## Referral/invitation loops (Section 37)

Not built. Per Section 37's own instruction ("First determine whether real users exist and
whether they naturally need to invite/share with others"): with 0 external users, there is no
evidence of a real collaboration need to serve. Building one now would be building for a
population that doesn't exist yet.

## Share-event measurement (Section 38)

Checked `docs/analytics/PRODUCT_EVENT_REGISTRY.md` before considering any new event, per the
section's own explicit instruction. Found existing, adequate coverage already in place:
`domain_share_started`, `report_shared`, `agency_report_share_created`,
`agency_report_share_revoked`. These already cover exactly the kind of privacy-safe share-event
measurement Section 38 asks for. **No new event added** — adding a near-duplicate (e.g.
`report_share_created`) would violate the same section's "do not create duplicate event aliases"
rule.

## Microsoft Clarity as product-led-distribution evidence (Sections 64-65)

Clarity remains Production-only, consent-gated, and scoped to the same public-marketing route
allowlist as GA4 (Phase 22). Not queried for qualitative UX evidence this phase — Clarity only
began collecting data after the Phase 22 production deployment (2026-09-08, the same day as this
baseline), so there has not yet been time to accumulate a meaningful session sample. Recorded as a
T+28 measurement item (`MEASUREMENT_AND_CADENCE.md`), not fabricated from an empty dataset.
