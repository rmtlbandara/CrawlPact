---
Document owner: Engineering owner
Status: current-authoritative (Phase 1, Workstream K)
---

# Registry-version string consistency check — 2026-09-17

The Phase 1 directive (§15/§16) cited a specific known issue: "the governed active crawler
registry was documented as `2026.07.3`, while at least one homepage/demo/sample representation
appeared to expose an older registry label such as `2026.07.1`." Per §1 ("Verify, Do Not Blindly
Trust"), this was checked directly against current code rather than assumed still true or "fixed"
reflexively.

## Result: not currently reproducible

- `apps/web/src/lib/sample-report.fixture.ts` (feeds the homepage's `SampleReportSection.astro`
  and `/sample-report/`): `registryVersion: "2026.07.3"` — correct, matches the live governed
  release confirmed via a direct D1 read (see `GIT_AND_REPOSITORY_RECONCILIATION.md`).
- `apps/web/src/lib/trust-config.ts` (feeds `BaseLayout.astro` and the legal/trust pages):
  `registryVersion: "2026.07.3"` — also correct.

Neither public-facing surface currently shows a stale registry version. This issue appears to have
already been fixed in an earlier phase (most likely Phase 21's UI/UX audit or Phase 22/23) before
this session started — it is not something this pass needed to fix, and nothing was changed here.

## One unrelated near-miss, deliberately not "fixed"

`trust-config.ts` and `sample-report.fixture.ts` both also set a separate field, `rulesetVersion:
"2026.07.2"`. This looks superficially like the same kind of stale-version string, but it is a
different governed artifact entirely — the crawler **ruleset** release (see `/admin/registry/
rulesets`), not the crawler **registry** release. Checked against
`packages/database/seed/reference-data.sql`: the active ruleset row is `rules_2026_07_2`,
`'2026.07.2'` — so `2026.07.2` is currently correct for that field, not stale. No change made.

## One genuinely stale value, deliberately left alone

`apps/web/src/components/ComponentShowcase.tsx:295` hardcodes `{ label: "Registry version", value:
"2026.07.1" }`. This is real, but it is a static example prop on `/dev/components`, an internal,
non-indexed component style-guide page — not real audit output, not customer-facing, and not the
kind of "current audit using stale crawler data" impression §15 is concerned about. Left unchanged;
flagged here only for completeness rather than silently ignored.
