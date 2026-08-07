# CSV Import Workflow

## Load-bearing finding (see `PHASE_09_AGENCY_WORKSPACE_BASELINE.md`)

No domain-creation path in CrawlPact — not the single-add form, not the existing JSON
batch-import — ever triggers a scan synchronously. A new domain simply enters `domains` with
`last_scan_id = NULL, next_scan_at = NULL`, and the existing monitoring sweep's `claimDueDomains`
picks it up on the very next cron tick (NULL sorts first in `next_scan_at ASC`), inside its
existing bounded batch size. **This means CSV import's own new work is domain-row creation and
validation UX — not a new audit-execution or job-queue system.** Creating rows is a pure D1 write
with no outbound network call, so doing up to 100 of them (the Agency batch-import ceiling,
already enforced by `plans.batch_import_limit`) inside one request is safe and bounded — very
different from running 100 external scans in one request, which this design never does.

## Flow

1. **Template** — `GET /api/workspace/import/template.csv` returns a static example CSV
   (`domain,display_name,group,notes,monitoring`), gated on the same `csvExportEnabled`-style plan
   check as the rest of import (actually gated on `batchImportLimit > 0`).
2. **Upload** — client selects a local `.csv` file (`<input type="file" accept=".csv,text/csv">`);
   never a remote URL.
3. **Preview** — `POST /api/workspace/import/preview` (`multipart/form-data`, file field
   `file`). Parses and validates server-side (see Security below), returns every row's outcome
   (`valid | duplicate_in_file | already_saved | invalid_domain | private_target | group_not_found
| monitoring_unavailable | limit_exceeded | batch_limit_exceeded | field_too_long |
unsupported_field`) **without writing anything to the database** — pure validation. Group
   assignment/monitoring preference selection happens client-side against this preview.
4. **Confirm** — `POST /api/workspace/import/confirm`, body carries the original file content
   (re-sent, not trusted from a server-side stash — see Idempotency below) plus an
   `idempotencyKey` (client-generated UUID, stored in the form state across the preview→confirm
   step) and the chosen `groupId`/`monitoringPreference`. Server re-validates from scratch (never
   trusts the client's preview response) and, only on confirm, creates the valid rows'
   domains in one bounded loop (reusing `createDomain`, same as every other creation path — same
   duplicate/limit checks, same event generation).
5. **Result** — the response is the complete per-row outcome (not a job you poll for) — see
   "Why no background job" below.
6. **Baseline** — nothing new happens here. The domains just created have `next_scan_at = NULL`
   like any other new domain, and the existing monitoring sweep scans them on its next tick,
   exactly like the single-add and existing JSON batch-import paths already behave today.

## Why no background job or status-polling route

The prompt's §24–26 concern (background processing, job states, "provide a job-status route,"
progress UX) exists to prevent one request from doing unbounded, slow, external work. Here, the
only work inside the confirm request is up to 100 D1 row inserts — fast, bounded, no external
fetch — so it completes well inside a normal request timeout and there is nothing to poll for. A
`portfolio_import_jobs` row is still written (see Storage below), but purely as an **audit/history
record and idempotency key**, not as a queue driving asynchronous execution. This is a deliberate,
documented simplification versus a literal reading of §24, justified by the baseline finding above
— not a shortcut taken without disclosure.

## Idempotency

`portfolio_import_jobs.idempotency_key` is unique per `owner_user_id`. If `confirm` is called
again with a key that already has a completed job, the server returns the **stored** result
without re-processing or re-creating any domain — satisfies "Repeated submission must not create
duplicate domains" without needing distributed locking (D1 serialises writes; a unique-constraint
violation on retry is the whole mechanism).

## CSV fields

Required: `domain`. Optional: `display_name`, `group` (matched by name, case-insensitive, against
the caller's own groups only), `notes`, `monitoring` (`on`/`off`, only honoured when the plan's
`monitoring_frequency != 'none'`). Any other column is accepted but ignored and reported as
`unsupported_field` per row (not an error) — this specifically prevents a `plan`, `price`,
`entitlement`, `paddle_id`, `score`, or any other internal-state column from being interpreted as
input, per §21's explicit prohibition list.

## Security (see `PHASE_09_AGENCY_WORKSPACE_THREAT_REVIEW.md` for the full test matrix)

- **Parser**: hand-written, RFC 4180–compliant (`apps/web/src/lib/csv.ts`, new `parseCsv()`
  export, unit-tested against quoted fields, embedded commas/newlines, escaped quotes, CRLF/LF,
  and malformed input) rather than a naive `split(",")`. A dependency (e.g. `papaparse`) was
  considered and rejected in favour of a small, fully-audited, Workers-runtime-safe
  implementation with no supply-chain surface — the parser is under 80 lines and has full branch
  coverage in `csv.test.ts`.
- **Bounds**: max file size 256 KB, max rows 100 (Agency's own ceiling — anything larger is
  rejected outright, never silently truncated), max 10 columns, max field length 300 chars, UTF-8
  only (invalid byte sequences rejected with a clear error, not silently mangled).
- **No formula execution on import**: any field value beginning with `=`, `+`, `-`, or `@` is
  stored as literal text (never interpreted), and — critically — is _also_ re-sanitised on the way
  back out if it's ever exported later (reuses `escapeCsvField`, shared with export — one
  implementation, not two).
- **No remote import**: the endpoint only accepts an uploaded file body; there is no URL field
  anywhere in the request schema.
- **Domain safety**: reuses the exact same `normalizeTarget()` (`@crawlpact/core`) every other
  domain-creation path already uses — no separate import-specific normaliser, no separate SSRF
  check.
- **No raw file retention**: the uploaded file exists only in the Worker's request-handling memory
  for the duration of the request; it is never written to R2 or D1. Only the minimal per-row
  outcome (see Storage) is persisted.

## Storage (minimal, per §25/§41)

`portfolio_import_jobs`: `id, owner_user_id, group_id, status, total_rows, valid_rows,
invalid_rows, created_domains, failed_domains, monitoring_requested, idempotency_key, created_at,
completed_at`. No `error_category` free-text column beyond a small fixed enum (reuses the same
outcome codes as the preview step). `portfolio_import_rows`: `id, job_id, row_number,
normalised_origin, result, error_code, domain_id`. Neither table stores the raw source row,
spreadsheet formulas, or hidden columns — see `PHASE_09_IMPORT_AND_BULK_JOB_RETENTION.md` for the
retention window.

## Partial success

The confirm response always lists every row's outcome; nothing is ever described as "import
complete" if any row failed — the UI shows "Saved 8 of 10" the same way the existing JSON
batch-import result already does today (`DomainsManager.tsx`'s existing result table pattern,
reused).
