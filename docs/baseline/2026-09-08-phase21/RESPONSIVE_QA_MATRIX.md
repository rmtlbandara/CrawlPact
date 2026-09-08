# Phase 21 Responsive QA Matrix

## Breakpoints checked

360 / 768 / 1280px (screenshots, this phase) plus the pre-existing automated coverage at
360/768/1280/1440/1920px (`responsive-smoke.spec.ts`) and the 320px WCAG reflow check
(`forced-colors-and-zoom.spec.ts`, 400% zoom on a 1280px viewport).

## Result after fixes

- `pnpm exec playwright test apps/web/tests/e2e/responsive-smoke.spec.ts --project=chromium`:
  **44/44 passed**, including the new row-height regression test added this phase.
- `document.documentElement.scrollWidth` vs `clientWidth` measured directly (not just via the
  test's own assertion) on `/admin/settings` and `/app/billing` at 360/768/1024/1280px after the
  header fixes: **zero overflow at every width** (`scrollWidth === clientWidth` exactly in all 7
  measurements taken).

## Real defects found this phase

See `UX_FINDING_REGISTER.md` FINDING-01 through FINDING-03. Both were specific to the 768px
("lg" in this project's remapped scale) breakpoint — the point at which the Super Admin sidebar
first appears and several header/table elements that were hidden below it all become visible
simultaneously, and the point at which several `hideBelow: "lg"` table columns turn on at once.
This matches the project's own history: `docs/design/RESPONSIVE_BEHAVIOUR.md` already documents
two earlier, distinct bugs at exactly this same breakpoint (the `AppNav`/`AdminNav` desktop-nav
overflow, fixed 2026-07-30). 768px is evidently the highest-risk breakpoint in this design system
specifically because it's the one boundary where the most simultaneous reveals happen — worth
extra scrutiny on any future admin/app UI change that adds a new `hideBelow: "lg"` column or a new
always-two-sided header element.

## Not re-verified this phase (pre-existing, unchanged)

- 200% browser zoom on every page (tracked as an open gap since Phase 3/4;
  `ACCESSIBILITY_REQUIREMENTS.md` "Known gaps").
- Real physical devices (`docs/testing/VISUAL_QA_MATRIX.md`).
