# Phase 21 Decisions

## Decision: scope this as a focused, evidence-verified pass rather than an exhaustive sweep

The Phase 21 prompt describes a whole-product UI/UX/responsiveness/conversion audit across every
surface, every state, every breakpoint of a product with 170+ routes. Attempting genuine,
individually-verified coverage of all of that in one session was not realistic without trading
away the rigor this project's culture requires (every finding backed by a real measurement, not a
guess — see `CLAUDE.md`'s rule against presenting anything unverified as a real outcome). Given
that trade-off, this phase prioritised: real visual inspection of one representative route per
distinct template, tracing every visual anomaly to a concrete DOM measurement before calling it a
defect, fixing what was found at the shared-component level (so the fix propagates to every page
built on that component, not just the one page it was noticed on), and being explicit in
`SURFACE_STATE_MATRIX.md`/`README.md` about exactly what wasn't individually reviewed — rather than
implying full coverage that didn't happen.

## Decision: fix at the shared-component layer, not the page layer

All three structural findings (DataTable row-height, header overflow, unbounded display-name
width) were fixed in `packages/ui/src/components/DataTable.tsx`, `AdminNav.astro`, and
`AppNav.astro` — the layout/component layer every admin and customer-app page inherits from —
rather than patched on the one page each was discovered on. This is consistent with how the
project's own 2026-07-30 fix for the sibling "Customer view" overflow bug was scoped, and it means
this phase's fixes protect every admin table and every app/admin page, not just
`/admin/settings`.

## Decision: no pixel-diff tooling reintroduced

ADR-0008 removed screenshot-based visual regression testing for good, project-specific reasons
(flakiness from font-rendering differences across CI runners). This phase used screenshots purely
as an investigative aid for a human/AI reviewer to look at once, then discarded them — the durable
test additions are functional DOM assertions (`responsive-smoke.spec.ts`'s new row-height check),
matching the pattern ADR-0008 established.

## Decision: no production deployment without a fresh, explicit authorization

Consistent with the Phase 21 prompt's own instruction and this project's standing rule
(`CLAUDE.md`: "Never deploy to production... without the user's explicit, in-the-moment
permission... even if a previous session was authorised — ask again"), this phase's changes are
validated up to Preview and the quality gate, and stop at a `READY_FOR_PRODUCTION_DEPLOYMENT`-class
verdict rather than deploying. See the completion report for the exact verdict and what deploying
would require.
