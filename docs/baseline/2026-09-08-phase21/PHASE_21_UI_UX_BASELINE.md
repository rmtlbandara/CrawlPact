# Phase 21 UI/UX Baseline

## Methodology

1. Read the existing design-system, responsive, and accessibility documentation
   (`docs/design/DESIGN_SYSTEM.md`, `RESPONSIVE_BEHAVIOUR.md`, `ACCESSIBILITY_REQUIREMENTS.md`,
   `UX_FLOWS.md`) and the current `docs/risks/ACTIVE_RISKS.md` for any already-tracked, still-open
   UX debt, to avoid re-discovering (or contradicting) what's already known and accepted.
2. Read the existing automated coverage (`apps/web/tests/e2e/responsive-smoke.spec.ts`,
   `apps/web/tests/a11y/home.spec.ts`, `apps/web/tests/a11y/forced-colors-and-zoom.spec.ts`) to
   understand what's already continuously verified, so this pass could focus on what isn't.
3. Started a local `astro dev` server against the current `main` branch and used a scripted
   Playwright session (headless Chromium) to capture full-page screenshots of one representative
   route per distinct page template, at 360/768/1280px:
   - Public/marketing: `/`, `/pricing/`, `/audit/`, `/sample-report/`, `/sign-in`,
     `/crawlers/gptbot/`, `/guides/`, `/for/agencies/`, `/status/`, `/tools/`.
   - Customer app (real authenticated session via Playwright's existing `setup-customer` fixture
     project — a real registered fixture account, not a mock): `/app`, `/app/workspace`,
     `/app/domains`, `/app/groups`, `/app/notifications`, `/app/billing`, `/app/account`.
   - Super Admin (real authenticated session via `setup-admin`): `/admin`, `/admin/operations`,
     `/admin/users`, `/admin/domains`, `/admin/settings`.
4. Visually reviewed every screenshot for real defects (overflow, crowding, unreadable text,
   broken states) — not a pixel-diff comparison against any baseline (ADR-0008 still applies; no
   pixel-regression tooling was reintroduced).
5. For each visual anomaly, traced it to source and confirmed it with a concrete DOM measurement
   (element width/height, `scrollWidth` vs `clientWidth`) rather than judging by eye alone — see
   `UX_FINDING_REGISTER.md` for the exact numbers behind each finding.
6. Fixed each confirmed finding, then re-measured to prove the fix, then extended the relevant
   automated test file with a regression test for the specific defect (not a generic snapshot).

## What was found (summary — see UX_FINDING_REGISTER.md for full detail)

Three real, verified defects, all in the shared component layer used across most of the customer
app and Super Admin surfaces (meaning each fix improves every page that inherits from it, not just
the one page it was discovered on):

1. `DataTable`'s long, unbroken monospace identifier columns (setting keys, user IDs, tokens) had
   no `break-all`, letting them force a disproportionate share of the table's width at narrower
   viewports and squeeze a neighbouring prose column into a many-line wrap — confirmed on
   `/admin/settings` at 768px: first data row 216.5px tall (vs. ~50px normal).
2. The Super Admin header's "Back to public site" link had no responsive treatment at all (every
   other header element had already been fixed for this in earlier phases — see the header's own
   code comments referencing a 2026-07-30 fix for the exact same class of bug on sibling
   elements) — this one was simply missed in that earlier sweep.
3. Both the Super Admin and customer-app headers rendered `displayName` with no width bound,
   meaning an unusually long name (confirmed with the real fixture account name
   `Fixture Admin 1788854323078-9d2dd7ee`) could crowd the header row into overflow or wrap.
4. The customer-app session list on `/app/account` rendered a raw `navigator.userAgent` string
   verbatim (5+ lines of technical text on mobile) instead of a human-readable summary.

Also investigated and **ruled out** as a false positive: the Google Sign-In button on `/sign-in`
rendering non-English text ("Google සම්භින් වන්න") in this Sinhala-locale development
environment — traced to Google's own official GIS `renderButton` widget, which auto-localises to
the visitor's browser locale by design; not CrawlPact code, not a defect.

## Tooling note

Screenshots were captured with an ad-hoc, uncommitted Playwright script run directly against
`localhost:4321` (deleted after use) — not added as a permanent test artifact or a new pixel-diff
suite, consistent with ADR-0008. The only durable additions from this investigation are the code
fixes themselves and the new regression test in `responsive-smoke.spec.ts` (a measured DOM
assertion, not a screenshot comparison).
