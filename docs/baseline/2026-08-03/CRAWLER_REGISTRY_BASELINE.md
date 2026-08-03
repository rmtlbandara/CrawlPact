# Crawler Registry Baseline — 2026-08-03

Phase 0 baseline. Read-only inspection of `packages/database/migrations/0004_registry.sql` and
`0009_registry_active_pointer.sql`, `packages/database/seed/{reference-data.sql,seed.sql}`,
`packages/registry/src/*.ts`, `scripts/registry-tools.mjs`, `apps/web/src/lib/admin/registry.ts`,
`apps/web/src/pages/{crawlers,admin/registry}/**`, `apps/web/src/content/crawlers/*.md`,
`docs/registry/{SOURCE_VERIFICATION_POLICY.md,CRAWLER_REGISTRY_GOVERNANCE.md}`. No crawler entry
was added, removed, or reclassified.

## 1. Registry locations (three distinct sources, different purposes)

1. **Database** (source of truth for scan evaluation): schema in `0004_registry.sql` +
   `0009_registry_active_pointer.sql`; real data in `packages/database/seed/reference-data.sql`
   (production-safe); Drizzle mirror `packages/database/src/schema/registry.ts`.
2. **Shared vocabulary package**: `packages/registry/src/{index.ts,types.ts,purpose.ts}` —
   purpose/lifecycle enum + label/description copy, imported by both marketing and (per its own
   comment) future admin surfaces specifically so copy never drifts between them.
3. **Public content collection**: `apps/web/src/content/crawlers/*.md` (22 files) — an
   **independent** source from the `crawlers` D1 table, rendered by
   `apps/web/src/pages/crawlers/{index,[slug]}.astro` via Astro's content collections.

## 2. Registry version/hash mechanism

- **Version label**: human string (e.g. `"2026.07.3"`), UNIQUE.
- **Active pointer**: `is_active` boolean, enforced to at most one `TRUE` row per table by a
  SQLite partial unique index (migration 0009) — a database-level guarantee.
- **Snapshot**: `registry_version_entries.snapshot` is a JSON blob frozen at publish time, so a
  historical scan's evidence never changes even if the live `crawlers` row is later edited.
- **Integrity checksum**: `scripts/registry-tools.mjs checksum <versionId>` computes SHA-256 over
  sorted `crawler_id:snapshot` pairs for a release — run manually, not automated/scheduled.

## 3. Crawler entries and operators

**23 crawlers across 9 operators** in the seed data (confirmed by direct primary-key count) — not
"21 crawlers / 9 operators" as literally stated in `docs/registry/CRAWLER_REGISTRY_GOVERNANCE.md:39`
and `docs/registry/SOURCE_VERIFICATION_POLICY.md:10`. That governance document **contradicts
itself**: it states "21 crawlers" at one point but its own "correction pending publication" note
elsewhere says the corrected total is "23 crawlers total" — the seed data already matches the
higher, corrected number. Logged in `DOCUMENTATION_CONFLICTS.md`.

Operators: OpenAI, Anthropic, Perplexity AI, Google, Common Crawl Foundation, Apple, Meta, Amazon,
Microsoft (9, confirmed).

## 4. Supported purpose categories and lifecycle statuses

8 purpose values, `CHECK`-constrained at the database level and mirrored in
`packages/registry/src/purpose.ts`: `search`, `training`, `user_triggered`, `agent`,
`advertising_validation`, `research`, `mixed`, `unknown` (the last explicitly supports uncertain
classification — see §7).

5 lifecycle statuses: `active`, `deprecated`, `replaced`, `unverified`, `retired`. Default on
insert is `unverified` — `createCrawlerDraft` (`apps/web/src/lib/admin/registry.ts:51-71`) always
inserts new crawlers as `unverified`, citing FR-REG-005: nothing is presented as an active policy
signal without explicit verification.

## 5. Source and verification-date requirements

Per `docs/registry/SOURCE_VERIFICATION_POLICY.md`: every crawler must cite `official_source_url`
pointing at the operator's own documentation (third-party aggregators/blogs explicitly rejected).
`last_verified_at` reflects a manual check-against-source date, explicitly not a claim of ongoing
automated monitoring (no such monitoring exists).

## 6. Registry validation commands

