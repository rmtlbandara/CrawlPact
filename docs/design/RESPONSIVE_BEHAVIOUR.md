# Responsive Behaviour

## Breakpoints (SRS §10.14, tokens.css)

| Name          |  Width | Tailwind prefix |
| ------------- | -----: | --------------- |
| Small mobile  |  360px | `xs:`           |
| Mobile        |  480px | `sm:`           |
| Large mobile  |  640px | `md:`           |
| Tablet        |  768px | `lg:`           |
| Small desktop | 1024px | `xl:`           |
| Desktop       | 1280px | `2xl:`          |
| Wide desktop  | 1440px | `3xl:`          |

Note these Tailwind prefix names are remapped from Tailwind's own defaults to match the SRS's
named breakpoints exactly (see `tokens.css` `--breakpoint-*`) — components should reason in
SRS terms, not Tailwind's default `sm/md/lg` meanings.

## Marketing pages

Single-column mobile layout; max content width `1200px` (`--container-marketing`) above
desktop breakpoints, per SRS §10.14.

## Navigation

Desktop: static horizontal nav (`SiteHeader.astro`, server-rendered, no JS), switching to
`MobileNav.tsx` below `xl:` (1024px) — moved from `md:` (640px) 2026-07-30 after a real,
Playwright-confirmed overflow bug (the desktop nav didn't fit at either 640px or 768px; see
`docs/status/KNOWN_RISKS.md`). Mobile: a single React island (`MobileNav.tsx`) renders a hamburger
trigger and a `Drawer`-based menu — this is one of only two client-side islands most marketing
pages load (the other is the audit form), in service of SRS §9.22's "minimise JavaScript".

The customer dashboard (`AppNav.astro`) follows the identical pattern via `AppMobileNav.tsx`
(added 2026-07-30, same `Drawer`/`IconButton` primitives) below `xl:`.

The Super Admin shell's desktop sidebar (`AdminNav.astro`) is `hidden lg:flex` — `lg:` in this
project's remapped scale is **768px**, not Tailwind's stock 1024px. Below that width it had no
replacement at all until 2026-07-26, when `AdminMobileNav.tsx` (the same `Drawer`/`IconButton`
pattern) was added to the admin header — that fixed the sidebar's own links, but a separate bug
in the header bar surrounding it (the "Customer view" link and display name rendering
unconditionally, with no responsive treatment) still overflowed at 360/768px until fixed
2026-07-30 (icon-only "Customer view" below `xl:`, display name hidden below `sm:`).

## Tables

`DataTable` hides columns below configurable breakpoints (`hideBelow: "sm" | "md" | "lg"`) and
scrolls horizontally as a last resort, per SRS §10.22. No table in Part 1 has enough columns to
need this yet — it exists as a foundation for Part 3+'s domain/admin tables.

## Verification status

Automated checks: `apps/web/tests/e2e/responsive-smoke.spec.ts` asserts real functional behaviour
(no horizontal overflow, key content reachable, mobile nav usable) at the three SRS breakpoints
(360/768/1280px) as part of the required E2E gate — replacing the pixel-comparison
`playwright.visual.config.ts` suite removed 2026-07-29 (see
`docs/architecture/adr/ADR-0008-remove-pixel-visual-regression.md`). Manual verification against
real devices and 200% browser zoom is tracked in `docs/testing/VISUAL_QA_MATRIX.md` and was
performed against the built preview during Part 1's quality gate (see
`docs/status/IMPLEMENTATION_STATUS.md`).
