# Phase 21 Visual QA Manifest

## What was captured

Full-page Chromium screenshots at 360/768/1280px for the routes listed in
`SURFACE_STATE_MATRIX.md`, taken against a local `astro dev` server on `main` before any Phase 21
change, using an ad-hoc Node script driving `@playwright/test`'s `chromium.launch()` directly (not
a `*.spec.ts` test file). Authenticated surfaces used the repository's own existing
`setup-customer`/`setup-admin` Playwright fixture projects to reach a real signed-in session
(the same real fixture accounts `tests/e2e/helpers/fixture-accounts.ts` and the E2E suite already
rely on) — no mocked auth state.

## Why these aren't committed as repository assets

ADR-0008 removed pixel-by-pixel visual regression testing from this project specifically to avoid
flaky, environment-dependent screenshot-diffing (font rendering/anti-aliasing differences between
platforms). Committing these screenshots would risk them being mistaken for a regression baseline
by a future contributor, which this project has deliberately chosen not to maintain. They were
investigative tooling for this session only — inspected, then discarded (the ad-hoc capture
scripts were deleted from the repository root after use; nothing from this exercise was retained
except the actual code fixes and the new functional regression test in
`responsive-smoke.spec.ts`, which asserts a real measured DOM value rather than a screenshot).

## How to reproduce this pass

Start `pnpm --filter web dev`, run `npx playwright test --project=setup-customer
--project=setup-admin` once to populate `apps/web/tests/e2e/.auth/{customer,admin}.json`, then
drive `chromium.launch()` (or `chromium.launchPersistentContext`) against `localhost:4321` with
those storage states loaded — the same approach the existing `responsive-smoke.spec.ts` and
`home.spec.ts` suites already use for their own authenticated tests.
