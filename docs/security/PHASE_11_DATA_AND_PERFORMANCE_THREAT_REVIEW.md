# Phase 11 threat review: database, storage, retention and performance hardening

Scope: every real behavior change this phase made to data persistence, retention, monitoring
scheduling, caching, and parser bounds. Does not re-review authentication, billing/checkout, or
the scanner's SSRF chokepoint (`packages/scanner`, ADR-0005) — none of which this phase touches.
Each threat below names the real code path it applies to and the real test that proves the
mitigation, not just an assertion that one exists.

## Cache leaks (cross-user/cross-tenant data exposure via caching)

**Threat**: a response containing one user's private data gets served to a different user from a
shared cache.

**Mitigation**: deny-by-default `Cache-Control: private, no-store` on every SSR response that
doesn't explicitly opt into public caching (`apps/web/src/middleware.ts`). Every explicit public
opt-in (`changelog.astro`, `scanner.astro`, `for/[slug].astro`, `status.astro`) was individually
read in full to confirm no session/cookie-dependent branching before being added — `pricing.astro`
was specifically considered and excluded because it reads `getPageSession()` and branches its
output on auth state. Cloudflare's Workers Cache feature itself (`cache.enabled`) is deliberately
**not** turned on this phase specifically because its actual edge behavior can't be verified from
this session's sandboxed test harness — see `docs/performance/PUBLIC_CACHE_POLICY.md` for the full
reasoning. Residual risk while unattended: none currently active, since the feature that would
make a missing/wrong header exploitable isn't enabled yet.

**Tests**: `apps/web/src/middleware.test.ts` (8 tests) — proves the default applies to HTML, admin,
and API responses alike, and is never overridden by an already-set header.

## Hash-collision assumptions (resource_hash)

**Threat**: treating a `resource_hash` (SHA-256) match as proof of identical content when it isn't,
in a way that causes a security-relevant decision (e.g., skipping a real check).

**Mitigation**: `resource_hash` (Stage 11C/§ resource hashing) is populated for observability only
— nothing in this phase's code makes any decision based on a hash match (no dedup, no skip-logic
implemented yet, per `docs/data/PHASE_11_RESOURCE_HASH_AND_DEDUPLICATION_POLICY.md`'s explicit
scope). SHA-256 collision resistance is cryptographically adequate for a future change-detection
use anyway (not the weak-hash class of risk), but the point is moot today: no control depends on
it.

## Retention deleting active/live data

**Threat**: `runDataRetentionPurge` (Stage 11D) deletes a row that's still in active use — a scan
still needed, a domain's current baseline, a billing record.

**Mitigation**: every purge category's `WHERE` clause was already scoped to genuinely-expired rows
before this phase (age cutoffs, `NOT IN (kept baselines)` for domain scans); this phase's changes
(chunking, dry-run, failure isolation) do not alter _what_ is eligible for deletion, only _how much
of the eligible set_ is processed per invocation and how failures are handled. The one real new
deletion path this phase added — `purgeExpiredAuditContinuations` — only deletes continuations
already past their own 60-minute TTL and never consumed.

**Tests**: `apps/web/tests/integration/data-retention.integration.test.ts` (13 tests, real D1) —
including the specific "purges an expired scan referenced by a scan_diffs row without throwing"
and "purges an expired anonymous scan that still has a lingering audit_continuations row" cases
(RISK-005-adjacent), the new dry-run test (proves nothing is deleted when `dryRun: true`), and the
new chunking test (proves a real 9-row backlog is fully and correctly cleared across exactly 3
bounded runs, not over- or under-deleted).

## Purge-job denial-of-service (a purge job consuming so much of a Worker invocation that other work starves)

**Threat**: an unbounded backlog in one retention category makes a single cron invocation exceed
its CPU/time budget, potentially starving the other jobs sharing that invocation
(`data_retention_purge`, `scheduled_plan_changes`, and — when enabled — `monitoring_sweep` all fire
from the same Cron Trigger, per `docs/operations/PHASE_11_SCHEDULED_JOB_SEPARATION_DECISION.md`).

**Mitigation**: every retention category is now chunk-bounded (`RETENTION_CHUNK_SIZE` ×
`RETENTION_MAX_CHUNKS`, default 500 × 20 = 10,000 rows/category/run maximum) — a category that
still has backlog after its cap reports `backlogRemaining: true` and resumes cleanly next run
(every WHERE clause re-evaluates eligibility fresh, no cursor state to lose or corrupt). A single
category's failure (or a large backlog) no longer prevents other categories, or other jobs sharing
the invocation, from running — see the failure-isolation test below.

