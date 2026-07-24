# Design System

Tokens live in `packages/ui/src/tokens/tokens.css` as a Tailwind CSS v4 `@theme` block — that
file is the single source of visual truth (ADR-0003). This document explains the mapping and
the decisions behind it.

## Typography

Native system font stacks (`--font-sans`, `--font-mono`), not a webfont. SRS §10.7 lists this
as one of the acceptable options; it was chosen specifically to avoid a third-party font
request on the critical path of the hero audit form (SRS §9.22: load the primary audit form
without waiting on nonessential scripts/requests).

## Spacing

**No custom spacing tokens exist** — Tailwind v4's default spacing scale (0.25rem / 4px steps)
is numerically identical to the SRS §10.8 spacing table:

| SRS token  | Value | Tailwind utility          |
| ---------- | ----: | ------------------------- |
| `space-1`  |   4px | `1` (e.g. `p-1`, `gap-1`) |
| `space-2`  |   8px | `2`                       |
| `space-3`  |  12px | `3`                       |
| `space-4`  |  16px | `4`                       |
| `space-5`  |  20px | `5`                       |
| `space-6`  |  24px | `6`                       |
| `space-8`  |  32px | `8`                       |
| `space-10` |  40px | `10`                      |
| `space-12` |  48px | `12`                      |
| `space-16` |  64px | `16`                      |
| `space-20` |  80px | `20`                      |
| `space-24` |  96px | `24`                      |

The same identity holds for icon sizing (SRS §10.11): `size-4`/`size-5`/`size-6` already produce
16/20/24px.

## Colour, radius, shadow, z-index, motion, breakpoints, containers

Declared as custom `@theme` values in `tokens.css`, matching the SRS tables in §10.5, §10.9,
§10.10, §10.14, §10.45 exactly. See that file for the authoritative values — they are not
duplicated here to avoid the two drifting apart.

## Monorepo content scanning

`apps/web/src/styles/global.css` imports `tokens.css` and adds an explicit
`@source "../../../../packages/ui/src"` directive so Tailwind's utility scanner covers
`packages/ui` even though it lives outside `apps/web`.

## Dark theme

Not implemented (SRS §10.4: MVP is light-theme only). Because all colour usage goes through
semantic tokens rather than literals, a future dark theme is a token-file change, not a
component rewrite.
