# Test Data Policy

## Rule

No test, seed file, or UI fixture may present fabricated data as if it were a real product
outcome. This is a project-wide rule (see `CLAUDE.md`/`AGENTS.md`), not just a testing
convention.

## What is allowed

- **Clearly labelled synthetic examples** — e.g. the landing page's report preview
  (`apps/web/src/components/ReportPreview.tsx`), which is visibly captioned "Illustrative
  example using a synthetic demonstration domain — not a real scan result."
- **Real, source-backed reference data** — the crawler registry seed
  (`packages/database/seed/seed.sql`) and content collection (`apps/web/src/content/
crawlers/*.md`) describe real, publicly documented crawlers (GPTBot, ClaudeBot, etc.) with
  real official source URLs. This is reference content about real crawlers, not fabricated
  customer or scan data.
- **Structurally valid but content-neutral test fixtures** — e.g. `example.com` as a test
  target in unit/e2e tests.

## What is never allowed

- A scan result, finding, or Policy Health Score presented as if it came from a real audit when
  no real scan occurred.
- Fake customer counts, testimonials, or company logos anywhere, including in tests that assert
  on landing-page copy (a test asserting such copy exists would itself be validating a
  violation).
- Seed data containing invented production metrics (revenue, user counts, etc.).

## Enforcement in Part 1

- `POST /api/audit` returns `AUDIT_ENGINE_DISABLED` while the scanner is off — verified by
  `apps/web/tests/integration/audit-api.integration.test.ts` and
  `apps/web/tests/e2e/landing-page.spec.ts`.
- The Super Admin dev fixture (`usr_dev_super_admin`) is clearly named as a local dev fixture,
  has no email field to fabricate, and only exists in the `--local` seed target, never applied
  to preview/production.
