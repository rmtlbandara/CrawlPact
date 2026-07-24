# Visual QA Matrix

Manual + automated visual QA tracking for SRS §10.56. Columns marked "Automated" are covered by
`playwright.visual.config.ts` projects; "Manual" items require a human pass (tracked here so
the check isn't lost between sessions).

| Breakpoint | Automated config                                | Manual pass performed (Part 1) |
| ---------: | ----------------------------------------------- | ------------------------------ |
|      360px | `mobile-360` project                            | ✅                             |
|      390px | `mobile-390` project                            | ✅                             |
|      480px | `mobile-480` project                            | ✅                             |
|      768px | `tablet-768` project                            | ✅                             |
|     1024px | `desktop-1024` project                          | ✅                             |
|     1280px | `desktop-1280` project                          | ✅                             |
|     1440px | `desktop-3xl` project (`desktop-1440` viewport) | ✅                             |

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

## Visual regression baseline (Part 2 Step 20; expanded Part 3 Step 18)

`apps/web/tests/visual/core-pages.spec.ts` snapshots 13 routes — one per distinct page
template (`/`, `/about`, `/audit`, `/pricing`, `/crawlers`, `/crawlers/gptbot`, `/guides`,
`/guides/[slug]`, `/tools`, `/tools/[tool]`, `/methodology`, `/changelog`, and the 404 page) —
across all seven required breakpoints (91 snapshots total), fulfilling SRS §10.57 item 16
("core pages pass visual regression tests"). Baselines are committed under
`apps/web/tests/visual/core-pages.spec.ts-snapshots/`. Run via `pnpm test:visual`; a real
visual diff fails the run, a baseline-only diff (new route/breakpoint) writes a new snapshot
that must be reviewed and committed deliberately, not accepted blindly — Part 3 Step 18's
regeneration was reviewed by inspecting an actual diff image before regenerating (breadcrumb
addition, corrected source-date text, and the new footer "About" link — all intentional Step
13/16 changes, not regressions).

Not yet covered: authenticated `/app/*` and `/admin/*` pages (would need a seeded session in the
Playwright context) and the completed-scan report page (`/audit/[auditId]` only renders the
disabled-engine state in this environment's CI-parity config, since `AUDIT_ENGINE_ENABLED=false`
matches production's current default) — tracked as follow-up. The public marketing/audit/guide/
crawler/tool surface (now 13 templates) is the highest-traffic, most launch-sensitive area and is
fully covered.
