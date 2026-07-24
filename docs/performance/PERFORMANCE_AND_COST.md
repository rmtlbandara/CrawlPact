# Performance and Cost Hardening

Part 3 Step 19. This documents a real audit of the actual query/scheduling code (not a
theoretical checklist) plus real, currently-published Cloudflare platform limits (fetched
2026-07-24, not recalled from training data — see citations below), what was fixed as a result,
and what's disclosed as a deferred, tracked gap rather than silently left unaddressed.

## What was found and fixed

| Issue                                                                                                                                                                  | Where                                                                                                                                  | Fix                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N+1 query: one extra `findings` query per domain row on every load of the global admin domains table                                                                   | `lib/admin/domains.ts` `listAllDomains`                                                                                                | Single `LEFT JOIN` + `GROUP BY` computing `criticalFindingsCount` per domain in one query; also pushed `query`/`monitoringState` filters into SQL (`WHERE`/`LIKE`) instead of fetching every row and filtering in JS |
| Unbounded per-domain loop in the **daily cron** — fetched every domain in the system and issued one `DELETE` per domain regardless of whether it had anything to purge | `lib/data-retention.ts` `purgeExpiredDomainScans`                                                                                      | Restructured to loop over `plans` (always exactly 4 rows) instead of domains, issuing one bulk `DELETE ... WHERE domain_id IN (subquery)` per plan                                                                   |
| Unbounded aggregation over the entire, ever-growing `scans` table                                                                                                      | `lib/admin/domains.ts` `getHighFailureHosts`                                                                                           | Scoped to a rolling `windowDays` (default 90) — old failure patterns aren't actionable operational signal anyway                                                                                                     |
| Missing indexes on columns real queries filter/sort by                                                                                                                 | `scans.started_at`, `transactions.occurred_at`, `webhook_events.received_at`, `admin_audit_logs.target`, `security_events.resolved_at` | `migrations/0012_performance_indexes.sql` (forward-only, per ADR-0002)                                                                                                                                               |

All four are covered by real, passing integration tests (`data-retention.integration.test.ts`,
`admin-domains-scans.integration.test.ts`) that were run against real D1 before and after —
not just typechecked.

## Already well-designed (found while auditing, not something to "fix")

- The scanner's own per-scan external-request budget (`MAX_EXTERNAL_REQUESTS = 12` in
  `packages/scanner/src/orchestrator.ts`) is already comfortably inside Cloudflare's Workers
  **free-tier** subrequest limit (50/invocation) — this wasn't designed against that limit, but
  it happens to already respect it.
- The scheduled monitoring sweep (`monitoring.ts`) already caps domains claimed per cron tick via
  `monitoring_scan_batch_size` — confirmed still correctly enforced (Part 2 Step 15 work).
- `getActiveRegistry`'s crawler join is unbounded but currently returns 21 rows (admin-curated,
  no self-publish feature exists) — not a real problem at today's scale; revisit if a
  self-publish/community-registry feature is ever added.
- Only one D1 database is used for the whole product — well inside the free-tier 10-database
  account limit, so there's no multi-database sprawl to manage.
- `runDataRetentionPurge` and the monitoring sweep both run from the **same** cron trigger
  (`worker.ts`'s `scheduled()`) rather than two separate ones — keeps the account comfortably
  under the free-tier 5-Cron-Trigger limit regardless of how many maintenance jobs get added.

## Real, disclosed, deferred gaps (not silently dropped)

- **Pagination is designed but not wired to any admin UI.** `packages/core/src/api/contracts/admin.ts`
  defines a cursor-based `PageRequest`/`PageResponse` contract, `@crawlpact/ui` has a working
  `Pagination` component, and `lib/admin/audit-log.ts`'s `listAdminAuditLogs` already supports
  `limit`/`offset` — but no admin page actually renders pagination controls or passes a
  cursor/offset through. The interim mitigation applied this pass: every admin list function now
  has a hard `.limit()` ceiling (e.g. `MAX_DOMAINS_PER_LIST = 200` in `lib/admin/domains.ts`) so
  a large customer base can't turn an admin page load into an unbounded query, but an operator
  genuinely cannot page past that ceiling today. Wiring real pagination into every admin list
  view is a distinct, larger UI task, tracked here rather than done as a shallow, partial pass
  across a dozen files under this step's time budget.
- **No `Cache-Control` layer for anonymous/SSR content.** Every request — including anonymous
  audit results and public marketing pages — hits Astro SSR (and D1, for anything data-backed)
  fresh. Only Cloudflare's auto-generated `_headers` for hashed static assets
  (`/_astro/*: immutable, max-age=31536000`) provides any caching today. A caching layer for
  genuinely cacheable content (e.g. crawler/guide pages, which only change when an admin
  publishes a registry release or a new guide ships) is real, valuable future work, not
  implemented in this pass.
- **Secondary index gap**: `scheduled_job_runs.started_at` has no index. Left alone deliberately
  — that table gains roughly 2 rows/day, so a missing index there has no measurable query-time
  effect at any realistic scale; adding it would be pure ceremony.
- **JS/CSS bundle size** (736 KB total across the site, no single bloated chunk — Astro's
  default per-island chunking already keeps this reasonable) was measured and is fine at current
  scale; not treated as an action item this pass.

## Cloudflare platform limits (verified live, not recalled)

Fetched from `developers.cloudflare.com/d1/platform/limits/` and
`developers.cloudflare.com/workers/platform/limits/` on 2026-07-24 — current published numbers,
not an assumption:

| Limit                      | Free              | Workers Paid                  |
| -------------------------- | ----------------- | ----------------------------- |
| CPU time per HTTP request  | **10 ms**         | 30s default, up to 5 min      |
| Requests per day           | 100,000           | No limit                      |
| Subrequests per invocation | 50                | 10,000 (up to 10M by request) |
| Cron Triggers per account  | 5                 | 250                           |
| D1 max database size       | 500 MB            | 10 GB                         |
| D1 databases per account   | 10                | 50,000                        |
| D1 max query duration      | 30 s (both tiers) | 30 s (both tiers)             |

**Load-bearing conclusion for Step 26 (production configuration): CrawlPact's real workload
almost certainly requires the Workers Paid plan, not the free tier.** A single audit scan does
several sequential network fetches, parses each response, evaluates every registry crawler
against the parsed `robots.txt`, and writes multiple D1 rows (scan, resources, per-crawler
results, findings) — all real CPU work, not I/O wait, and the free tier's 10ms-per-request CPU
budget is very tight for that shape of work. This has not been measured against a real deployed
Worker (no production Cloudflare account is connected yet — see
`docs/deployment/CLOUDFLARE_CONFIGURATION.md`), so this is a documented expectation to verify
during Step 26's production configuration prep and an actual pre-launch smoke test, not a
confirmed measurement — stated as such deliberately, per this project's rule against presenting
an unmeasured assumption as a verified fact.
