# Phase 11 resource hash and deduplication policy

Stage 11C. `scan_resources.resource_hash` (added by an earlier migration, previously never
populated — confirmed via grep before this phase) is now populated for every fetched resource.
This document records the three deduplication strategies considered for it and which one this
phase actually implements.

## What is populated, and from what

`persist-scan.ts` computes `resourceHash = sha256Hex(fetchResult.body)` for every resource type
that has a successful fetch (`robots_txt`, `llms_txt`, `llms_full_txt`, `sitemap`, `html_meta`,
`rsl`) — the real, complete fetched body, not the (for `html_meta`/`sitemap`) minimised stored
`snapshotText`. Two scans that fetched byte-identical content therefore always hash identically,
regardless of what representation of that content is actually stored — the hash and the storage
format are independent decisions.

`content_signals` and `http_headers` are not hashed: both are small derived values read out of the
homepage response (a header value and a JSON array respectively), not independently-fetched
resources with their own identity — their content is already covered by `html_meta`'s hash of the
same underlying homepage fetch.

Failed fetches (`fetchResult.ok === false`) have no `resource_hash` — there is no content to hash.

Proven by a real D1 integration test
(`audit-report-signals.integration.test.ts`, "populates a SHA-256 resource_hash for every fetched
resource type"): asserts the hash is a real 64-character hex SHA-256 digest, and that different
fetched bodies produce different hashes (not a placeholder constant).

## The three strategies considered

1. **Hash-for-change-detection-only** (chosen this phase). Populate `resource_hash` on every
   fetched resource; do not change how or where `snapshotText` is stored based on the hash. Each
   scan's resource rows remain fully independent — no row ever references another row's data.
   Immediate use: a future cheap `WHERE resource_hash = ?` comparison (e.g. inside `scan_diffs`
   computation, or a future "skip re-analysis of an unchanged resource" optimisation) without
   needing to diff full text. Zero schema risk: the column already existed and was already
   nullable; populating it changes no read path, no retention path, and no foreign key.

2. **Shared-snapshot-table**. Move `snapshotText` out of `scan_resources` into a separate table
   keyed by `resource_hash`, with `scan_resources` holding only a reference. Two scans with
   identical `snapshotText` would then store the bytes once. Rejected _for this phase_: this is a
   real schema migration touching every `scan_resources` write and read path, and it introduces a
   new question this phase has not yet answered — retention. `DATA_RETENTION.md`'s purge job
   deletes `scan_resources` rows tied to expired scans; a shared snapshot table would need its own
   reference-counting or orphan-sweep logic (structurally identical to the R2 orphan-inventory work
   already planned for this phase, §14) to know when a shared row is safe to delete. Doing that
   correctly, with real tests proving no shared row is ever deleted while still referenced, is
   larger than this phase's storage-reduction budget justifies given `html_meta`/`sitemap` already
   captured the overwhelming majority of the measured excess (§ design doc). Worth revisiting if a
   future measurement shows genuinely high content-identity rates across scans of the same domain
   (this phase did not measure that rate — see "What this phase does not claim" below).

3. **Previous-snapshot-reference**. Instead of a shared table, let a new scan's resource row
   directly reference the previous scan's resource row when the hash matches, forming a chain.
   Rejected: this creates an implicit, growing dependency chain across scans — deleting an older
   scan could silently orphan or break a newer scan's data unless every row in the chain is walked
   on every purge, which is exactly the `scan_diffs` FK-defect class of bug this phase already
   found and fixed once (RISK-005, migration `0022`) from a much simpler two-row case. Introducing
   a new, deeper version of the same failure mode while already mid-phase on fixing the first one
   is not proportionate risk for the storage saved.

## Why option 1, concretely

`html_meta` and `sitemap` — the two resource types responsible for ≈87% of measured
`scan_resources` bytes — were already reduced by roughly two orders of magnitude via the
minimised-evidence approach (see the storage optimisation design doc), independent of hashing.
That leaves cross-scan content deduplication targeting resources that were already small
(`robots_txt` ~1.9 KB, `llms_txt`/`llms_full_txt`/`rsl` ~1 KB each) — real but secondary savings,
and only realisable if a meaningful fraction of scans actually re-fetch byte-identical content,
which was not measured this phase (the production dataset has 26 rows per type across a small
number of domains, not enough distinct repeat-scan history to measure a real duplication rate
honestly). Populating the hash now is the low-risk, zero-regression prerequisite for either of the
larger strategies later, without committing to either one before there's real evidence a
duplication rate exists worth building for.

## What this phase does not claim

- It does not claim any storage was saved by hashing itself — hashing alone saves nothing; it only
  enables a future decision.
- It does not measure or claim a cross-scan content-duplication rate. That measurement (comparing
  `resource_hash` values across a domain's own scan history, once enough real repeat-scan data
  exists) is the natural first step before choosing between strategies 2 and 3 in a later phase.
- It does not change `scan_diffs` or any existing diff/comparison logic to use `resource_hash` —
  this phase only populates the column.