**Tests**: the chunking test above (proves the cap is real and resumable); the failure-isolation
test (a genuinely broken `audit_continuations` table — via a real `DROP TABLE` against a throwaway
harness — proves the other four categories still complete and their real counts are unaffected by
the one category's failure).

## Monitoring duplicate-execution / starvation

**Threat**: two overlapping monitoring sweeps both claim and scan the same domain (duplicate work,
possibly duplicate external requests to a customer's site); or a persistently-overdue domain never
gets scanned because newer domains keep winning the batch cap (starvation).

**Mitigation — duplicate execution**: pre-existing and unchanged this phase — `claimDueDomains`'s
atomic claim (`UPDATE ... WHERE next_scan_at <= now` with a lock window) means a second concurrent
sweep's claim affects zero already-claimed rows, since D1 serializes writes to a single database.
**Mitigation — starvation (Stage 11E, this phase's real fix)**: `claimDueDomains` now orders by
`next_scan_at ASC` (confirmed via a real D1 probe that NULL sorts first, so a never-scanned domain
is prioritized over one merely overdue) — before this phase, D1's unspecified row order meant the
same early-created domains could win every sweep indefinitely while an equally- or more-overdue
domain never got claimed.

**Tests**: `apps/web/tests/integration/monitoring.integration.test.ts`'s new fairness test —
3 domains with different overdue-ness, a batch cap of 2, proves the two most-overdue win and the
least-overdue loses, against real D1.

## Operational-metric leakage

**Threat**: the new `/api/admin/capacity` endpoint (Stage 11H) exposes information useful to an
attacker (e.g., real infrastructure sizing that aids a resource-exhaustion attack), or fabricates
data that could mislead an admin's real operational decisions.

**Mitigation**: `requireAdminSession`-gated (an active, non-revoked admin role + an admin session —
same chokepoint every other admin route uses, see `apps/web/src/pages/api/admin/AGENTS.md`), never
reachable by an unauthenticated or non-admin caller. Every returned field is either a real live
query or an honestly-`null` "not obtainable from this Worker" field — no estimated, cached, or
fabricated value is ever returned as if it were real, per CLAUDE.md's core rule. The metrics
themselves (scan volume, D1 table count, monitoring backlog) are operationally useful to CrawlPact
staff and not independently exploitable — they don't reveal customer-identifying data, secrets, or
anything not already inferable from this repo's own public capacity-planning documents.

**Tests**: `apps/web/tests/integration/admin-capacity.integration.test.ts` (3 tests) — a non-admin
session is rejected; real data produces real non-null values; the four honestly-unavailable
metrics are always `null`, never a placeholder.

## R2 orphan-cleanup deleting live assets

**Threat**: the new orphan-inventory tool (Stage 11D) deletes an R2 object that's actually still
referenced by a live `shared_reports` row, or deletes an object mid-upload before its D1 reference
has been written yet.

**Mitigation**: an object is only classified as an orphan if **both** (a) no real `shared_reports`
row's `agency_branding.logoUrl` resolves to its key (checked against every real row with non-null
branding, not a sampled/approximate check), **and** (b) it was uploaded more than `graceMinutes`
(default 60) ago — the grace period specifically exists to protect an object whose D1 write is
still in flight or about to happen. Real deletion additionally requires `dryRun: false` to be
explicitly passed (default `true`) and a `requireAdminAction`-gated reason, per this repo's
standing "never delete real data without explicit intent" rule.

**Tests**: `apps/web/tests/integration/admin-r2-orphan-cleanup.integration.test.ts` (2 tests) —
proves a referenced logo is never flagged, a fresh (within-grace-period) unreferenced object is
never flagged, a genuine orphan is found in dry-run but not deleted, and is only actually deleted
once `dryRun: false` is explicit.

## Parser resource exhaustion / ReDoS

**Threat**: a large or adversarial `rsl.xml`/`sitemap.xml` response forces the parser into
worst-case (potentially catastrophic-backtracking or simply very large) regex work.

**Mitigation**: both parsers now have a dedicated pre-parse byte bound (Stage 11C/§13) —
`MAX_RSL_SCAN_BYTES` / `MAX_SITEMAP_SCAN_BYTES`, both 200,000 bytes, matching the existing HTML
parser's own established bound — applied via `.slice()` _before_ any regex runs, so the regex
engine's input is capped regardless of the real fetched size (itself already capped at 2 MiB by
`safe-fetch.ts`, but 2 MiB was still an unbounded-relative-to-parsing-cost worst case before this
fix). Neither parser's regexes are of the nested-quantifier shape that causes catastrophic
backtracking independent of input size (confirmed by reading both regex patterns — simple
character-class/tag matching, no `(a+)+` -style construction) — the byte bound addresses the
"large adversarial input" vector specifically, which was the real, previously-unbounded gap.

**Tests**: `packages/scanner/src/signals/signals.test.ts` — 24 tests including explicit
over-the-bound cases for both parsers (a document larger than the bound truncates before parsing
and discloses `truncated: true`; a `<license>`/`<loc>` element starting within the bound is still
found; the no-match path also correctly reports `truncated`).

## Migration partial failure

**Threat**: one of this phase's new migrations (0022–0025) fails partway through, leaving the
schema in an inconsistent state.

**Mitigation**: 0022 and 0023 (the two table-rebuild migrations) use `PRAGMA defer_foreign_keys=ON`
— the same proven pattern from migrations 0013–0015 — inside D1's own implicit per-statement-batch
transaction, so a failure partway through a rebuild rolls back the whole migration file, not just
the failed statement. 0024 and 0025 are simple additive `ALTER TABLE ADD COLUMN`/`CREATE INDEX`
statements with no multi-step rebuild to partially fail. All four were validated via
`pnpm run db:validate` (42 tables verified consistent between migrations and the Drizzle schema)
and applied successfully to this phase's own local D1 test harness dozens of times across every
integration test run in this phase — a real partial-failure would have surfaced as every
subsequent test in the suite failing to apply migrations, which never happened.

## What this phase deliberately does not change

Authentication, billing/checkout, crawler-evaluation logic, and the scanner's SSRF safe-fetch
chokepoint are untouched by this phase — see the phase's own explicit scope boundary
(`docs/reports/` completion report) for what remained out of bounds throughout.
