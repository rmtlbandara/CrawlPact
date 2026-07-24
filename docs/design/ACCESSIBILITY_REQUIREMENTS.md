# Accessibility Requirements

Target: WCAG 2.2 AA (SRS §9.23, §33). This document lists concrete, checkable requirements and
where each is enforced.

| Requirement                    | Enforcement                                                                                                                                                                                                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keyboard-accessible navigation | `SiteHeader.astro` nav is plain `<a>`/`<button>`; `MobileNav` uses Radix `Dialog` (focus trap, Escape)                                                                                                                                                                                            |
| Skip-to-content link           | `BaseLayout.astro` renders a visible-on-focus skip link; its target (`#main-content`) carries `tabindex="-1"` (Part 3 Step 17 fix — previously present but not actually focusable) so activating it really moves keyboard focus, not just scroll position                                         |
| Visible focus states           | Every interactive component in `packages/ui` includes a `focus-visible:outline` rule                                                                                                                                                                                                              |
| Sufficient colour contrast     | Token palette chosen to meet AA; verified via automated axe scans (`tests/a11y`)                                                                                                                                                                                                                  |
| Semantic headings              | One `<h1>` per page; section headings follow document order; enforced by `tests/e2e/seo-metadata.spec.ts`                                                                                                                                                                                         |
| Accessible error messages      | `FormField` wires `role="alert"` + `aria-describedby` + `aria-invalid`                                                                                                                                                                                                                            |
| Toast announcements            | `Toast` renders inside an `aria-live="polite"` region                                                                                                                                                                                                                                             |
| No colour-only status          | `StatusChip`/`Alert` always render a text label alongside colour                                                                                                                                                                                                                                  |
| Reduced-motion support         | Global `prefers-reduced-motion` rule in `tokens.css` disables animation/transition duration                                                                                                                                                                                                       |
| Descriptive links              | Copy review: no bare "click here" links in authored content                                                                                                                                                                                                                                       |
| Accessible tables/accordions   | `DataTable` uses semantic `<table>`/`<th scope>`; `Accordion` uses Radix's ARIA accordion pattern                                                                                                                                                                                                 |
| Landmarks                      | `<header>`/`<main>`/`<footer>` on every marketing page; breadcrumb `<nav>` carries `aria-label="Breadcrumb"` (Part 3 Step 16)                                                                                                                                                                     |
| Print support                  | `.no-print` utility (global.css) hides header/footer/breadcrumbs/interactive controls under `@media print`; `AuditReportView` has a real "Print report" button — closes the gap where `plans.printReadyReportTier` was a real entitlement with no actual print feature behind it (Part 3 Step 17) |

## Automated testing

- `pnpm test:a11y` runs `apps/web/tests/a11y/home.spec.ts`: axe-core (`@axe-core/playwright`)
  against 22 representative routes (one per distinct page template — home, about, crawler
  index/detail, guide index/detail, tool index/detail, every legal/status/methodology page,
  sign-in, and the 404 page), asserting zero WCAG 2.2 AA violations, plus reduced-motion,
  skip-link-focus, and breadcrumb-landmark checks (Part 3 Step 17).
- `tests/e2e/seo-metadata.spec.ts` (Part 3 Step 16) checks every page listed in the live
  `/sitemap.xml` for exactly one `<h1>`.
- `tests/e2e/landing-page.spec.ts` includes a print-media check confirming site chrome
  (`header`/`footer`) is actually hidden under `@media print`.

## Known gaps

- No screen-reader manual walkthrough has been performed yet (tracked in
  `docs/status/KNOWN_RISKS.md`) — automated axe scans catch a meaningful subset of issues but
  not all of them (e.g. reading order, meaningful announcement of dynamic content).
- High-contrast mode (Windows forced-colours) has not been manually verified.
- 200% browser zoom has not been manually verified on every page (tracked for Part 3 Step 18's
  visual/responsive pass, which covers breakpoints and zoom together).
