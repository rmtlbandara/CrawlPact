# Phase 21 Accessibility Audit

No new accessibility defects were targeted this phase (none of the four findings in
`UX_FINDING_REGISTER.md` are WCAG violations — they are layout/readability issues), but every
change was verified not to regress the existing automated a11y coverage, and the User-Agent
summary fix (FINDING-04) is itself a readability improvement for screen-reader users who would
otherwise have the entire raw UA string read aloud.

## Suites run against the changed code

- `pnpm exec playwright test --config=playwright.a11y.config.ts --project=chromium -g "Super
Admin|authenticated"`: **6 passed, 1 failed** (the "real saved-domain detail page" test, which
  requires a real completed scan against the `e2e-fixture.crawlpact.com` fixture domain — this
  failed on a `page.waitForURL` timeout waiting for the scan to complete, consistent with this
  local session's `AUDIT_ENGINE_ENABLED` not being enabled via a local `.env` file, which is an
  environment-configuration gap in this session and not something this phase's changes touch or
  could have caused — no code in the scanning/audit pipeline was modified). This is the same class
  of environment limitation Phase 20 encountered and documented; CI carries the real secrets this
  needs and is the authoritative gate.
- `pnpm run test:unit` (531 tests, including the 6 new `user-agent-summary.test.ts` tests): **all
  passed**.
- `pnpm run lint`, `pnpm run typecheck`, `pnpm run format:check`: **all clean**.

## Known gaps (unchanged from `docs/design/ACCESSIBILITY_REQUIREMENTS.md`)

- No manual screen-reader walkthrough performed.
- High-contrast/forced-colours mode verified only via the existing automated
  `forced-colors-and-zoom.spec.ts` suite (not re-run against the specific admin pages touched this
  phase, since none of this phase's CSS changes touch focus-ring or colour logic — only layout
  width/truncation/wrap behaviour).
- 200% zoom not manually verified on every page.
