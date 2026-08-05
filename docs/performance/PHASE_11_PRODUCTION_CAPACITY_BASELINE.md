# Phase 11 production capacity baseline

Stage 11A. All figures below are **measured**, via read-only Cloudflare MCP calls and D1 aggregate
queries against the real production database, on 2026-08-05, unless explicitly marked
**(estimate, from Phase 5/10/11 of the earlier Cloudflare infrastructure-alignment brief)** or
**(not measurable this session — see note)**. No production data was modified to produce this
document; no customer content, raw domain names, or secrets are recorded below.

## 8.1 Cloudflare production inventory (measured via Cloudflare MCP)

| Item                                            | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account plan (zone `crawlpact.com`)             | **Free** (`rate_plan.id: "free"`, confirmed via `GET /accounts/{id}/subscriptions`)                                                                                                                                                                                                                                                                                                                                                                                          |
| Workers Paid subscription                       | Not present — no `workers_paid` entry in the account's subscription list                                                                                                                                                                                                                                                                                                                                                                                                     |
| R2 subscription                                 | `r2_paid` (pay-as-you-go metering) is active on the account, adopted 2026-07-30 alongside the `AGENCY_LOGOS` bucket — this is R2's standard usage-based billing activation, not evidence of meaningful usage (see §8.2)                                                                                                                                                                                                                                                      |
| Worker name / ID                                | `crawlpact-web` / `3d5f91afdf5245b0b067a7525e9e387f`                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Compatibility date                              | `2026-07-01` (`apps/web/wrangler.jsonc`)                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Compatibility flags                             | `nodejs_compat`                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Worker routes                                   | Served via the `crawlpact.com` zone (no explicit `routes` array in `wrangler.jsonc` — assets + Worker via the zone's default route)                                                                                                                                                                                                                                                                                                                                          |
| Cron Triggers                                   | 1 configured: `"0 3 * * *"` (daily, 03:00 UTC) — 1 of the 5 Free-plan slots used, 4 free                                                                                                                                                                                                                                                                                                                                                                                     |
| D1 bindings                                     | `DB` → `crawlpact-db` (production), `crawlpact-db-preview` (preview env)                                                                                                                                                                                                                                                                                                                                                                                                     |
| R2 bindings                                     | `AGENCY_LOGOS` → bucket `crawlpact` (production), `crawlpact-preview` (preview env)                                                                                                                                                                                                                                                                                                                                                                                          |
| KV bindings                                     | `SESSION` (production and preview, distinct namespace IDs)                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Queue / Durable Object / service bindings       | None                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Other Workers on this Cloudflare account        | `crawlpact-web-preview`, `crawlpact-e2e-fixture` (CrawlPact's own controlled e2e test target), plus 4 unrelated Workers belonging to other projects on the same account (`lowerbillhome`, `nimblegrid`, `ezroamguide`, `echobuddha`) — not part of this audit                                                                                                                                                                                                                |
| Production D1 database size                     | **3,461,120 bytes (~3.30 MB)** as of the last query in this session — **0.69% of the 500 MB per-database cap**, nowhere near the 300 MB (60%) warning threshold                                                                                                                                                                                                                                                                                                              |
| Preview D1 database size                        | 700,416 bytes (~684 KB)                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Production table count                          | **42** (via `sqlite_master`, excluding `sqlite_%`/`_cf_%`/`d1_%` internal tables)                                                                                                                                                                                                                                                                                                                                                                                            |
| R2 bucket (`crawlpact`)                         | Exists, `Standard` storage class, `APAC` location. Object count/size **not directly listable** via the connected MCP tools this session (no R2 object-list tool exposed) — see §8.2 for the D1-side evidence that constrains what can legitimately exist in it                                                                                                                                                                                                               |
| Recent Worker error volume                      | **0 error events in the last 7 days** (`$metadata.error exists` filter against the Workers Observability API, `crawlpact-web`, 2026-07-29 to 2026-08-05) — no CPU-limit (1102) or any other logged error occurred in this window                                                                                                                                                                                                                                             |
| Worker CPU-time-per-invocation percentile query | **Not obtainable this session** — the Workers Observability "calculations" view returned empty/zero aggregation tables for every numeric key tried (`$metadata.duration`, and a nonexistent `$metadata.cpuTime`, confirmed absent via `observability_keys`), a tooling limitation of this MCP surface, not a measured "zero." The **absence of any error event** (above) is the evidence actually relied on for "no CPU-limit failures observed," not a duration percentile. |

## 8.2 D1 production measurements (measured, real aggregate queries)

### Row counts (all 42 tables enumerated; below are the usage-driven ones)

| Table                  |  Rows | Notes                                                                                                                                  |
| ---------------------- | ----: | -------------------------------------------------------------------------------------------------------------------------------------- |
| `users`                |     2 |                                                                                                                                        |
| `domains`              |     9 |                                                                                                                                        |
| `scans`                |    26 |                                                                                                                                        |
| `scan_resources`       |   204 | **204 ÷ 26 ≈ 7.85 rows/scan** — matches the "up to 8" estimate in `docs/data/D1_STORAGE_CAPACITY_AUDIT.md` almost exactly              |
| `scan_crawler_results` |   546 | **546 ÷ 26 ≈ 21.0 rows/scan** — matches the "21 crawlers, unconditional" estimate in `docs/operations/SCAN_CAPACITY_BUDGET.md` exactly |
| `findings`             |    87 | **87 ÷ 26 ≈ 3.35 rows/scan** — close to the "~2-3 average" estimate                                                                    |
| `scan_diffs`           |     1 |                                                                                                                                        |
| `product_events`       | 1,037 |                                                                                                                                        |
| `security_events`      |    95 |                                                                                                                                        |
| `notifications`        |     0 |                                                                                                                                        |
| `webhook_events`       |    60 |                                                                                                                                        |
| `transactions`         |     3 |                                                                                                                                        |
| `shared_reports`       |     1 | (`agency_branding` is `NULL` on the one row — no logo was ever uploaded through it)                                                    |
| `admin_audit_logs`     |     0 |                                                                                                                                        |
| `sessions`             |    60 |                                                                                                                                        |
| `scheduled_job_runs`   |    18 | See §8.4 — real monitoring/retention execution history                                                                                 |
| `billing_customers`    |     1 |                                                                                                                                        |
| `subscriptions`        |     1 |                                                                                                                                        |

**Total D1 write statements per scan, computed from real production data**: `1 (scans) + 7.85 (scan_resources) + 21 (scan_crawler_results) + 3.35 (findings) ≈ 33.2` — this **confirms** the "typical ~30–35 statements" estimate in `docs/operations/SCAN_CAPACITY_BUDGET.md` §1.5 was accurate, not an overstatement. Monitoring-sweep scans add the claim `UPDATE` + outcome-recording writes on top (2–4 more, per that document), consistent with its own estimate.

### `scan_resources.snapshot_text` size by resource type — **the single most consequential measurement in this document**

| `resource_type`   | Rows |  Avg bytes | Max bytes | Prior estimate (Phase 5 audit) | Delta                                                                                                         |
| ----------------- | ---: | ---------: | --------: | -----------------------------: | ------------------------------------------------------------------------------------------------------------- |
| `html_meta`       |   26 | **53,554** |    60,590 |                ~10,000 (10 KB) | **≈5.4× the estimate**                                                                                        |
| `sitemap`         |   26 | **20,891** |    25,405 |                ~1,500 (1.5 KB) | **≈13.9× the estimate**                                                                                       |
| `robots_txt`      |   26 |      1,927 |     2,096 |                         ~1,200 | ≈1.6×                                                                                                         |
| `llms_txt`        |   26 |      1,097 |     9,214 |                           ~500 | ≈2.2×                                                                                                         |
| `llms_full_txt`   |   26 |      1,046 |     8,753 |                           ~400 | ≈2.6×                                                                                                         |
| `rsl`             |   26 |      1,089 |     8,753 |                           ~200 | ≈5.4× (mostly a fixed-cost "not present" placeholder row, per the parser reading a 404)                       |
| `content_signals` |   24 |          0 |         0 |                           ~250 | Empty on every real scan so far — no site tested has set a `Content-Signal` header yet                        |
| `http_headers`    |   24 |          2 |         2 |                           ~150 | A fixed 2-byte placeholder (`"{}"`), not the ~150-byte estimate — real header capture is smaller than assumed |

**Reading this honestly**: the Phase 5 estimation exercise explicitly flagged `html_meta`'s size as "this document's single biggest sensitivity" and recommended re-measuring against a real database before trusting the capacity model — this measurement vindicates that caution. At **53,554 bytes average** (not 10,000), and with `sitemap` also running far above its estimate, the real per-scan effective storage cost is measurably higher than either the "as-observed" (~26.0 KB) or even a naive re-scaling would suggest. Recomputing with real averages:

- Real raw bytes/scan ≈ `53554×0.85(rate) + 20891×0.85 + 1927×0.85 + 1097×0.85 + 1046×0.85 + 1089×0.85 + 0 + 2×0.85` — using the measured per-scan attempt rate (204/26 rows over 8 possible types ⇒ ~85% attempt/success rate per type, consistent with the "6 base + 2 conditional" model) ≈ **≈68,000 bytes/scan raw**, versus the Phase 5 document's own "as-observed" estimate of ~21,700 bytes/scan raw — **roughly 3.1× higher than previously modeled**, driven almost entirely by `html_meta` and `sitemap` both running several times larger than assumed.
- This directly informs Stage 11C's storage-reduction priority: `html_meta`'s full-homepage-HTML capture is confirmed, with real numbers, as the dominant and most urgent lever — even more urgent than the estimate already suggested.

### Retention/purge evidence

- **`scan_diffs`**: 1 real row. Its `previous_scan_id`/`current_scan_id` foreign keys have no `ON DELETE` clause — confirmed still present in the schema at this HEAD (see Stage 11B).
- No `product_events`/`security_events`/`notifications` purge job exists — confirmed by reading `apps/web/src/lib/data-retention.ts` in full (unchanged since the Phase 5/Part 3 audits that first found this).
- **Oldest due-domain / retention-failure evidence**: see §8.4 — `scheduled_job_runs` gives a direct, real answer instead of requiring inference.

## 8.3 Scan performance measurements

**Not run as a separate synthetic benchmark in this stage** — per the phase prompt's own instruction ("Do not perform uncontrolled load testing against production" / "Use preview environment, controlled public test domains, synthetic fixtures"), real before/after scan-persistence timing is instead captured directly around the Stage 11C D1-batching change itself (the code path this number is most relevant to), using the existing `crawlpact-e2e-fixture` controlled test target already used by this repo's own e2e suite — see `docs/performance/PHASE_11_SCAN_PERSISTENCE_BENCHMARK.md` for that measurement, produced later in this phase once the batching change exists to compare against a real "before."

## 8.4 Monitoring measurements (measured — real `scheduled_job_runs` history)

The `scheduled_job_runs` table (migration `0007_admin_security.sql`, previously undocumented as a
queryable capacity-evidence source in any prior audit) gives a **direct, real** answer to
questions the Phase 11 documents above could previously only estimate:

| Date (UTC) | `monitoring_sweep`                                                            | `data_retention_purge` | `scheduled_plan_changes` |
| ---------- | ----------------------------------------------------------------------------- | ---------------------- | ------------------------ |
| 2026-08-05 | completed, 0 domains selected                                                 | completed              | completed                |
| 2026-08-04 | completed, 0 domains selected                                                 | completed              | —                        |
| 2026-08-03 | completed, 0 domains selected                                                 | completed              | —                        |
| 2026-08-02 | completed, 0 domains selected                                                 | completed              | —                        |
| 2026-08-01 | completed, **1** domain selected, 1 scan completed, 0 failed                  | completed              | —                        |
| 2026-07-31 | completed, 0 domains selected                                                 | completed              | —                        |
| 2026-07-30 | completed, **4** domains selected, 4 scans created, 3 completed, **1 failed** | completed              | —                        |
| 2026-07-29 | (not in the last-18-rows window queried)                                      | completed              | —                        |
| 2026-07-28 | —                                                                             | completed              | —                        |
| 2026-07-27 | —                                                                             | completed              | —                        |

- **Every recorded run has `status = 'completed'`** — zero `'failed'` job-level rows in the entire
  history queried (18 most recent rows, spanning 2026-07-27 to 2026-08-05). This is real,
  first-party evidence that the daily cron itself has never crashed or hit the CPU ceiling at
  today's real traffic — consistent with, and stronger than, the "0 Worker errors in 7 days"
  finding in §8.1.
- **Maximum batch actually processed in one sweep so far: 4 domains** (2026-07-30), with 1
  individual scan failure inside that batch (not a job-level failure — the sweep itself still
  completed and recorded the outcome correctly). This is far below the CPU-risk zone
  `docs/operations/MONITORING_CAPACITY_PLAN.md` models (its own estimate: "already strains" at
  ~8–9 domains/day) — real production has never yet approached that zone, consistent with this
  account's real current scale (9 domains total, only 2 users).
- **This does not contradict the modeled capacity risk** — it confirms the model's own framing:
  the risk is about what happens as domain count scales, not a claim that today's traffic already
  exceeds Free-tier capacity. Today's traffic is comfortably inside Scenario 1 of
  `MONITORING_CAPACITY_PLAN.md` ("5 Solo customers — fits, comfortably").
- **A third scheduled job exists and was not previously documented at this granularity**:
  `scheduled_plan_changes` (visible in the real data, ran once in the queried window,
  2026-08-05). Investigated: this is the existing scheduled Paddle plan-change-application job
  (`apps/web/src/lib/billing/plan-change.ts`-adjacent scheduled-change application, Phase 6) — it
  also runs from the same daily `scheduled()` handler. This means **three**, not two, distinct job
  types currently share one daily cron invocation, not just monitoring + retention as
  `MONITORING_CAPACITY_PLAN.md` (written before Phase 6) described. Relevant to the Stage 11E/20
  "scheduled-job separation" decision — see that section.

## 8.5 Page-performance baseline (production Lighthouse, real runs)

Carried over from the real production measurement already taken and disclosed in
`docs/seo/PHASE_07_SEARCH_PERFORMANCE_BASELINE.md` (2026-08-04, one run per page, not yet the
3-run median this phase's stricter methodology requires):

| Path                    | Performance |      LCP | Accessibility | Best Practices | SEO | CLS |
| ----------------------- | ----------: | -------: | ------------: | -------------: | --: | --: |
| `/`                     |          79 | 4,653 ms |           100 |             92 | 100 |   0 |
| `/pricing`              |          99 | 1,787 ms |           100 |             92 | 100 |   0 |
| `/crawlers/amazonbot`   |          71 | 5,070 ms |           100 |             92 | 100 |   0 |
| `/for/agencies`         |          73 | 4,788 ms |           100 |             92 | 100 |   0 |
| `/platforms/cloudflare` |          90 | 3,300 ms |           100 |             92 | 100 |   0 |

This is the RISK-033 baseline this phase is chartered to investigate and improve. **Re-measured
with 3+ runs and full metric breakdown (TTFB/FCP/TBT/Speed Index/transfer sizes/LCP element) as
part of Stage 11G**, once the frontend root-cause analysis identifies what to change — see
`docs/performance/PHASE_11_PAGE_PERFORMANCE_ROOT_CAUSE.md` and
`docs/performance/PHASE_11_PAGE_PERFORMANCE_RESULTS.md`.

## Cross-check: RISK-019 (40-vs-39 table-count discrepancy) — resolved by this measurement

Comparing the real production table list above (42 tables, `sqlite_master`) against a fresh count
of every `sqliteTable(...)` definition across `packages/database/src/schema/*.ts` (also 42,
verified by direct extraction, not estimation) — **the two counts match exactly, name for name**
(`diff` of the sorted lists produces zero output). The historical "40 vs 39" discrepancy recorded
in `docs/baseline/2026-08-03/DATABASE_AND_MIGRATION_BASELINE.md` and RISK-019 does not reproduce
against the current schema/production state — both have grown in lockstep since (3 migrations, 21
Phase-6/Phase-7-era schema changes) and are now provably identical. See Stage 11B/§37 for the
formal risk-closure entry.

## Summary — what this measurement pass changes about the phase's priorities

1. **`html_meta`/`sitemap` storage reduction (RISK-007) is more urgent than previously modeled** —
   real averages are 5.4× and 13.9× the prior estimates respectively. This becomes the
   highest-priority Stage 11C item.
2. **Monitoring capacity (RISK-008) is not an active production problem today** — real execution
   history shows 100% success at real (very low) traffic. The risk remains real and worth
   hardening ahead of growth (per the phase's own "measure before optimising, not react only once
   broken" principle), but it is not an emergency at current scale.
3. **RISK-019 is resolved** — no live discrepancy exists between schema and production table
   counts as of this measurement.
4. **A third scheduled job (`scheduled_plan_changes`) needs to be accounted for** in the Stage
   11E/20 scheduled-job-separation decision, which prior capacity docs did not know about.
5. **D1 storage headroom is enormous in absolute terms today** (3.3 MB of 500 MB, 0.66%) — this
   phase's storage work is about the multi-year growth trajectory (Pro/Agency retention windows
   compounding), not an imminent capacity emergency, consistent with every prior document's own
   framing.
