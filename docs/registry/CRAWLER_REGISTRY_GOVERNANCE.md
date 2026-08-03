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

Since Part 2 (migration `0009_registry_active_pointer.sql`), exactly one `registry_versions` row
and one `ruleset_versions` row may have `is_active = 1` at a time, enforced by a SQLite partial
unique index — not just application logic. New scans evaluate against whichever release is
currently active; publishing a release and activating it are distinct actions (SRS §28.11:
"Roll back the active release pointer" implies activation is reversible independent of
publication).

## Registry tooling (Part 2)

`scripts/registry-tools.mjs`, run via `pnpm registry:validate` / `registry:checksum` /
`registry:changelog` against the local D1 database:

- **validate** — duplicate `user_agent_token` detection, missing-source detection, active
  crawlers lacking a verification date/source, stale-verification report (>180 days since last
  verification), and a sanity check that at most one registry version is active.
- **checksum `<versionId>`** — a SHA-256 over the sorted, concatenated snapshots of a release's
  entries, for verifying a release's integrity hasn't been tampered with.
- **changelog `<fromId>` `<toId>`** — added/removed/changed crawlers between two releases,
  the basis for the public `/changelog` registry section (Part 6+).

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

See `packages/database/seed/seed.sql` for exact rows and
`docs/registry/SOURCE_VERIFICATION_POLICY.md` for source citations. Public crawler-reference
pages (`apps/web/src/content/crawlers/*.md`) cover 20 of the 21 as of Part 3 — the sole gap
(Bingbot) is a deliberate, documented exception (its official source page could not be fetched
and read during verification), not an oversight; see `SOURCE_VERIFICATION_POLICY.md`.

**Correction pending publication as a new release (not yet 2026.07.3's live state):** a
2026-07-30 re-verification pass against each operator's current documentation found (1)
`Google-Extended`'s cited source URL had gone stale — Google retired the standalone page and
folded its content into `.../google-common-crawlers` (also already cited by
`Google-CloudVertexBot`/`GoogleOther`) — and (2) Amazon's own documentation separately publishes
two further tokens not yet in the registry: `Amzn-SearchBot` (search) and `Amzn-User`
(user-triggered), both explicitly excluded from AI training per Amazon's own text, mirroring how
OpenAI/Anthropic/Perplexity/Meta are already split by purpose rather than folded into one
"mixed" entry. `packages/database/seed/reference-data.sql` and the corresponding
`apps/web/src/content/crawlers/*.md` pages have been corrected accordingly (23 crawlers total).
Because registry releases are immutable, this correction still needs to be published as a new
registry release (e.g. `2026.07.4`) through the normal registry-manager workflow — reference
data is safe to re-run into any environment, but making it the _active_ release in a database
that already has `2026.07.3` active requires an explicit publish action, not just an edit to
this seed file.

## Registry drift vs. website drift (FR-REG-009/010)

A change in a crawler's registry record must never be presented as if the _website_ changed.
`scan_diffs.diff_type` enforces this distinction at the schema level — see
`docs/data/DATA_MODEL.md`. `packages/policy`'s conflict detector and diff logic read the scan's
recorded `registry_version_id`, never "whatever is active now," so this distinction holds even
if the active release changes between two scans of the same domain.

## What is still not implemented

**Corrected 2026-08-03 (Phase 1)**: registry release creation/publication UI and automatic
re-evaluation of saved domains on a new release are now built — see the section above and
`lib/admin/registry.ts`'s `publishRegistryVersion`/`getAffectedDomains`/`scheduleReEvaluation`.
Nothing is currently known to be missing from this specific capability; if a genuine gap is
found in a future phase, record it here with evidence rather than reinstating this stale claim.
