---
Document owner: Engineering owner
Status: current-authoritative (Phase 1, Workstream 28 — security/privacy review)
---

# Security and Privacy Review — 2026-09-17

Scoped to what this pass actually added: `POST /api/rum`, `/admin/growth`, the persisted
`gsc_daily_metrics`/`ga4_daily_metrics`/`crux_snapshots`/`rum_vitals` tables, the scheduled
`growth_collection` job, the GitHub governance changes, and the `crw_applebot` data addition.
Nothing else in the repository was touched, so nothing else is re-litigated here.

## `POST /api/rum` (new, unauthenticated, public-facing)

Checked against directive §11's explicit list:

- **Payload size / shape**: `zod` schema caps `route` at 500 characters, `metrics` to at most 5
  entries (matches the number of distinct metric names that exist), each `value` typed as a number
  (not a string an attacker could smuggle markup into) and `rating` constrained to a 3-value enum.
- **Arbitrary route values**: never stored raw — `normalizeRumRoute` collapses every path to one of
  a small, fixed set of buckets server-side; a client cannot cause a new, unbounded value to reach
  the database.
- **Malformed/impossible metric values**: `isValidMetricValue` rejects negative, non-finite, or
  absurdly large numbers per metric; an individual bad value in a batch is dropped, not trusted.
- **Origin/surface spoofing**: `surface` (`public`/`app`) is derived server-side from the request's
  Host header via the existing `classifyRequestOrigin`, never taken from the client body.
- **Rate limiting / flooding**: reuses the existing `security_events`-backed sliding-window limiter
  (60 requests / 5 minutes per IP-hash) — the same mechanism already protecting
  `/api/domains/export.csv.ts` and others; verified by a real integration test that a caller
  actually gets throttled, not just that the code path exists.
- **Stored XSS via ingested data**: RUM data is never rendered as HTML anywhere — the dashboard only
  shows aggregate p75/sample-count numbers, never a raw route or any RUM string field.
- **SQL injection**: all queries go through Drizzle's query builder or its `sql` template with
  `${}` interpolation (parameterized, never string-concatenated).
- **Sensitive-URL leakage**: no query string, fragment, or full URL is ever stored — only the
  bounded route bucket.
- **Unauthenticated by design**: matches the existing `/api/analytics/track` precedent exactly (a
  real visitor beacon endpoint has no session to require); this is not a new class of exposure for
  this codebase.

## `/admin/growth` (new page)

Uses `getAdminPageSession` — the exact same authorization call every other Super Admin page in this
codebase uses (`/admin/index.astro`, copied verbatim), not a new authorization implementation. GSC
query/page dimension values (directive §27's specific concern: "Search Console query strings may
contain arbitrary user search text... never render API-derived text as trusted HTML") are rendered
via plain Astro expression interpolation (`{row.value}`) with no `set:html` anywhere in the file —
Astro escapes these by default, so a malicious or unusual query string in real Search Console data
cannot execute as HTML. Verified by reading the file for any `set:html` usage: none exists.

## Scheduled `growth_collection` job

Isolated in its own `ctx.waitUntil`, its own `scheduled_job_runs` row, and its own try/catch,
matching every other job in `worker.ts` — a failure here cannot block or be blocked by the
monitoring sweep, retention purge, or scheduled-downgrades jobs (verified by test:
`isolates a GA4 misconfiguration from GSC and CrUX succeeding` and the equivalent GSC-partial-
failure test in `collect.test.ts`). No secret (the Google service-account JSON, API keys) is ever
logged — the job's `error_summary` field only ever contains row counts and status strings.

## GitHub governance changes

Covered in `GIT_AND_REPOSITORY_RECONCILIATION.md`: branch protection and secret scanning were
verified genuinely absent before being added, and the specific ruleset added was checked against
`merge-when-green.yml`'s actual merge logic first so it could not create a merge deadlock. No
existing security control was weakened.

## `crw_applebot` addition

Pure reference data (a crawler's name/token/purpose/source URL) — no executable code path, no new
attack surface.

## What was not found

No new secret was introduced anywhere in this branch's diff (checked via a targeted grep for
key/secret/password/private-key patterns across the full `main..HEAD` diff, excluding the
already-established `ci-placeholder`/test-fixture values this repo's own tests use). No existing
authentication, CSRF, WebAuthn, host-boundary, or Paddle-billing code path was touched by anything
in this pass.

## Post-deployment re-verification (2026-09-17, after Production deploy)

Re-checked live, after `9a3f950` actually reached Production:

- Repository secret-scanning alerts: **0 open** (`gh api .../secret-scanning/alerts`).
- Live `POST /api/billing/webhook` with no valid signature → `400`/`403` depending on path (both
  fail closed, never a 200 or a 500 leaking internals) — confirmed on both the apex (real endpoint)
  and the app host (`404`, wrong-host rejection, confirming host-boundary enforcement survived this
  deploy unchanged).
- Live `POST /api/rum` with a malformed payload → `400 VALIDATION_FAILED`, never a 500 or a silent
  accept.
- Live `GET /admin/growth` unauthenticated → `302` to `/sign-in`, `cache-control: private,
no-store` — no data leakage to an unauthenticated caller.
- The production deploy workflow's own 43-point smoke test (independently read from its real job
  log, not just its green checkmark) passed 43/43 on the first attempt, including
  `APP_ONLY API rejected on the apex`, `PUBLIC_ONLY API rejected on the app host`, and the Paddle
  webhook signature-rejection check — none of Phase 1's changes regressed any of these.
- The one manual `/api/rum` test beacon sent during live endpoint verification was deleted
  immediately afterward via a scoped `DELETE` so it never appears in real visitor data.