- **`pnpm registry:validate`** — runs 5 checks against **local D1 only** (hardcoded
  `--local` flag in `registry-tools.mjs`, explicitly documented as "never remote — a
  development/CI tool, not a production migration path"): duplicate tokens
  (case-**insensitive**), missing source URL, active-but-unverified crawlers, staleness (>180
  days since verification), and "more than one active registry version" (a should-be-impossible
  sanity-check backstop for the DB-level partial unique index). **Not executed this session**
  (requires a live local D1 instance).
- **`pnpm registry:checksum <versionId>`** — tamper-evidence SHA-256, described in §2.
- **`pnpm registry:changelog <fromId> <toId>`** — added/removed/changed crawler diff between two
  releases; the same diff logic is separately ported into the admin UI's backend
  (`compareRegistryVersions`, `apps/web/src/lib/admin/registry.ts:210-246`).

### 6.1 Duplicate-token protection gap (new finding)

The database enforces a **case-sensitive** unique index on `user_agent_token`
(`idx_crawlers_user_agent_token`), while `registry-tools.mjs validate`'s duplicate check is
**case-insensitive** (`GROUP BY LOWER(user_agent_token)`). Two tokens differing only by case could
pass the DB constraint while being flagged by the CLI tool — a real, narrow inconsistency between
what the database allows and what the validator checks for. Not confirmed as having actually
occurred in current data (all 23 tokens are distinct even case-insensitively). Logged in
`BASELINE_RISKS_AND_UNKNOWNS.md`.

## 7. Uncertain-classification support

Fully supported: purpose `unknown` is used for `GoogleOther`, whose own description states
"Google's own documentation deliberately does not specify" its purpose — a deliberate design
choice to record uncertainty honestly rather than guess (per
`CRAWLER_REGISTRY_GOVERNANCE.md:48-50`). Lifecycle `unverified` serves the analogous role for
crawlers not yet confirmed active.

## 8. Admin registry UI — built, contradicting one governance-doc claim

`docs/registry/CRAWLER_REGISTRY_GOVERNANCE.md:84-88` states registry release
creation/publication UI is "Part 6 (Super Admin) work... there is no interactive publish flow
yet." This is **contradicted by the actual repository**: a full admin registry UI, API, and
integration-test suite already exist —
`apps/web/src/pages/admin/registry/{releases,operators,crawlers,rulesets}/index.astro`,
`RegistryReleasesManager.tsx`, the full `apps/web/src/pages/api/admin/registry/**` route tree, the
342-line `apps/web/src/lib/admin/registry.ts` (create/verify/deprecate/publish/rollback/compare/
schedule-re-evaluation), and `apps/web/tests/integration/admin-registry.integration.test.ts`
(10 real test cases against real D1, not run this session). Logged in `DOCUMENTATION_CONFLICTS.md`
as a stale-documentation finding — either the governance doc is stale, or a scope subtlety
(publish-time enforcement specifically vs. general CRUD) is undocumented.

## 9. Public crawler directory pages

22 content files under `apps/web/src/content/crawlers/`, one per crawler **except Bingbot**.
**Confirmed still true**: `crw_bingbot` has a full registry row (Microsoft, purpose `search`,
official source `bing.com/bingbot.htm`) but no corresponding public page — Microsoft's own
documentation is JS-rendered and could not be fetched/read in the pass that built this content, a
deliberate, disclosed exception (`docs/status/KNOWN_RISKS.md`, `SOURCE_VERIFICATION_POLICY.md`),
not an oversight.

## 10. Changelog page

`apps/web/src/pages/changelog.astro` queries `registryVersions` directly (published releases,
ordered by publish date) plus hand-authored product-changelog entries — it is **not** driven by
`registry-tools.mjs changelog`'s from/to diff output, only release metadata. The governance doc's
description of `registry:changelog` as "the basis for" this page is only partially accurate — a
minor documentation-clarity gap, not a functional bug.

## 11. Registry-related tests

`apps/web/tests/integration/admin-registry.integration.test.ts` — 10 cases against real D1
(create operator, draft→verify a crawler, create/publish a release, deprecate-with-replacement +
compare, publish triggers affected-domain re-evaluation, rollback without deleting later releases,
ruleset register+publish, non-admin rejected from every route). Not run this session (requires
live D1). No dedicated unit tests found for `packages/registry` itself.

## 12. Scan-report registry-version binding

Confirmed via schema: `scans.registry_version_id`/`ruleset_version_id` are set per-scan;
`findings.ruleset_version_id` is `NOT NULL`. Per `CRAWLER_REGISTRY_GOVERNANCE.md`, the diff
classifier reads the scan's _recorded_ version, never "whatever is active now" — verified against
schema/migration text and the doc's own claim; the runtime policy-engine code path itself was not
independently traced in this pass (out of `packages/database`+registry scope).

## 13. Summary of new documentation-conflict-worthy findings (registry)

1. Crawler/operator count: docs self-contradict ("21" vs. "23 crawlers total" in the same
   document); actual seed data has 23.
2. Governance doc claims no interactive publish UI exists; a full admin UI/API/test suite already
   does.
3. `reference-data.sql`'s dynamic operator-based entry insert for the active release risks
   silently violating immutability on re-run against a live database (not confirmed live).
4. Case-sensitive DB unique index vs. case-insensitive CLI duplicate check are not equivalent
   protections.

## 14. Verification limitations

- `pnpm registry:validate`/`registry:checksum`/`registry:changelog` were not executed this session
  (require a live local D1 instance) — **not verified — required access was unavailable within
  this pass's scope.**
- The policy engine's own runtime read of `registry_version_id` at diff-computation time was not
  independently traced (documented and schema-consistent only).
