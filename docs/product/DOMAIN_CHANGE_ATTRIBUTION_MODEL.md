# Domain Change-Origin Attribution Model

Implemented in `apps/web/src/lib/change-attribution.ts`. Deterministic, versioned
(`model_version = "1"`), no generative model involved anywhere in this function.

## Supported origins

```
website_policy   — public website signals changed; registry evidence materially equivalent
registry_driven  — registry-published crawler evaluation changed; website evidence unchanged
mixed            — both website and registry evidence changed materially
operational      — a completeness/availability/preset change, not a deliberate policy edit
uncertain        — available retained evidence cannot establish a single cause
baseline         — no previous comparable scan exists
```

These map onto the SRS §10.29 timeline row types (website drift / registry drift / preset
changes / scan failures) while adding the `mixed`/`uncertain`/`baseline` states the existing
3-value `scan_diffs.diffType` enum has no room for (see the baseline document's "Change-detection
model" section for why the old enum collapses "both changed" into `registry_drift`).

## Inputs

For a `(previousScanId, currentScanId)` pair on the same domain:

1. **Registry identity**: `scans.registryVersionId` on each scan. Differs → registry input
   changed.
2. **Resource evidence**: `scan_resources.resourceHash` per `resourceType`
   (`robots_txt | llms_txt | llms_full_txt | rsl | content_signals | html_meta | http_headers`;
   `sitemap` is excluded — it does not feed crawler-policy evaluation). Populated by Phase 11
   specifically "for future change-detection use." A resource type is **comparable** only when
   both scans have a row for it; comparable types where the hash differs count as a website
   change. `sql:comparability` — comparability itself (which types are comparable at all) is part
   of the origin decision, not just the hash values.
3. **Scan completeness**: `scans.status`. Only `completed`/`completed_with_warnings` scans are
   eligible for website/registry/mixed attribution; anything else forces `operational` or
   `uncertain` (see below).

## Decision procedure (in order)

1. No `previousScanId` → **`baseline`**.
2. Either scan's `status` is not in `{completed, completed_with_warnings}` → **`operational`**
   with a specific reason (`previous_scan_incomplete` | `current_scan_incomplete`). An unavailable
   resource or a timed-out fetch is never described as a deliberate block — this rule is what
   keeps that promise: a scan that could not complete never gets to claim a definite website
   change.
3. Zero resource types are comparable between the two scans (e.g. the previous scan's
   `scan_resources` rows have aged out under retention, or the previous scan predates the current
   resource-capture format) → **`uncertain`**, reason `evidence_unavailable`.
4. Otherwise compute `websiteChanged` (any comparable resource-type hash differs) and
   `registryChanged` (`registryVersionId` differs):
   - both false → no event is generated at all (this is the existing, preserved "no material
     change" path — see the timeline architecture doc for why no-change scans still exist in
     `scans`/`scan_diffs` but do not get a `domain_change_events` row).
   - `websiteChanged && !registryChanged` → **`website_policy`**.
   - `!websiteChanged && registryChanged` → **`registry_driven`**.
   - both true → **`mixed`**.

A `preset_changed` event (see the policy-objective decision doc) is generated independently, not
through this procedure — it is always `operational`, sourced from `updateDomain()`, not from a
scan comparison.

## Rules enforced by this design

- **Deterministic**: same two scan rows always produce the same origin; no randomness, no network
  call, no LLM.
- **Documented**: this file; kept in sync with `change-attribution.ts` the same way
  `policy-summary.ts` is kept in sync with its own mapping doc.
- **Versioned**: every `domain_change_events` row stores `model_version`, so a future revision to
  this procedure never silently reinterprets old rows.
- **No implied intent**: `website_policy` never becomes "the site operator deliberately blocked
  X" — copy always describes what changed, not why.
- **No false registry attribution**: `registry_driven` requires the website side to be genuinely
  unchanged and comparable, not merely "we didn't check."
- **Honest uncertainty**: any scenario the procedure can't cleanly classify resolves to
  `uncertain` or `operational`, never guessed toward a more "interesting" answer.

## Verified test scenarios (see `apps/web/tests/unit/change-attribution.test.ts`)

Website-only robots.txt change; website-only meta change; a resource becoming unavailable then
returning; registry-only change with website unchanged; both changed together; previous scan
partial; current scan partial; previous evidence expired/unavailable; no material change (no
event); first baseline; preset change (independent path).
