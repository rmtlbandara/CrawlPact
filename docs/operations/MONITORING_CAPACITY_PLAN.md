# Monitoring Capacity Plan

**Date:** 2026-07-26. Phase 11 ("Audit Scheduled Monitoring Capacity") of the Cloudflare
infrastructure-alignment brief. Evidence-gathering plus honest capacity assessment only — no
application code changes. Cloudflare limits cited are sourced from
`docs/deployment/CLOUDFLARE_RESOURCE_LIMITS.md` (not re-verified here). Per-scan cost figures are
sourced from `docs/operations/SCAN_CAPACITY_BUDGET.md` (Phase 10, not re-derived here). Framing
matches that document: the question is how far Workers **Free** can be stretched, not an
assumption that Paid is immediately required.

---

## 1. Inputs

### 1.1 Monitoring cadence per plan (SRS §8, `docs/product/CRAWLPACT_FINAL_SRS.md:508-521`)

| Plan   | Saved domains (max) | Monitoring cadence | Manual rescans/domain/month |
| ------ | ------------------: | ------------------ | --------------------------: |
| Free   |                   1 | None               |                           2 |
| Solo   |                   5 | **Monthly**        |                           5 |
| Pro    |                  25 | **Weekly**         |                          10 |
| Agency |                 100 | **Weekly**         |                          20 |

