# Crawler Registry Governance

## Publication rule (SRS FR-REG-005) — enforced by schema and by the Super Admin registry UI

A crawler must not be published without: a reliable source, a verified user-agent token, a
purpose classification, a verification date, and administrator approval. Enforced by convention,
by `registry-tools.mjs validate`, and — as of Part 3 — by the interactive Super Admin registry
UI (`apps/web/src/pages/admin/registry/{operators,crawlers,releases,rulesets}/index.astro`,
`lib/admin/registry.ts`'s `createCrawlerDraft`/`verifyCrawler` enforcing the
`unverified`→`active` transition), covered by `admin-registry.integration.test.ts` (10 real test
cases). **Corrected 2026-08-03 (Phase 1)** — this section previously said the enforcement was
"not yet by admin UI," which was stale relative to code already built and tested; see
`docs/baseline/2026-08-03/DOCUMENTATION_CONFLICTS.md` DC-014.

## Immutability and the active release pointer

`registry_versions` and `registry_version_entries` are append-only by design (no `updated_at`,
no soft delete) — a published release is never edited. `registry_version_entries.snapshot` is a
JSON snapshot taken at publish time specifically so a historical scan's evidence never changes
even if the live `crawlers` row is later updated.

**Phase 15 correction (2026-08-11)**: the paragraph above describes the intended design, which
was correct — but until Phase 15, that design was only half-wired-up. `getActiveRegistry()`
(live evaluation) and `getScanReport()`/`domain-timeline.ts` (historical rendering) both read
straight from the live, mutable `crawlers` table, never from `registry_version_entries.snapshot`.
The snapshot table existed and was genuinely immutable, but nothing in the evaluation or
rendering path actually consulted it — meaning editing a crawler's live row could silently change
what an already-active release evaluated, and how a historical scan displayed that crawler's
name/purpose/source. This is now fixed: both paths resolve exclusively from the frozen release
snapshot. See `docs/registry/PHASE_15_REGISTRY_BASELINE.md` for the full finding and
`apps/web/tests/integration/registry-reproducibility.integration.test.ts` for the regression test.

Since Part 2 (migration `0009_registry_active_pointer.sql`), exactly one `registry_versions` row
and one `ruleset_versions` row may have `is_active = 1` at a time, enforced by a SQLite partial
unique index — not just application logic. Phase 15 additionally made the publish/rollback
pointer-flip itself atomic (`db.batch()`, migration-independent — see
`docs/registry/PHASE_15_REGISTRY_BASELINE.md`), closing a real (if narrow) window where a
mid-request failure could previously have left zero releases active. New scans evaluate against
whichever release is currently active. **Publication and activation are a single combined action
in this codebase** (`publishRegistryVersion` both stamps `publishedAt` and flips `is_active` in
one call — freezing already happened earlier, at `createRegistryRelease`) — this document
previously implied they were separate steps without stating that plainly; corrected here to match
the actual implementation. See `docs/registry/REGISTRY_RELEASE_PUBLICATION_RUNBOOK.md`.

## Registry tooling (Part 2, extended Phase 15)

`scripts/registry-tools.mjs`, run via `pnpm registry:validate` / `registry:checksum` /
`registry:checksum:verify` / `registry:integrity:verify` / `registry:changelog` against the local
D1 database, plus `scripts/registry-public-validate.mjs` (`pnpm registry:public:validate`):

- **validate** — duplicate `user_agent_token` detection, missing-source detection, active
  crawlers lacking a verification date/source, stale-verification report (>180 days since last
  verification), a sanity check that at most one registry version is active, broken replacement
  references, duplicate version labels/release entries, and malformed active-release snapshots
  (Phase 15 additions).
- **checksum `<versionId>`** — a SHA-256 over the canonicalised (sorted-key, crawler-ID-ordered)
  snapshots of a release's entries. Phase 15: now uses the exact same canonicalisation as the
  runtime/admin checksum logic (`apps/web/src/lib/registry-checksum.ts`) rather than a
  differently-computed CLI-only value.
- **checksum:verify** (Phase 15) — recomputes and compares every _published_ release's checksum
  against its stored value; fails CI-style if any published release's entries don't match what
  was checksummed at publish time.
- **integrity:verify** (Phase 15) — the Section 124 runtime check: exactly one active release,
  published, checksum valid, entries parse, no unverified crawler in the evaluation set, no
  duplicate evaluation-eligible tokens, an active ruleset exists.
- **changelog `<fromId>` `<toId>`** — added/removed/changed crawlers between two releases,
  the basis for the public `/changelog` registry section (Part 6+). Superseded internally by the
  richer semantic diff (`docs/registry/REGISTRY_SEMANTIC_DIFF_MODEL.md`) for anything the
  application itself does; this CLI command remains for ad-hoc inspection.
- **`registry:public:validate`** (Phase 15) — compares the static crawler content collection
  against the D1 registry, catching a public page that describes an unregistered token, an
  unverified crawler presented as confirmed, or drifted purpose/lifecycle values.

## Current registry content (Part 2 seed, extended in Part 3 Step 13/14, corrected 2026-07-30)

