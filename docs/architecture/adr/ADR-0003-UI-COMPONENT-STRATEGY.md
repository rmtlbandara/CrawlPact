# ADR-0003: UI Component Strategy

**Status:** Accepted
**Date:** 2026-07-22

## Context

SRS §10 requires one consistent, accessible component library covering ~35 component types,
each with documented default/hover/focus/active/disabled/loading/error states, keyboard
behaviour, and mobile behaviour, with a single accessible-primitive strategy (§10.53: "Choose
one accessible primitive strategy. Do not combine multiple overlapping component libraries.").

CrawlPact's interactive surfaces (forms, dialogs, menus, tabs, tables) are used both inside
Astro's static/SSR pages (as React islands) and will later back the authenticated dashboard
and Super Admin, which are more interaction-heavy. Building fully accessible primitives
(focus trapping, roving tabindex, WAI-ARIA patterns for combobox/menu/dialog) correctly from
scratch is a significant, easy-to-get-wrong effort that a solo founder should not repeat.

## Decision

- **UI primitives**: Radix UI (`@radix-ui/react-*`, scoped per-component packages) supplies
  unstyled, WAI-ARIA-compliant behaviour for Dialog, Popover, DropdownMenu, Tabs, Accordion,
  Tooltip, Switch, Checkbox, RadioGroup, and Select. This is the **only** headless primitive
  library used — no other overlapping library (e.g. Headless UI, Ariakit, React Aria) is
  introduced alongside it.
- **Styling**: Tailwind CSS, configured to read design tokens from
  `packages/ui/src/tokens/*` (colour, type, spacing, radius, shadow, z-index, motion,
  breakpoints, container widths, icon sizing) as the single source of visual truth (SRS
  §10.53). Components never hard-code colour/spacing literals.
- **Components without a meaningful accessibility pattern to delegate** (Button, IconButton,
  Link, Input, Textarea, FormField, StatusChip, Card, MetricCard, Alert, Banner, Toast,
  Skeleton, EmptyState, ErrorState, ProgressSteps, Breadcrumb, Pagination, CodeBlock,
  DiffViewer foundation, Score component foundation, DataTable foundation, SearchField,
  Combobox foundation) are implemented directly with semantic HTML and manual ARIA
  attributes where needed, rather than pulling in another library for a handful of native
  patterns.
- All components live in `packages/ui`, are framework-specific to **React** (used as Astro
  islands with `client:*` directives only where interactivity is required — most marketing
  content stays static HTML with zero JS).
- A dev-only **component showcase route** (`/dev/components`, excluded from production builds
  and from the sitemap/robots) renders every component in every documented state for manual
  and visual-regression QA.

## Alternatives Considered

1. **shadcn/ui** — a popular Radix+Tailwind convention, but it works by copy-pasting generated
   component source into the repo rather than being an installable dependency; that is
   compatible with this ADR's intent (Radix + Tailwind, one primitive strategy) and
   `packages/ui` follows the same shape without adopting the shadcn CLI, keeping dependency
   count minimal.
2. **Build every primitive from scratch** — rejected: high risk of subtly incorrect focus
   management and ARIA behaviour across ~10 interactive components, which directly
   contradicts SRS §10.48–§10.49's keyboard/screen-reader requirements.
3. **A full pre-built component suite (e.g. Chakra, Mantine)** — rejected: these bring their
   own styling engine and visual opinions that would fight the SRS's bespoke design tokens
   (§10.5–§10.13) and add far more surface area/bundle weight than needed.

## Consequences

- New interactive components should default to a Radix primitive when one exists for the
  pattern; introducing a second headless library requires a new ADR.
- Every component in `packages/ui` documents purpose, variants, sizes, states, accessibility
  behaviour, keyboard interaction, responsive behaviour, usage, and prohibited usage per
  SRS §10.54, in colocated `*.md` usage notes or in `docs/design/UI_COMPONENTS.md`.
