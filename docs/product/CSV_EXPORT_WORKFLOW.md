# CSV Export Workflow

CSV export already exists (`GET /api/domains/export.csv`, `apps/web/src/lib/csv.ts`'s `toCsv`,
already formula-injection-safe). This phase extends its scope and columns; it does not rebuild it.

## Scope (new query parameters, all optional, default = current behaviour unchanged)

`GET /api/domains/export.csv?groupId=&domainIds=&filter=` — `groupId` restricts to one owned
group; `domainIds` (comma-separated, max 100) restricts to an explicit owned selection, each ID
re-validated server-side against `owner_user_id` (never trusts a client-supplied row list without
re-checking ownership — directly prevents the "cross-account domain IDs" attack the threat review
tests for); `filter` reuses the same filter vocabulary as the portfolio table (group/attention/
monitoring/change-origin/scan-state) so "export what I'm currently looking at" is one click. No
parameter combination can ever return another account's rows — every path still starts from
`listDomains(db, user.id)` or a narrower owned subquery.

## Columns

Existing 8 columns unchanged (Domain, Canonical origin, Preset, Monitoring, Score, Open findings,
Last scan, Next scan) **plus**, added in this phase: Group, Monitoring frequency, Latest meaningful
change (summary text, truncated to 200 chars), Change origin, Unresolved attention count. **Notes
is never included unless the caller explicitly passes `includeNotes=1`** — off by default per §47
("Do not include internal notes in CSV export unless explicitly selected"). Never included, with
or without the flag: user email, Paddle identifiers, subscription IDs, internal account IDs, raw
evidence, private-share tokens, security-event data, full scan payloads, internal error details —
none of these are read by the export query in the first place, so there is no flag that could leak
them.

## Security

- Formula-injection prevention: unchanged, reuses `escapeCsvField` (already covers `=`, `+`, `-`,
  `@`, tab, CR — the export side already exceeded the prompt's own minimum, since it also escapes
  tab/CR, not just the four leading characters explicitly listed in §28).
- Quoting/UTF-8: unchanged, already correct (`toCsv`'s existing quote-wrapping on
  comma/quote/newline).
- Authorisation: `plan.csvExportEnabled` check, unchanged; every new scope parameter re-validates
  ownership independently, as above.
- Rate limiting: a lightweight per-user counter (reuses the existing rate-limit helper pattern
  already used elsewhere in `apps/web/src/lib/rate-limit.ts` if present, else a minimal in-request
  D1-backed counter) caps export requests to a sane per-hour ceiling — prevents export being used
  as a scraping/enumeration vector against the account's own data at abnormal frequency.
- Audit event: `portfolio_export_completed` (categorical only — see
  `PHASE_09_AGENCY_WORKSPACE_EVENT_MODEL.md`).
- Filename: fixed pattern `crawlpact-domains-{scope}.csv` where `{scope}` is one of a small fixed
  enum (`all`, `group`, `selected`) — never derived from user-controlled group/domain names, so
  there is no path-injection surface.
- Response headers: `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment`,
  unchanged; `Cache-Control: private, no-store` is already applied by the global middleware
  default (see `AGENCY_WORKSPACE_INFORMATION_ARCHITECTURE.md`'s Caching section) — no change
  needed.

## Performance

Bounded by the same ≤100-domain ceiling every export always had; group/selection scope only ever
narrows the row count further. No streaming is needed at this scale — building the full CSV string
in memory (as `toCsv` already does) stays well within Worker memory limits even at the Agency
ceiling with all new columns included.
