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

Desktop: static horizontal nav (`SiteHeader.astro`, server-rendered, no JS). Mobile: a single
React island (`MobileNav.tsx`) renders a hamburger trigger and a `Drawer`-based menu — this is
one of only two client-side islands most marketing pages load (the other is the audit form),
in service of SRS §9.22's "minimise JavaScript".

The Super Admin shell's desktop sidebar (`AdminNav.astro`) is `hidden lg:flex` — below 1024px it
had no replacement at all until 2026-07-26, when `AdminMobileNav.tsx` (the same `Drawer`/
`IconButton` pattern as the public site's `MobileNav`) was added to the admin header.

## Tables

`DataTable` hides columns below configurable breakpoints (`hideBelow: "sm" | "md" | "lg"`) and
scrolls horizontally as a last resort, per SRS §10.22. No table in Part 1 has enough columns to
need this yet — it exists as a foundation for Part 3+'s domain/admin tables.

## Verification status

Automated checks: Playwright visual-regression config (`playwright.visual.config.ts`) covers
the seven SRS §10.56 breakpoints. Manual verification against real devices and 200% browser
zoom is tracked in `docs/testing/VISUAL_QA_MATRIX.md` and was performed against the built
preview during Part 1's quality gate (see `docs/status/IMPLEMENTATION_STATUS.md`).
