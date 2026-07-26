# D1/R2 Data Placement Policy

**Status:** Accepted **Date:** 2026-07-26

Phase 6 of the Cloudflare infrastructure-alignment brief. This document defines where CrawlPact's
data lives — and records the evidence-based decision that **R2 is not adopted at this time.**

## Decision: do not adopt R2 yet

Per the brief's own instruction ("First determine whether the latest codebase currently needs R2.
Do not add R2 only to satisfy a checklist"), this policy's first job is to answer that question
honestly. The answer, based on `docs/deployment/CLOUDFLARE_ARCHITECTURE_AUDIT.md` (Phase 1 audit)
and `docs/data/D1_STORAGE_CAPACITY_AUDIT.md` (Phase 5 audit): **no real technical requirement for
R2 exists in the current codebase.**

- No file uploads exist anywhere — agency branding is URL-only (a "Logo URL" text field,
  `ShareReportDialog.tsx`); the browser fetches the customer's externally-hosted image directly,
  CrawlPact never stores or proxies image bytes.
- No generated report/export files are persisted — the CSV export is built in-memory per request
  and streamed directly (`apps/web/src/pages/api/domains/export.csv.ts`); nothing is written to
  disk or object storage.
- Scan evidence, while stored as full-text TEXT in D1, is small **per scan**: capped at 100,000
  bytes per resource, up to 8 resources per scan (~800 KB worst case, typically far less). At
  **today's** volume (pre-launch, no real production data), D1's verified 500 MB per-database
  ceiling (`docs/deployment/CLOUDFLARE_RESOURCE_LIMITS.md` #14) is not remotely threatened. This is
  a "not yet," not a "never" — see revisit trigger #2 below, which is materially closer than a
  cursory reading of the per-scan figures alone would suggest, per the full growth model in
  `docs/data/D1_STORAGE_CAPACITY_AUDIT.md`.

Introducing R2 today would mean standing up a second storage system, a storage abstraction layer,
bucket bindings for two environments, and new tests — real, ongoing complexity — to solve a
problem that does not yet exist. This section exists to make that judgment explicit and
revisitable, not to close the door on R2 permanently.

### Revisit triggers — when this decision should be reopened

Reopen this decision (write a new dated section below, or a superseding ADR if the conclusion
changes) if **any** of the following become true:

1. **A real file-upload feature is added** — e.g. agency logo upload (rather than URL), a future
   customer-uploaded asset the SRS explicitly allows. Any binary upload is an immediate, clear R2
   candidate per the brief's own "Never store... small relational rows in R2 merely to use R2" /
   "large or binary objects in private R2" framing.
2. **The production D1 database crosses 60% of its verified 500 MB per-database ceiling** (300 MB)
   — the warning threshold recorded in `docs/operations/CLOUDFLARE_UPGRADE_TRIGGERS.md`. **This is
   not a distant hypothetical**: `docs/data/D1_STORAGE_CAPACITY_AUDIT.md` (Phase 5, 2026-07-26)
   models the SRS's own target scale (150+ paid customers, ~1,000 domains) and finds the database
   could reach 45–70% of the cap within one year and cross it entirely between year 1–2, driven
   almost entirely by `scan_resources.snapshot_text` rows tagged `resource_type = 'html_meta'` —
   which capture the **full truncated homepage HTML body**, not just extracted meta tags
   (`persist-scan.ts:99`) — compounding across Pro's 24-month and Agency's 36-month retention
   windows. **The recommended first response when this trigger approaches is not R2** — it is two
   much cheaper D1-side changes, in order of expected impact: (a) reduce what `html_meta` actually
   captures to the parsed meta-tag/Content-Signals fields already extracted from it, instead of
   the full page body (the single largest lever identified); (b) populate the existing-but-unused
   `resource_hash` column and skip a full-text rewrite when a monitoring re-scan's content is
   byte-identical to the prior scan's. Only if these prove insufficient does moving large/append-only
   evidence bodies to R2 become the next lever.
3. **Report generation changes** to produce a persisted artifact (e.g. a PDF export, a static
   HTML snapshot for very-long-term archival) rather than the current render-live-from-D1 model.
4. **Content-hash deduplication is implemented** for `scan_resources` (populating the currently
   unused `resource_hash` column) and the deduplicated bodies grow large enough that a
   content-addressed object store becomes more efficient than repeated D1 rows — this is a
   plausible _first_ R2 use case if it arrives, since it's append-only, content-addressed, and
   naturally bounded (see "Content-addressed evidence" note below).
5. **Bulk evidence export/portability** is added (e.g. "download all raw evidence for this
   domain's history as a zip") — a bounded, generate-once artifact well-suited to R2, poorly
   suited to being built in-memory per request at scale.

None of these are true today. This is a "not yet," not a "never."

## Keep in D1 (current and unchanged)

All of CrawlPact's actual data stays in D1 today — there is nothing to move. Per the brief's
categorisation, this includes:

- Data that must be queried, filtered, joined, or transactionally updated: users, passkeys,
  sessions, plans, subscriptions, domains, groups, scans, scan status, findings, crawler matrix
  rows, registry metadata/releases, ruleset releases, notifications, shared-report metadata, audit
  logs, runtime configuration, product events.
- Small structured scan summaries and crawler evaluation results (`scan_crawler_results`,
  `findings`).
- Bounded, capped-size resource snapshots (`scan_resources.snapshot_text`, ≤100,000 bytes each) —
  see "Content-addressed evidence" below for the one identified future optimisation within D1
  itself, short of any R2 migration.

## Store in R2 (deferred — no current candidate)

Per the brief's list of potential approved uses (larger bounded scan-evidence snapshots,
deduplicated raw policy-resource bodies, generated CSV exports, generated future report files,
agency logo uploads, other explicitly-allowed customer uploads, operational backup exports, large
immutable registry-source snapshots) — **none currently exist in this codebase.** Every one of
these is either not built at all (uploads, persisted exports/reports) or is small enough to remain
comfortably in D1 today (evidence snapshots). This section will be populated with a real object
inventory the first time any revisit trigger above fires.

## Never store (unchanged, applies regardless of R2 adoption)

Full-site crawls; user passwords; passkey private keys; recovery codes in plaintext; Paddle
secrets; session tokens in plaintext; unbounded HTML pages; arbitrary customer files outside the
approved scope. None of these exist in the current schema or codebase — verified during the Phase
1 architecture audit.

## Measured object-size threshold (for when R2 is eventually adopted)

The brief asks for a measured threshold rather than a guessed one. Based on the verified D1 limits
(`CLOUDFLARE_RESOURCE_LIMITS.md`: 2 MB max row size, 500 MB max database size) and the current
`persist-scan.ts` cap (100,000 bytes per resource, well under the 2 MB row ceiling), the
recommended future threshold — **not implemented today, since no R2 use case exists yet** — is:

> An object belongs in R2 once its content would need to exceed roughly **200 KB** (double the
> current per-resource D1 cap) to be useful uncapped, **or** once it is binary/non-relational
> (an uploaded image, a generated PDF) regardless of size. Below that, D1's row-size headroom
> (2 MB) and per-database headroom (500 MB, currently used at a tiny fraction — see
> `D1_STORAGE_CAPACITY_AUDIT.md`) make D1 the simpler, single-system choice.

This threshold exists so a future engineer doesn't have to re-derive it from first principles —
it is not a current operational limit.

## Content-addressed evidence — a D1-only optimisation available before any R2 migration

Independent of the R2 question, the Phase 1 audit found that `scan_resources.resource_hash` exists
as a column but nothing populates it — every scan (including an unchanged monitoring re-scan)
writes a fresh full-text row rather than detecting byte-identical content. Populating this column
and skipping a full-text rewrite when a re-scan's content hasn't changed (storing a pointer/hash
reference to the prior identical row instead) would reduce D1 write volume and storage growth for
monitored domains, entirely within D1 — no object storage required. This is recorded here as a
concrete, low-risk future improvement, not implemented in this pass (code changes were explicitly
deferred pending review of this policy — see `docs/status/IMPLEMENTATION_STATUS.md`).

## Object metadata (not yet applicable)

The brief specifies a metadata schema (object ID, R2 key, environment, category, owner/domain/scan
ID, content hash, MIME type, sizes, compression, timestamps, retention expiry, deletion state,
sensitivity classification, schema version) for whenever R2-backed objects exist. No such schema
is created in this pass, since there are no objects to describe yet — this is deferred to the
migration that actually introduces the first R2 use case, at which point it should be designed
against that use case's real requirements rather than speculatively now.

## Related documents

- `docs/deployment/CLOUDFLARE_ARCHITECTURE_AUDIT.md` — Phase 1 evidence this policy is built on.
- `docs/data/D1_STORAGE_CAPACITY_AUDIT.md` — Phase 5 per-table growth model.
- `docs/operations/CLOUDFLARE_UPGRADE_TRIGGERS.md` — the 60%/80% D1-size thresholds referenced
  above.
- `docs/data/DATA_RETENTION.md` — retention windows that bound how large `scan_resources` can grow
  per plan tier.
