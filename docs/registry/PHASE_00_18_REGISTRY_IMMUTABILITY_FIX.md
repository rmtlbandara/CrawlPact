# Phase 0–18 Registry Immutability Fix (RISK-018)

Status: current-authoritative, 2026-08-14.

## The bug

`packages/database/seed/reference-data.sql`'s `registry_version_entries` insert for release
`reg_2026_07_3` selected membership dynamically:

```sql
FROM crawlers WHERE operator_id IN ('op_openai', 'op_anthropic', ...);
```

`INSERT OR IGNORE` only prevents re-inserting a crawler already in the release — it does not
prevent a _new_ crawler, added to `crawlers` under one of these 9 operators after the release was
published, from being silently inserted into this already-published, supposedly-immutable
release the next time this seed file ran.

## The fix

Replaced the dynamic operator-based `WHERE` with a fixed, explicit list of the 23 crawler IDs
that make up `reg_2026_07_3`'s actual, verified production membership — read directly from the
live `registry_version_entries` table on 2026-08-14, not inferred or guessed from the current
`crawlers` table. A future crawler, regardless of its operator, is now structurally invisible to
this INSERT.

## Regression test

`apps/web/tests/integration/registry-seed-immutability.integration.test.ts` applies the real
`reference-data.sql` file (quote-aware SQL statement splitting, since a crawler description
contains a literal semicolon inside a string value that a naive splitter breaks on), then adds a
new crawler under `op_openai` (one of the 9 previously-matched operators) and re-runs the seed
file. Confirmed:

- **Against the old implementation**: the release gained a 24th entry (the new crawler) — the
  test fails as designed.
- **Against the fixed implementation**: the release entry count, entry set, and checksum are all
  unchanged after re-running the seed with the new crawler present — the test passes.

## Production safety

This fix changes only _future_ seed-file behavior. `reg_2026_07_3`'s already-published entries in
production were read (not written) to derive the fixed id list, so applying this fix does not
alter anything currently live. No production migration or data change was required — only the
seed file's own logic.
