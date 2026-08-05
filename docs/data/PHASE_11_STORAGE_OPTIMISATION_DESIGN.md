# Phase 11 storage optimisation design

Stage 11C. Documents the `scan_resources.snapshot_text` reduction made in this phase and why the
remaining resource types were deliberately left unchanged. See
`docs/performance/PHASE_11_PRODUCTION_CAPACITY_BASELINE.md` §8.2 for the real production
measurements this design responds to, and `docs/data/PHASE_11_RESOURCE_HASH_AND_DEDUPLICATION_POLICY.md`
for the separate (and separately scoped) `resource_hash` decision.

## What was measured

The baseline measurement pass found `scan_resources.snapshot_text` averaged, per real production
row:

| `resource_type`   | Avg bytes (measured) | Prior estimate | Delta  |
| ----------------- | -------------------: | -------------: | ------ |
| `html_meta`       |               53,554 |        ~10,000 | ≈5.4×  |
| `sitemap`         |               20,891 |         ~1,500 | ≈13.9× |
| `robots_txt`      |                1,927 |         ~1,200 | ≈1.6×  |
| `llms_txt`        |                1,097 |           ~500 | ≈2.2×  |
| `llms_full_txt`   |                1,046 |           ~400 | ≈2.6×  |
| `rsl`             |                1,089 |           ~200 | ≈5.4×  |
| `content_signals` |                    0 |           ~250 | —      |
| `http_headers`    |                    2 |           ~150 | —      |

`html_meta` and `sitemap` are, by a wide margin, the two largest columns — together roughly 71,000
of the ~81,600 average bytes/row across all eight types (≈87%). Every other type is small (under 2
KB average) and close to its original estimate.

## Why `html_meta` and `sitemap`, and only those two

The deciding question for each resource type was: **does anything downstream ever read more than
a handful of already-extracted fields back out of the raw stored text?**

- **`html_meta`**: no. `get-scan-report.ts`'s `buildRobotsMetaSignal` only ever needs
  `metaRobots`, `canonicalUrl`, and `policyReferenceLinks` — three small values `parseHtmlSignals`
  already extracts from the raw HTML. The full up-to-100,000-byte homepage capture existed only in
  case those three fields needed to be re-derived differently later, or for manual evidence review
  — neither of which requires the _entire_ document.
- **`sitemap`**: no, more starkly — grep confirms no code path anywhere reads `sitemap`'s
  `snapshotText` back at all. `validateSitemap`'s parsed result (`looksLikeSitemap`, `isIndex`,
  `sampledUrls`, `issues`, `truncated`) is computed once at scan time and then the raw XML was
  simply archived, unused, forever.
- **Every other type** (`robots_txt`, `llms_txt`, `llms_full_txt`, `rsl`, `content_signals`,
  `http_headers`): yes. `get-scan-report.ts` re-parses the real persisted text on every report read
  (`parseRsl`, `parseLlmsTxt`, `parseContentSignals`), and the robots.txt evaluator
  (`packages/robots`) needs the real, complete robots.txt text to re-evaluate crawler rules against
  — not just a pre-extracted summary. Minimising these would mean either persisting a much larger
  evidence object (defeating the purpose) or losing the ability to re-derive results, which this
  phase's "never fabricate or reinterpret a real result" rule forecloses. They also average under 2
  KB already, so the storage return would not justify the added format-migration risk.

## The change

`apps/web/src/lib/persist-scan.ts` now special-cases these two resource types when building the
`scan_resources` insert:

- **`html_meta`** → `JSON.stringify(buildHtmlMetaEvidence(fetchResult.body))`
  (`packages/scanner/src/signals/html-signals.ts`). The evidence blob carries the three extracted
  fields, a version marker (`format: "html_meta_evidence_v1"`, `parserVersion`), whether the
  original document exceeded the parser's 200,000-byte pre-parse bound (`truncated` — see
  `docs/security/` parser-bounds notes), and a 2,000-byte bounded raw snippet kept for manual
  evidence review. Typical size: well under 1 KB, versus the previous ~53.5 KB average.
- **`sitemap`** → `JSON.stringify(result.scanSignals.sitemap.parsed)`, i.e. the
  `SitemapValidation` object the orchestrator already computed for scoring/report purposes.
  Nothing new is derived; the raw XML is simply no longer archived. Typical size: well under 500
  bytes, versus the previous ~20.9 KB average.
- Every other resource type is untouched: `fetchResult.body.slice(0, 100_000)`, exactly as before.

Both changes also populate the new `resource_hash` column (see the dedup policy doc) from the
**real, complete fetched body** (`fetchResult.body`), not the minimised stored text — so the hash
reflects the actual page content regardless of what representation is kept.

## Backward compatibility (no destructive rewrite)

Existing `html_meta` rows written before this phase hold raw HTML, not the new JSON shape.
`get-scan-report.ts`'s `buildRobotsMetaSignal` now tries `JSON.parse(snapshotText)` first and
checks the format marker (`isHtmlMetaEvidence`); if that fails or the marker doesn't match, it
falls back to the original `parseHtmlSignals(snapshotText)` path, exactly as before. No migration
touches existing `scan_resources` rows — old and new rows are both fully readable, permanently,
without a backfill. The same reasoning applies to `sitemap`, except no code ever read that column
back in the old format, so there is no fallback path to write — old raw-XML rows are simply inert
history now, same as before this phase.

Proven by real D1 integration tests in
`apps/web/tests/integration/audit-report-signals.integration.test.ts`:

- new-format round trip for both types,
- stored size well under the old raw-body size,
- a synthetic pre-phase-11 raw-HTML row still parses correctly through the fallback path.

## Expected impact

Recomputing the baseline's "real raw bytes/scan ≈ 68,000" figure with both reductions in place
(minimised `html_meta` + `sitemap` at roughly a few hundred bytes each instead of ~53.5 KB / ~20.9
KB): the two largest contributors drop by roughly two orders of magnitude, which should bring
per-scan effective storage close to or below the original Phase 5 "as-observed" estimate
(~21,700 bytes/scan) despite every other measured value already running above its own estimate.
This is a projection from the measured per-row averages, not a new production measurement — a
follow-up re-measurement pass (post-deploy, per this phase's Stage 11I preview/production
verification) is what confirms it, not this document.

## What this does not do

- It does not deduplicate identical content _across_ scans (e.g. two consecutive scans of an
  unchanged homepage) — see the dedup policy doc for why that's a separate decision, deferred.
- It does not touch `robots_txt`, `llms_txt`, `llms_full_txt`, `rsl`, `content_signals`, or
  `http_headers` — measured, evidenced as low-value targets, left exactly as they were.
- It does not change what a report _shows_ — `buildRobotsMetaSignal`'s output (the
  `RobotsMetaSignal` returned to the client) is byte-for-byte the same shape and values as before,
  for both old and new rows.