**23 crawlers across 9 operators** (OpenAI, Anthropic, Perplexity AI, Google, Common Crawl
Foundation, Apple, Meta, Amazon, Microsoft) — corrected 2026-08-03 (Phase 1) from this section's
previous "21 crawlers" count, which contradicted this same document's own "Correction pending
publication" paragraph below (already stating "23 crawlers total"); see
`docs/baseline/2026-08-03/DOCUMENTATION_CONFLICTS.md` DC-013. Across three releases:

- **2026.07.1** (superseded): the original 13-crawler Part 1 seed.
- **2026.07.2** (superseded): adds Bingbot (new operator, Microsoft), Claude-SearchBot
  (Anthropic's search-purpose crawler, distinct from ClaudeBot/training and Claude-User/
  retrieval), and three additional Meta crawlers verified against Meta's current crawler
  documentation — Meta-WebIndexer (search), Meta-ExternalAds (advertising/validation),
  Meta-ExternalFetcher (agent).
- **2026.07.3** (active): adds OAI-AdsBot (OpenAI, advertising validation) and two Google
  crawlers not previously tracked — Google-CloudVertexBot (agent) and GoogleOther (unknown
  purpose, honestly labelled since Google's own documentation doesn't specify one) — all found
  and live-verified against each operator's current official documentation while closing the
  SRS §30.4 crawler-reference-page minimum (Part 3 Step 13/14).

See `packages/database/seed/reference-data.sql` for exact rows and
`docs/registry/SOURCE_VERIFICATION_POLICY.md` for source citations. Public crawler-reference
pages (`apps/web/src/content/crawlers/*.md`) cover 22 of the 23 — the one gap (Bingbot) is a
deliberate, documented exception (its official source page requires JavaScript rendering and
could not be automatically fetched and read during verification), not an oversight; see
`SOURCE_VERIFICATION_POLICY.md`.

**Amazon/Google correction — independently reverified Phase 15 (2026-08-11), previously only
carried as a pending note.** A 2026-07-30 pass found (1) `Google-Extended`'s cited source URL had
gone stale — Google retired the standalone page and folded its content into
`.../google-common-crawlers` — and (2) Amazon's own documentation separately publishes two
further tokens: `Amzn-SearchBot` (search) and `Amzn-User` (user-triggered), both explicitly
excluded from AI training per Amazon's own text. Phase 15 re-fetched both operators' current
official documentation live (not trusting the prior note) and confirmed both findings are still
accurate — see `docs/registry/PHASE_15_FULL_SOURCE_REVERIFICATION_REPORT.md` for the full
evidence trail, including a further finding from this pass: Bingbot's own source URL has also
since moved and was corrected the same way. `packages/database/seed/reference-data.sql` and the
corresponding `apps/web/src/content/crawlers/*.md` pages already reflect these corrections;
publishing them as the new _active_ production release requires a separate, explicit
registry-release approval per this repository's standing rule — see the Phase 15 completion
report for whether that approval was given and what release resulted.

## Registry drift vs. website drift (FR-REG-009/010)

A change in a crawler's registry record must never be presented as if the _website_ changed.
`scan_diffs.diff_type` enforces this distinction at the schema level — see
`docs/data/DATA_MODEL.md`. `packages/policy`'s conflict detector and diff logic read the scan's
recorded `registry_version_id`, never "whatever is active now" — this was always true for the
evaluation _result_ itself (`scan_crawler_results`, computed once at scan time and never
recomputed). What Phase 15 fixed was a related but distinct gap: _rendering_ a historical scan's
crawler details (name, purpose, source) had been resolving them from the live `crawlers` table
rather than the scan's own recorded release — see "Immutability and the active release pointer"
above.

Phase 15 additionally distinguishes _why_ a registry release changed
(`docs/registry/REGISTRY_SEMANTIC_DIFF_MODEL.md`): only evaluation-semantic changes (token,
purpose, lifecycle) drive affected-domain re-evaluation; evidence-only changes (a source URL
moving) and editorial changes (wording) never do, closing a related bug where any edit at all —
including a source-URL refresh — could previously trigger customer re-evaluation.

## What is still not implemented

**Corrected 2026-08-03 (Phase 1)**: registry release creation/publication UI and automatic
re-evaluation of saved domains on a new release are now built — see the section above and
`lib/admin/registry.ts`'s `publishRegistryVersion`/`getAffectedDomains`/`scheduleReEvaluation`.

**Updated Phase 15 (2026-08-11)** — evaluated and deliberately deferred, not silently missing:

- **Richer multi-source provenance model** (`crawler_sources`/`crawler_source_verifications`
  tables) — no current crawler needs more than one official source URL; see
  `docs/data/PHASE_15_REGISTRY_PROVENANCE_DATA_MODEL.md`.
- **Automated source-health fetcher** — evaluated per Section 19, not built this phase; see
  `docs/registry/REGISTRY_REVERIFICATION_POLICY.md`.
- **DB-backed public crawler directory** (Option A) — the public `/crawlers` pages remain
  statically generated from Markdown, not read live from D1; see
  `docs/registry/PUBLIC_REGISTRY_RENDERING_ARCHITECTURE.md`.
- **`security_events`/`notifications` retention** (RISK-006) — unrelated to the registry, still
  open from Phase 14, unaffected by this phase.

Nothing else is currently known to be missing from registry release creation/publication;
if a genuine gap is found in a future phase, record it here with evidence rather than reinstating
a stale claim.
