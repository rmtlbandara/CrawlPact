---
name: quality-gate
description: Run CrawlPact's full non-destructive local quality gate (format, lint, typecheck, unit+integration tests, db:validate, build) and report results plainly.
---

# Quality Gate

Run this before claiming any non-trivial change is done. It is entirely non-destructive — it
never deploys, never touches a remote database, and never pushes anything.

## Steps

1. Run `pnpm format:check`. If it fails, run `pnpm format` and re-check — do not silently
   accept unformatted code.
2. Run `pnpm lint`. Fix reported issues; do not add lint-disable comments to silence a real
   problem.
3. Run `pnpm typecheck`. Every package must pass — this fans out via `pnpm -r`.
4. Run `pnpm test:unit`.
5. Run `pnpm test:integration`.
6. Run `pnpm db:validate` (drift check between SQL migrations and the Drizzle schema mirror).
7. Run `pnpm build`.
8. If any UI route changed, also run `pnpm test:a11y` (requires the dev server or a preview
   build running — start one if needed).

## Reporting

Report exact pass/fail for each step, not a summary like "all good." If something fails,
show the actual error output and either fix it or explain why it's out of scope for the current
change — never mark a step as passed without having actually run it this session.

## When to also run test:e2e / test:visual

`test:e2e` for any change touching a page's structure or the audit form. `test:visual` only
when a baseline already exists to compare against (see `docs/testing/VISUAL_QA_MATRIX.md` for
current baseline status) — running it before a baseline exists just creates one, it doesn't
verify anything.
