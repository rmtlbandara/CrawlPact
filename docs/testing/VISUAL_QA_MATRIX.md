# Visual QA Matrix

Manual + automated visual QA tracking for SRS §10.56.

**Historical note (2026-07-29):** this document previously tracked a pixel-comparison Playwright
suite (`apps/web/tests/visual/**`, `playwright.visual.config.ts`). That suite was removed — see
`docs/architecture/adr/ADR-0008-remove-pixel-visual-regression.md` for the full evidence (it
failed ~9.5% of the time on a re-run of an identical, already-baselined commit, even after a
readiness-signal fix). SRS §10.57 item 16's intent ("core pages pass visual regression tests") is
now satisfied by `apps/web/tests/e2e/responsive-smoke.spec.ts` (deterministic functional
assertions — no horizontal overflow, key content reachable, mobile nav usable — at the three
breakpoints below) plus `pnpm ui:review` for on-demand manual screenshot review. The "Automated
config" column below is kept for historical reference to what was manually verified in Part 1; it
no longer refers to a runnable Playwright project.

| Breakpoint | Covered by responsive-smoke today | Manual pass performed (Part 1, historical) |
| ---------: | :-------------------------------: | ------------------------------------------ |
|      360px |                ✅                 | ✅                                         |
|      768px |                ✅                 | ✅                                         |
|     1280px |                ✅                 | ✅                                         |
|      390px |          — (manual only)          | ✅                                         |
|      480px |          — (manual only)          | ✅                                         |
|     1024px |          — (manual only)          | ✅                                         |
|     1440px |          — (manual only)          | ✅                                         |

## Content-driven checks (manual, Part 1 pass)

| Check                                | Result                                                                                                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Long domain names don't break layout | ✅ verified on `/crawlers/[slug]` and audit form                                                                                                                              |
| Long crawler names / URLs            | ✅ verified in crawler directory cards                                                                                                                                        |
| Empty data states                    | ✅ `EmptyState` component renders correctly at all breakpoints                                                                                                                |
| Error states                         | ✅ `ErrorState`/`/audit/[auditId]` disabled-state page checked                                                                                                                |
| Loading states                       | ✅ `Skeleton`/`DataTable` loading state checked in showcase                                                                                                                   |
| Browser zoom 200%                    | ✅ spot-checked on home page and audit page — no clipped content, focus rings remain visible                                                                                  |
| Reduced motion                       | ✅ `prefers-reduced-motion: reduce` verified globally via `tokens.css` rule; automated in `tests/a11y/home.spec.ts`                                                           |
| High contrast (forced colours)       | ⏳ Not yet performed — tracked in `docs/status/KNOWN_RISKS.md`                                                                                                                |
| Print output                         | ✅ real `.no-print` CSS + "Print report" button, verified by an automated print-media check (`tests/e2e/landing-page.spec.ts`), not just a visual spot-check (Part 3 Step 17) |

## Known responsive gap (disclosed, not fixed in this pass)

The customer dashboard and Super Admin shell navigation bars render every link inline with no
mobile-collapse equivalent to the public site's `MobileNav` — confirmed via
`responsive-smoke.spec.ts` to genuinely overflow horizontally at 360/768px (516px and 112px of
overflow respectively). See `docs/status/KNOWN_RISKS.md` for the full entry; out of scope for the
release-flow remediation that discovered it.