`apps/web/src/lib/scan-scheduling.ts:11-18`'s `computeNextScanAt` confirms this in code: `days =
frequency === "weekly" ? 7 : 30` — Solo's "monthly" is implemented as exactly 30 days, Pro/Agency's
"weekly" as exactly 7 days, `"none"` (Free) never schedules a next scan at all.

### 1.2 Current implementation (confirmed in code, per `CLOUDFLARE_ARCHITECTURE_AUDIT.md` and

independently re-read for this document)

- **One daily cron**, `"0 3 * * *"` (`apps/web/wrangler.jsonc:22-28`), driving both the monitoring
  sweep and the data-retention purge from the same `scheduled()` export
  (`apps/web/src/worker.ts:24-49`) — 1 of the 5 Free-plan Cron Trigger slots (#7,
  `CLOUDFLARE_RESOURCE_LIMITS.md`).
- **Bounded batch claiming**: `claimDueDomains` (`apps/web/src/lib/monitoring.ts:36-73`) selects up
  to `monitoring_scan_batch_size` due domains (default 20, admin-tunable 1–200,
  `packages/database/seed/seed.sql:198`) and atomically claims each via a conditional `UPDATE`
  that pushes `next_scan_at` into a 15-minute lock window (`CLAIM_LOCK_MINUTES = 15`,
  `monitoring.ts:23`, tunable via `monitoring_claim_lock_minutes`).
- **Self-healing claim lock, already exists**: a crashed sweep does not double-scan — any claimed-
  but-unscanned domain simply becomes due again once its 15-minute lock elapses
  (`monitoring.ts:56-71`).
- **Retry/backoff, already exists**: `backoffNextScanAt` (`monitoring.ts:189-192`) applies
  exponential backoff (`2^(failureCount-1)` days, capped at 14) after each scan failure, and
  monitoring auto-pauses after `FAILURE_PAUSE_THRESHOLD = 5` (`monitoring.ts:22`) consecutive
  failures, with a notification (`monitoring.ts:194-231`).
- **Admin/manual scan separation, already exists**: `apps/web/src/pages/api/domains/[domainId]/scan.ts`
  and `apps/web/src/pages/api/admin/domains/[domainId]/scan.ts` are separate, on-demand endpoints
  distinct from the cron-driven sweep, each subject to the SRS §8 manual-rescan-per-month limits
  above rather than competing with scheduled capacity.
- **No continuation cursor exists.** Each cron tick independently re-queries "due" domains capped
  at the batch size; anything beyond the batch size waits for the next tick. Confirmed by
  `CLOUDFLARE_ARCHITECTURE_AUDIT.md` and independently re-read in `monitoring.ts` for this
  document — there is no persisted cursor/offset carried between sweeps.
- **Per-domain D1 write cost**: from `SCAN_CAPACITY_BUDGET.md` §1.5, ~30–35 statements (typical) to
  ~76 (worst case) per scan via `persistScan`, plus 2–4 more from the claim `UPDATE`,
  `recordScheduledScanOutcome`, and conditional `scan_diffs`/`notifications` inserts
  (`monitoring.ts:60-69,133-187,204-230`) — call it **~35–40 statements/domain typical, up to ~80
  worst case**.

### 1.3 The central finding this document adds: cron shares the same 10 ms CPU ceiling as an HTTP request

`CLOUDFLARE_RESOURCE_LIMITS.md` item #2 states explicitly: **"10 ms per HTTP request invocation; 10
ms per Cron Trigger invocation."** `runMonitoringSweep` (`monitoring.ts:249-325`) runs its entire
`for (const domain of dueDomains)` loop (`monitoring.ts:274-322`) — every claimed domain's full
scan, sequentially, awaited — **inside one single `scheduled()` invocation**. That whole loop must
fit inside the same 10 ms CPU budget as a single web request, not 10 ms per domain.

Using `SCAN_CAPACITY_BUDGET.md`'s per-scan CPU estimate (≈3–7 ms typical, ≈12–25+ ms worst case,
itself an estimate, not a measurement against a real deployed Worker — same caveat applies here):

|    Batch size (domains/tick) | Typical-case cumulative CPU | Against the 10 ms ceiling                                                                 |
| ---------------------------: | --------------------------- | ----------------------------------------------------------------------------------------- |
|                            1 | ~3–7 ms                     | Plausible fit, thin margin (matches the single-scan verdict in `SCAN_CAPACITY_BUDGET.md`) |
|                            2 | ~6–14 ms                    | Already likely to exceed 10 ms in many real cases                                         |
|                            5 | ~15–35 ms                   | Very likely exceeds 10 ms                                                                 |
|         20 (current default) | ~60–140 ms                  | **Essentially certain to exceed 10 ms by 6–14×**                                          |
| 200 (admin-configurable max) | ~600–1,400 ms               | Would fail far earlier in the loop; the ceiling is hit long before domain #200            |

**What actually happens when a tick exceeds the CPU ceiling:** the invocation is killed (error
1102, `CLOUDFLARE_RESOURCE_LIMITS.md` #2's monitoring method). Because `claimDueDomains` claims
_all_ domains for the batch **before** the scan loop begins (`monitoring.ts:36-73`, called once at
`monitoring.ts:270`, before the `for` loop at `:274`), every claimed domain already has
`next_scan_at` pushed into the 15-minute lock window regardless of whether its scan actually ran.
Domains whose scan never executed (because the invocation died partway through the loop) simply
have no `persistScan`/`recordScheduledScanOutcome` call for that attempt — they self-heal back to
"due" once the 15-minute lock elapses (this is a genuine, already-correct piece of the design, per
`CLOUDFLARE_ARCHITECTURE_AUDIT.md`'s "self-healing claim-lock" finding), but with only **one** cron
tick per day, "self-heals in 15 minutes" doesn't help if the next opportunity to actually scan them
isn't until the following day's tick — at which point the same CPU ceiling problem recurs for
whatever is due by then, and unprocessed backlog compounds rather than draining.

**Honest conclusion: on Workers Free, the realistically CPU-safe batch size is on the order of 1
domain per tick, not the current 20-domain default** (and further tightened at low confidence,
since even 1 domain is a thin-margin fit per `SCAN_CAPACITY_BUDGET.md`). This is a materially lower
number than the admin-tunable range (1–200) suggests is "safe to tune within," and the daily
aggregate D1/request quotas (100,000/day each) are, by contrast, nowhere near binding at any of the
scenarios modeled below — **CPU-per-invocation, not a daily quota, is what actually constrains
monitoring throughput on Free.**

---

## 2. Scenario table

Cadence mix and domain counts are explicit modeling assumptions, stated per scenario — not
measurements — grounded in the SRS §8 plan table and (for the two customer-count-driven scenarios)
the SRS §3.3 commercial targets, rather than assuming full plan-entitlement usage across the board
(which would overstate realistic domain counts and be internally inconsistent with the SRS's own
"1,000+ saved domains at 150+ paid customers" pairing).

| Scenario                                                                                                                                                                                                                                                                           |                                                                                                                                                                                                               Domains modeled | Cadence split (assumption)                                                                     |                                            Due scans/day | Cron ticks/day (current design) | Domains/batch needed to clear same-day | External subrequests/day | D1 write statements/day (typical, ~37/scan avg) | Worker requests/day (cron itself) | CPU pressure (§1.3)                                                                                                                                              | Completes within 1 daily tick?                                       | Failure retry load                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------: | ------------------------------: | -------------------------------------: | -----------------------: | ----------------------------------------------: | --------------------------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **1. 5 Solo customers**                                                                                                                                                                                                                                                            |                                                                                                                                                                                                    25 (full entitlement, 5×5) | 100% monthly (30-day)                                                                          |                                      25/30 ≈ **0.8/day** |                               1 |                                      1 |                     ~5–6 |                                             ~30 |                                 1 | Low — ≤1 domain/day fits the ~1-domain CPU-safe batch (§1.3)                                                                                                     | **Yes**, comfortably                                                 | Negligible (SRS targets 98%+ success excluding target-side failures)                                                    |
| **2. 50 Solo customers**                                                                                                                                                                                                                                                           |                                                                                                                                                                                                        250 (full entitlement) | 100% monthly                                                                                   |                                     250/30 ≈ **8.3/day** |                               1 |                  9 (to clear same-day) |                   ~50–60 |                                            ~310 |                                 1 | **Already strains** — 8–9 domains/day due, but only ~1/tick is CPU-safe                                                                                          | **No** — backlog begins accumulating here, well below any SRS target | Low, but compounds if backlog grows (more domains eventually retried after failures on top of already-behind schedule)  |
| **3. 100 mixed paid customers**                                                                                                                                                                                                                                                    | ~670 (100 × ~6.7 domains/customer, the SRS §3.3 ratio of 1,000 saved domains ÷ 150 paid customers — used instead of full-entitlement ceilings, which would imply an unrealistic ~9,250 domains for a mixed 100-customer pool) | Assumed 70% of domains on monthly cadence (Solo-heavy self-serve mix), 30% weekly (Pro/Agency) |                              469/30 + 201/7 ≈ **44/day** |                               1 |                                    ~44 |                 ~260–290 |                                          ~1,630 |                                 1 | **Strains significantly** — 44/day due vs. ~1/tick CPU-safe capacity                                                                                             | **No**                                                               | Meaningful — a growing backlog also delays failure-triggered retries, compounding drift from the intended cadence       |
| **4. 155 paid customers** (SRS §3.3's own "150+ paid customers" / "1,000+ saved domains" end-2027 targets)                                                                                                                                                                         |                                                                                                                                            1,000 (SRS's own paired target, used directly rather than re-derived per customer) | Same 70/30 monthly/weekly split assumption as Scenario 3                                       |                              700/30 + 300/7 ≈ **66/day** |                               1 |                                    ~66 |                 ~400–430 |                                          ~2,440 |                                 1 | **Strains severely**                                                                                                                                             | **No**                                                               | Significant — this is the SRS's own stated success target, and it is not reachable with the current tick design on Free |
| **5. 1,000 monitored domains** (domain-count-driven, independent of customer count — modeled with a cadence mix skewed more toward Pro/Agency portfolios than Scenario 4, since reaching 1,000 domains via fewer, larger accounts is at least as plausible as via many small ones) |                                                                                                                                                                                                                         1,000 | Assumed 40% monthly / 60% weekly (more Pro/Agency-weighted than Scenario 4)                    |                              400/30 + 600/7 ≈ **99/day** |                               1 |                                    ~99 |                     ~600 |                                          ~3,660 |                                 1 | **Strains severely**                                                                                                                                             | **No**                                                               | Significant, same reasoning as Scenario 4                                                                               |
| **6. Free-plan upper bound** — the domain count at which the _daily D1 rows-written quota itself_ (100,000/day, `CLOUDFLARE_RESOURCE_LIMITS.md` #12) would bind, at ~37 writes/scan                                                                                                |                                                                                                                       ~18,900 domains at weekly cadence (100,000 × 7 ÷ 37), or ~81,100 at monthly cadence (100,000 × 30 ÷ 37) | Either cadence, illustratively                                                                 | 100,000 ÷ 37 ≈ **2,700/day** (the quota-implied ceiling) |                               1 |                                  2,700 |                  ~16,200 |                       100,000 (by construction) |                                 1 | **The daily D1-write quota is not the real binding constraint** — CPU-per-tick fails at ~1–2 domains/day, thousands of domains before this quota would ever bind | N/A — never reaches this point under the current design              | N/A                                                                                                                     |

**Reading Scenario 6:** this is the important, somewhat counter-intuitive finding of this
document. The daily aggregate quotas (100,000 requests/day, 100,000 D1 rows written/day,
5,000,000 D1 rows read/day) are **not** what fails first at any realistic CrawlPact scale — they
stay comfortable even at 1,000+ monitored domains (Scenario 5's ~3,660 writes/day is 3.7% of the
100,000/day D1-write quota). **The per-cron-invocation CPU ceiling (10 ms, shared with HTTP
requests) fails first, and it fails at a much lower domain count than any daily quota would
suggest** — realistically somewhere between Scenario 1 (5 Solo customers, fits) and Scenario 2 (50
Solo customers, already strains).

---

## 3. Evaluating the brief's listed strategy options

| Option                                                                | Status                                                                                                                                                                                                               | Assessment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Small bounded batches                                                 | Partially exists (`monitoring_scan_batch_size`, default 20, tunable 1–200)                                                                                                                                           | The _mechanism_ exists, but the current default (20) and even most of the tunable range are not CPU-safe on Free (§1.3). Lowering the effective default toward ~1–2 is a real, concrete, available lever — but only extends headroom for the smallest scenarios (§4), it does not scale to the SRS's own targets.                                                                                                                                                                                                                                      |
| Multiple Cron Trigger windows (still within the 5-trigger Free limit) | **Not implemented — a genuine, low-risk next step**                                                                                                                                                                  | Splitting the single daily tick into 2–3 ticks/day (e.g., 03:00, 11:00, 19:00 UTC) would roughly double or triple the number of CPU-safe small batches processed per day, within the account's existing 5-trigger allowance (currently using 1 of 5, `wrangler.jsonc:22-28`). This does not fix the underlying per-tick CPU ceiling, but it linearly increases total daily domains-processable by however many additional windows are added.                                                                                                           |
| Continuation cursor in D1                                             | **Does not exist** (confirmed, §1.2) — a real gap                                                                                                                                                                    | Without one, `claimDueDomains`'s query always returns the same oldest-first due candidates when demand exceeds capacity, meaning newer or later-in-alphabetical/insertion-order domains could be starved indefinitely once backlog exists (Scenarios 2+). This is a fairness fix, **not** a throughput fix — it does not increase how many domains can be CPU-safely scanned per day, it only ensures the ones that do get scanned rotate fairly. Worth adding once backlog becomes a reality, but it is not what closes the capacity gap found in §2. |
| Idempotent scan locks                                                 | **Already implemented and correct** (`monitoring.ts:36-73`, confirmed by both `CLOUDFLARE_ARCHITECTURE_AUDIT.md` and this document's independent re-read)                                                            | No further work needed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Retry/backoff                                                         | **Already implemented** (`backoffNextScanAt`, `monitoring.ts:189-192`, exponential up to 14 days, pause after 5 consecutive failures)                                                                                | No further work needed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Fair scheduling                                                       | Partially covered by the claim-lock's FIFO-by-`next_scan_at` ordering, but no explicit fairness policy beyond that                                                                                                   | Would matter once a continuation cursor is added and backlog is a sustained reality — not the current bottleneck.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Admin/manual scan separation                                          | **Already implemented** (separate `/api/domains/[domainId]/scan.ts` and `/api/admin/domains/[domainId]/scan.ts` endpoints, distinct from the cron sweep, each governed by the SRS §8 manual-rescan-per-month limits) | No further work needed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

**On Queues/Workflows/Durable Objects:** this document does **not** recommend introducing any of
these, per the brief's explicit preference for the simplest sufficient approach. The evidence
above shows the _architecture_ (bounded batch + single daily cron + D1 claim-lock) is the right
shape and several of its component pieces (locking, backoff, admin/manual separation) are already
correctly implemented — the problem this document surfaces is not architectural complexity, it is
that **Workers Free's CPU-per-invocation budget is too small for this architecture's real per-scan
cost**, which is a plan-tier problem, not a design problem. Introducing Queues or Durable Objects
would not change the fact that each individual scan still needs several milliseconds of real CPU
somewhere; it would only change which invocation pays that cost, at the price of materially more
moving parts than the brief wants for a problem that Workers Paid solves directly (30 s default,
up to 5-minute CPU budget per invocation — 3,000–30,000× Free's 10 ms, per
`CLOUDFLARE_UPGRADE_TRIGGERS.md`'s Workers CPU row).

---

## 4. Verdict

**The current single-daily-cron, bounded-batch approach starts to strain between Scenario 1 (5
Solo customers — fits) and Scenario 2 (50 Solo customers — already accumulating backlog).** This is
far below the SRS's own 150+/1,000+ end-2027 targets (Scenarios 4–5), which the current design
cannot keep pace with at all under the CPU ceiling identified in §1.3 — not because the batch-size
knob is set wrong, but because even a batch of 1 is a thin-margin fit and a batch of 20 (today's
default) is essentially guaranteed to fail.

**Simplest concrete next steps, in order:**

1. **Immediately available, Free-plan-compatible (buys real but limited headroom):** lower the
   effective `monitoring_scan_batch_size` default well below 20 (toward 1–3) and add a second and
   third daily Cron Trigger at different times of day (still well within the 5-trigger Free limit)
   to multiply the number of small, CPU-safe batches processed per day. Combined with
   `SCAN_CAPACITY_BUDGET.md`'s §4 tightening measures (D1 write batching especially), this could
   plausibly extend safe operation from "barely Scenario 1" to "comfortably Scenario 1, marginally
   Scenario 2" — a real, worthwhile runway extension for a small pilot, but not a path to the
   product's own commercial targets.
2. **The real fix, once monitoring volume grows past a small pilot (realistically by Scenario 2,
   certainly by Scenario 3):** Workers Paid, specifically **for CPU headroom**, not for the daily
   request or D1-write quotas (§2's Scenario 6 shows those remain comfortable even at 1,000+
   domains). At Paid's CPU budget, the current architecture — unchanged in shape — becomes
   trivially sufficient: even the admin-configurable maximum batch of 200 domains, at ~8 ms
   CPU/scan, totals ~1.6 s of cumulative CPU per tick, comfortably inside even the default 30 s
   Paid budget.

**This verdict should be read alongside `docs/operations/CLOUDFLARE_UPGRADE_TRIGGERS.md`**, which
already names "paid monitoring obligations (SRS §25's monthly/weekly cadence) cannot be completed
reliably within the free tier's constraints" as one of the Workers-upgrade triggers, forward-
referencing this document. This document supplies the quantitative basis for that trigger: the
monitoring cadence cannot be completed reliably within Free's constraints starting somewhere in
the 5–50 Solo-customer range, not at the 150-customer scale that might otherwise seem like the
natural point to reassess.

---

## 5. Flagged follow-ups (not fixed in this pass)

- No continuation cursor exists (§3) — recommend adding one once backlog is observed in practice
  (Scenario 2+), so fairness (not throughput) is addressed once the account is past the CPU-safe
  threshold identified here.
- The redirect-hop and findings-count uncosted-fan-out gaps from `SCAN_CAPACITY_BUDGET.md` §5
  apply identically to every monitoring-sweep scan, at monitoring's higher aggregate volume — the
  same recommended `docs/status/KNOWN_RISKS.md` addition applies here too.
- This document's scenario domain counts and cadence-mix splits are explicit, stated modeling
  assumptions, not measurements — if real signup/usage data becomes available (even from a small
  beta), the scenario table should be recalculated against actual plan-mix and average-domains-
  per-customer figures rather than the SRS-ratio-derived assumptions used here.
