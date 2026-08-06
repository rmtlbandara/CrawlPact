# Domain Scan Comparison Model

Implemented in `apps/web/src/lib/domain-comparison.ts`, served by
`GET /api/domains/:domainId/compare/:previousScanId/:currentScanId` and the authenticated page
`/app/domains/:domainId/compare/:previousScanId/:currentScanId`.

## Comparable-state rules

Two scans on the same domain are comparable when:

1. Both belong to the requesting user's own domain (server-side ownership check via
   `getOwnedDomain()`, never trusted from the URL alone).
2. Both scan IDs are distinct real rows (`previousScanId !== currentScanId`; a request with the
   same ID twice returns a 400, not a degenerate empty diff).
3. Both scans have `status` in `{completed, completed_with_warnings}`. This codebase has no
   scanner-version column today (confirmed absent from `scans` during Phase 8 baseline research)
   — comparability is therefore judged on completeness, registry version, and resource
   availability only; a "scanner version changed" axis from the original prompt is not
   independently trackable and is intentionally not fabricated as a fake field.
4. At least one resource type is comparable per the attribution model's own comparability rule
   (both scans have a `scan_resources` row for that type) — if zero types are comparable, the
   comparison is **incompatible**, not silently empty.

When any rule fails, the API returns a structured `incompatible` result (not a 404, not a 500) with the exact copy: _"These scans were created from materially different or incomplete
evidence, so CrawlPact cannot provide a direct comparison."_ — plus direct links to each
individual scan's report, per the Phase 8 requirement to always leave a way to inspect either
scan directly.

## Supported comparisons

- Website evidence before/after — per comparable `scan_resources` type, previous vs. current
  `snapshotText` (bounded, escaped, truncation-flagged) and `resourceHash` equality.
- Crawler evaluation before/after — per `scanCrawlerResults` row, previous vs. current `result`.
- Findings before/after — see `FINDING_LIFECYCLE_MODEL.md`.
- Registry version before/after — `registryVersionId`/`versionLabel` on each scan.
- Summary state before/after — `computePolicySummary()` re-derived for each scan's own
  already-persisted report data (never re-scanned).

## Evidence presentation

- `Previous`/`Current` are always explicitly labelled — never colour-only.
- All `scan_resources.snapshotText` content is HTML-escaped before rendering (React's default JSX
  text-node escaping is relied on; no `dangerouslySetInnerHTML` is used anywhere in this
  feature). Long tokens/rules wrap via `break-words` / `overflow-x-auto` container CSS, matching
  the pattern already used for the crawler matrix in `AuditReportView.tsx`.
- Truncated snapshots show a `Truncated` badge (reads `scan_resources.truncated`).
- A resource with no comparable prior row shows _"Detailed evidence is no longer available
  because it is outside the retained history for this account."_ when the reason is retention
  expiry, distinct from _"This resource was not fetched during the previous scan."_ when the
  reason is simply that the resource type didn't exist/apply to that scan.

## Security

- `domainId`, `previousScanId`, `currentScanId` are all validated server-side against the
  requesting user's own ownership before any query touches scan/resource data — a scan ID from
  another account never returns data, it returns the same `incompatible`/`not_found` shape a
  made-up ID would, avoiding an existence oracle.
- No raw HTML is ever rendered from scan evidence (enforced by the JSX-escaping convention above;
  covered by an adversarial-fixture unit test that plants `<script>`/`javascript:` payloads in
  `snapshotText` and asserts the rendered output is inert text).
