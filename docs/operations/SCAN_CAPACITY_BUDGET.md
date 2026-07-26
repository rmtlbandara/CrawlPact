# Scan Capacity Budget

**Date:** 2026-07-26. Phase 10 ("Capacity-Protect the Scanner") of the Cloudflare
infrastructure-alignment brief. This document is **evidence-gathering plus honest assessment
only** — it changes no application code. Every Cloudflare limit cited below is sourced from
`docs/deployment/CLOUDFLARE_RESOURCE_LIMITS.md` (verified live against `developers.cloudflare.com`
on 2026-07-26); this document does not re-verify those figures, it costs a real scan against them.
Every scanner-behaviour claim below is sourced from reading the actual code on branch
`chore/cloudflare-capacity-alignment`, cited by `file:line`.

**Framing, per this phase's explicit brief:** the goal here is to establish how far Workers
**Free** can realistically be stretched before Paid is required — not to assume Paid from the
outset. The verdict below is deliberately not forced toward "yes, it fits" if the evidence doesn't
support that.

---

## 1. What one scan actually does (evidence walk)

A single audit (`POST /api/audit`, `apps/web/src/pages/api/audit/index.ts`) or one monitored
domain's scheduled scan (`runMonitoringSweep`, `apps/web/src/lib/monitoring.ts:274-322`) both call
the same underlying path: `runAudit` (`apps/web/src/lib/run-audit.ts`) → `runScan`
(`packages/scanner/src/orchestrator.ts`) → `persistScan` (`apps/web/src/lib/persist-scan.ts`).

### 1.1 External fetches — bounded, sequential, chokepointed

`packages/scanner/src/orchestrator.ts:35` sets `MAX_EXTERNAL_REQUESTS = 12` as a hard ceiling on
the number of _distinct resources_ attempted per scan, enforced by `budgetRemaining()`
(`orchestrator.ts:62`). In practice the orchestrator attempts exactly **6** resources per scan,
strictly sequentially (never parallel — `orchestrator.ts:76-129` is a straight-line `await`
sequence, not `Promise.all`):

1. `robots.txt` (`orchestrator.ts:76`)
2. sitemap — from the robots-declared URL if present and valid, else `/sitemap.xml`
   (`orchestrator.ts:85-92`)
3. `llms.txt` (`orchestrator.ts:94`)
4. `llms-full.txt` (`orchestrator.ts:101`)
5. homepage (`orchestrator.ts:108`) — also the source of the `X-Robots-Tag` and `Content-Signal`
   headers (`orchestrator.ts:115-121`), so these ride on the homepage fetch rather than issuing
   their own request
6. `/.well-known/rsl.xml` (`orchestrator.ts:123`)

A **30-second total-scan deadline** (`DEFAULT_TOTAL_SCAN_TIMEOUT_MS = 30_000`,
`orchestrator.ts:42`, tunable 5–120s via `scan_total_timeout_seconds`,
`packages/database/seed/seed.sql:192`) bounds the whole sequence, not just each fetch — each
`attempt()` call shrinks its own per-fetch timeout to whatever remains of the total budget
(`orchestrator.ts:67-74`), so a slow first resource starves the rest rather than each independently
burning 20s.

**Redirect-hop nuance (a gap not previously flagged in `CLOUDFLARE_ARCHITECTURE_AUDIT.md` or
`PERFORMANCE_AND_COST.md`):** `MAX_EXTERNAL_REQUESTS` counts _resources attempted_, not the actual
network calls issued. `packages/scanner/src/safe-fetch.ts:142-222`'s redirect loop issues one
`fetch()` per hop, up to `maxRedirects = 5` (`safe-fetch.ts:51`) redirects per resource before
giving up. **True Cloudflare external-subrequest consumption per scan is therefore up to 6 × (1 + 5) = 36 real `fetch()` calls in the worst case**, not the "6" the resource count suggests — still
comfortably under Free's 50/request ceiling (`CLOUDFLARE_RESOURCE_LIMITS.md` #4), but with
meaningfully less headroom than a "6 fetches" mental model implies, since `externalRequestCount`
(what callers see and what `persistScan` records as `externalRequestCount`,
`persist-scan.ts:48`) does not include redirect hops.

### 1.2 Body/response bounds — already well-designed

- **Fetch body cap:** 2 MiB (`safe-fetch.ts:52`, `maxBodyBytes: 2_097_152`), enforced by
  `readBoundedBody` (`safe-fetch.ts:71-119`), which stops reading and cancels the stream once the
  cap is hit — confirms the 2 MiB figure `CLOUDFLARE_ARCHITECTURE_AUDIT.md` cited.
- **Header cap:** 32,768 bytes (`safe-fetch.ts:53`), bounded by `headersToBoundedRecord`
  (`safe-fetch.ts:121-130`).
- **Per-fetch timeout:** 20s default (`safe-fetch.ts:54`), shrunk by the orchestrator's remaining
  total-budget logic (§1.1).
- **Persisted-snapshot cap:** 100,000 bytes per resource (`persist-scan.ts:99`,
  `fetchResult.body.slice(0, 100_000)`) — tighter than the 2 MiB fetch cap, confirming
  `CLOUDFLARE_ARCHITECTURE_AUDIT.md`'s finding that what's fetched and what's persisted are two
  different limits.

### 1.3 Parser cost bounds — mostly good, one real gap found

| Parser                     | Bound before parsing?                                                                                                                                                                                  | Evidence                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| robots.txt                 | **Yes** — 512,000-byte cap applied via `.slice(0, maxBytes)` _before_ line-splitting                                                                                                                   | `packages/robots/src/parser.ts:88,104`                                            |
| HTML (`html-signals`)      | **Yes** — 200,000-byte cap                                                                                                                                                                             | `packages/scanner/src/signals/html-signals.ts:21,24`                              |
| `llms.txt`/`llms-full.txt` | **Yes** — link extraction capped at 50 matches (`MAX_LINKS`)                                                                                                                                           | `packages/scanner/src/signals/llms-txt.ts:13,32`                                  |
| Sitemap                    | **Partially** — URL sampling capped at 10 (`MAX_SAMPLE_URLS`), and **no recursive crawl of declared URLs or child sitemaps in a `<sitemapindex>` exists** (confirmed by reading the full 40-line file) | `packages/scanner/src/signals/sitemap.ts:13,31`                                   |
| RSL (`rsl.xml`)            | **No dedicated bound found** — regex-scans whatever the 2 MiB fetch cap returned, with no `.slice()` before the `extractTagNames` regex loop                                                           | `packages/scanner/src/signals/rsl.ts:26-30` (full file read; no size cap present) |

**Sitemap worst case (real, not hypothetical):** the sampling loop's exit condition is
`sampledUrls.length < MAX_SAMPLE_URLS` (`sitemap.ts:31`) — if a sitemap XML document contains fewer
than 10 `<loc>` entries (a large index-of-index or a mostly-empty sitemap), the regex `.exec()` loop
still runs to the end of the document looking for a 10th match that never arrives, i.e. a full
regex scan across up to 2 MiB of text. This is bounded (2 MiB, not unbounded) but is real,
previously-uncosted CPU work in a plausible non-adversarial case.

**RSL gap:** this is the one resource type with no explicit pre-parse size bound, unlike every
other resource type. In practice `rsl.xml` is rare (an emerging, low-adoption spec per the file's
own doc comment) so the _typical_ cost is near-zero (fetch returns 404, nothing to parse), but a
target that serves a large `rsl.xml` (or any other XML at that path due to a misconfigured server)
would force an unbounded-relative-to-the-others regex scan up to the full 2 MiB fetch cap.

**No recursive sitemap crawl exists** — confirmed by reading the full `sitemap.ts`. The brief's
concern ("recursive sitemap crawl") is not present in this codebase: a `<sitemapindex>`'s child
sitemap URLs are sampled as _text_, never fetched.

### 1.4 Crawler evaluation loop

`apps/web/src/lib/run-audit.ts:65-95` maps over **every row in the active crawler registry** and
calls `evaluateRobots` (`packages/robots/src/evaluator.ts:33-93`, a 93-line file) once per crawler.
The registry currently seeds **21 crawlers** (counted directly from
`packages/database/seed/seed.sql`'s `INSERT INTO crawlers` block — 21 `('crw_...'` rows), matching
`docs/performance/PERFORMANCE_AND_COST.md:29-31`'s "confirmed still returns 21 rows" note. Each
`evaluateRobots` call is a small in-memory filter over a parsed robots.txt's groups/rules
(`evaluator.ts:38,52-53`) — cheap in isolation, but it runs 21 times per scan regardless of how
many groups the robots.txt actually declares, and this count grows every time an admin publishes a
new registry release (already 13 → 18 → 21 across three releases per `seed.sql`'s
`registry_versions` changelog).

### 1.5 D1 write fan-out — the single largest uncosted finding of this document

`apps/web/src/lib/persist-scan.ts` never batches writes (`drizzle-orm/d1` supports `db.batch()`
via `packages/database/src/client.ts:9`'s `drizzle(d1, ...)` instance, but no call site in
`persist-scan.ts` or `monitoring.ts` uses it — confirmed by grep). Every insert is an individually
`await`-ed statement:

| Write                  | Count per scan                                                                                                                       | Evidence                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `scans`                | 1 (always)                                                                                                                           | `persist-scan.ts:33`                                                                                            |
| `scan_resources`       | 0–8 (6 fetch-attempt types, conditionally attempted/succeeded, + `content_signals` + `http_headers` if the homepage fetch succeeded) | `persist-scan.ts:60-70,74-115,125-145` — matches `CLOUDFLARE_ARCHITECTURE_AUDIT.md`'s "up to 8" finding exactly |
| `scan_crawler_results` | **21, unconditional** — one per registry crawler, every scan, regardless of robots.txt outcome                                       | `persist-scan.ts:147-158` loop over `result.crawlerEvaluations` (always 21 today, §1.4)                         |
| `findings`             | **0 to ~46 in a real worst case, uncapped** — see below                                                                              | `persist-scan.ts:160-181` loop over `result.findings`                                                           |

**Findings count is not bounded to "a handful."** Reading `packages/policy/src/conflicts.ts:33-208`
in full: the outer loop runs once per crawler evaluation (21 iterations), and within it up to two
conflict codes can independently fire for the _same_ crawler in one pass (e.g.
`DEPRECATED_TOKEN_IN_USE` at line 76 plus `REPLACEMENT_TOKEN_MISSING` at line 94 for a replaced,
uncovered token; or `SEARCH_VISIBILITY_CONFLICT`/`TRAINING_RESTRICTION_CONFLICT` plus
`PAGE_DIRECTIVE_UNREACHABLE`). Four more conflict codes can fire once each at the site level
(`BROAD_WILDCARD_OVERRIDE`, `DUPLICATE_GROUP_UNEXPECTED_MATCH`, `RSL_CONTENT_SIGNALS_DISAGREEMENT`,
`HEADER_SITE_DISAGREEMENT` — `conflicts.ts:144-205`). Nothing in `buildFindings`
(`packages/policy/src/findings.ts:77-98`) or its caller truncates the resulting array before
`persistScan` writes one row per finding. A genuinely messy real-world site (many deprecated
crawler tokens referenced, several misaligned rules) could plausibly produce 20–40+ findings; a
constructed worst case (every one of the 21 crawlers simultaneously deprecated-with-missing-
replacement, plus all four site-level conflicts) reaches **~46 findings** in one scan.

**Total D1 write statements per scan, therefore:**

| Scenario                                                     | scans | scan_resources | scan_crawler_results | findings | **Total statements** |
| ------------------------------------------------------------ | ----- | -------------- | -------------------- | -------- | -------------------- |
| Typical (small, mostly-clean robots.txt, homepage reachable) | 1     | 6–8            | 21                   | ~2–5     | **~30–35**           |
| Worst case (many deprecated tokens, misaligned rules)        | 1     | 8              | 21                   | ~46      | **~76**              |

Each is a separate D1 round-trip today — no `db.batch()` call collapses them. This was not costed
at this granularity in either `CLOUDFLARE_ARCHITECTURE_AUDIT.md` (which only measured the 8-row
`scan_resources` figure) or `PERFORMANCE_AND_COST.md` (which named the _shape_ of the risk —
"writes multiple D1 rows" — without a statement count).

Monitoring-sweep-triggered scans add a few more writes per domain on top of the above: the claim
`UPDATE` (`monitoring.ts:60-69`, 1 per domain, happens before the scan), `recordScheduledScanOutcome`
(1 `domains` update, `monitoring.ts:181-186,204-209`), and conditionally a `scan_diffs` insert plus
a `notifications` insert (`monitoring.ts:143-174,211-230`) — **+2 to +4 statements** on top of the
`persistScan` total above.

---

## 2. Per-scan capacity budget

All limits cited are Free-plan figures from `docs/deployment/CLOUDFLARE_RESOURCE_LIMITS.md`
(cited by item number, not re-verified here).

| Dimension                      | Typical scan                                                                                                           | Worst case                                                                                    | Free-plan ceiling (cited)                                                                 | Headroom                                                                                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Worker invocations             | 1 (the whole scan runs inside one `fetch`/`scheduled` invocation)                                                      | 1                                                                                             | 100,000/day (#1)                                                                          | Ample — this is 1 invocation regardless of scan complexity                                                                                             |
| External subrequests           | 6 (no redirects)                                                                                                       | 36 (6 resources × up to 6 hops each, §1.1)                                                    | 50/request (#4)                                                                           | Comfortable even at worst case, but real (72% of budget at worst case, not the "12%" a naive 6-fetch reading suggests)                                 |
| D1 statements (queries)        | ~30–35                                                                                                                 | ~76                                                                                           | No published per-request D1-query-count limit found in this verification pass             | N/A as a hard ceiling, but see CPU line below — statement _count_ drives CPU cost directly                                                             |
| D1 rows written                | ~30–35                                                                                                                 | ~76                                                                                           | 100,000/day (#12, account-wide)                                                           | See §4 — the aggregate daily figure is generous; the per-invocation CPU cost of _issuing_ that many writes is the real constraint, not the daily total |
| D1 rows read                   | ~5–10 (active-registry join reads 21 crawler rows once per caller, not per scan; a handful of config/rate-limit reads) | ~30                                                                                           | 5,000,000/day (#11)                                                                       | Ample                                                                                                                                                  |
| R2 operations                  | N/A                                                                                                                    | N/A                                                                                           | N/A — R2 not adopted (`docs/data/D1_R2_DATA_PLACEMENT_POLICY.md`)                         | N/A                                                                                                                                                    |
| Bytes fetched                  | A few KB–~200 KB (small text files + HTML, typically well under caps)                                                  | Up to ~12 MiB (6 resources × 2 MiB fetch cap each, `safe-fetch.ts:52`)                        | No published per-request bytes-fetched limit found distinct from the body-size cap itself | Bounded by the app's own 2 MiB-per-resource cap, not a Cloudflare quota                                                                                |
| Bytes stored                   | A few KB (real robots.txt/llms.txt files are typically far under the 100 KB per-resource cap)                          | ~800 KB (8 × 100,000 bytes, `persist-scan.ts:99`, matches `CLOUDFLARE_ARCHITECTURE_AUDIT.md`) | 500 MB per database (#14, distinct from the 5 GB account total, #13)                      | Ample per-scan; a retention/growth question, not a per-scan one — see `docs/data/DATA_RETENTION.md`                                                    |
| CPU estimate (see §3)          | ~3–6 ms                                                                                                                | ~12–25+ ms                                                                                    | **10 ms per invocation (#2) — HTTP request and Cron Trigger invocation alike**            | **Thin-to-negative — see §3 verdict**                                                                                                                  |
| Expected duration (wall-clock) | ~1–5 s (6 sequential real-world fetches at typical latency)                                                            | Up to 30 s (the total-scan deadline, `orchestrator.ts:42`)                                    | No wall-clock limit on Workers Free distinct from CPU time                                | Wall-clock is not the constraint; CPU time is                                                                                                          |

---

## 3. CPU feasibility assessment — honest, evidence-based verdict

**This section is an estimate, explicitly not a measurement** — consistent with
`docs/performance/PERFORMANCE_AND_COST.md`'s own disclosed caveat, no production Cloudflare
account is connected yet, so no real deployed-Worker CPU trace exists to confirm these numbers.
They are derived from reading the actual code paths above and reasoning about what each step
costs in _actual CPU_, not wall-clock (network wait time is free; parsing, serialization, and
control flow are not).

### Line-item CPU estimate (per scan)

| Step                                                                                                                         | Typical                                       | Worst case                  | Basis                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------- |
| Request parse/validate (`zod` schema, `normalizeTarget`)                                                                     | 0.1–0.3 ms                                    | 0.3 ms                      | Small JSON body, simple string validation                                               |
| Rate-limit/config D1 reads (marshalling only, not wait)                                                                      | 0.2–0.4 ms                                    | 0.4 ms                      | 2–5 small reads                                                                         |
| robots.txt parse                                                                                                             | 0.1–0.3 ms                                    | 1–3 ms                      | Bounded to 512 KB (§1.3); worst case = many lines/groups                                |
| sitemap validate                                                                                                             | 0.05 ms                                       | up to 3–5 ms                | Bounded to 2 MiB; worst case = sparse `<loc>` count forcing full-body regex scan (§1.3) |
| `llms.txt` + `llms-full.txt` parse (×2)                                                                                      | 0.1–0.4 ms                                    | 0.4 ms                      | Bounded to 50 links each                                                                |
| HTML homepage parse                                                                                                          | 0.1–0.5 ms                                    | 0.5 ms                      | Bounded to 200 KB                                                                       |
| RSL parse                                                                                                                    | ~0 ms (usually 404, nothing to parse)         | 1–3 ms                      | No pre-parse bound (§1.3 gap); worst case = large `rsl.xml` present                     |
| Crawler evaluation loop (×21)                                                                                                | 0.4–1 ms                                      | 1 ms                        | Small array filters, 21 iterations                                                      |
| Policy engine (`detectConflicts`, `buildFindings`, `computePolicyHealthScore`, `generateRecommendations`, `buildRobotsDiff`) | 0.3–0.8 ms                                    | 2–4 ms                      | Worst case scales with findings count (§1.5, up to ~46)                                 |
| D1 write fan-out (marshalling per statement, not network wait)                                                               | 1.5–3.5 ms (~30–35 statements × ~0.05–0.1 ms) | 3.8–7.6 ms (~76 statements) | §1.5 — no batching exists today                                                         |
| Misc (`crypto.randomUUID()` ×~30, `JSON.stringify()` ×~10, response envelope)                                                | 0.3–0.8 ms                                    | 0.8 ms                      | Repeated small allocations                                                              |
| **Total**                                                                                                                    | **≈3–7 ms**                                   | **≈12–25+ ms**              |                                                                                         |

### Verdict

**A typical, well-formed target site's scan is plausibly within the 10 ms ceiling, but with thin
margin, not comfortable headroom.** The typical-case estimate (3–7 ms) leaves as little as 3 ms of
slack against a hard 10 ms wall — any combination of a slightly larger robots.txt, a few deprecated
crawler tokens producing extra findings, or ordinary D1-write marshalling variance could push a
"typical" scan over the line.

**A realistic worst case — which a public, anonymous, arbitrary-target audit tool will encounter
by design, since anyone can submit any domain — plausibly exceeds 10 ms.** The two largest
previously-uncosted contributors are (a) the unbatched ~30–76-statement D1 write fan-out (§1.5),
which no earlier document in this repo measured at this granularity, and (b) the uncapped findings
count scaling with crawler-registry size (currently 21, growing with every registry release).

**Honest conclusion: this does not confidently fit within Workers Free's 10 ms CPU ceiling for the
general case, though it is not hopeless either.** This is consistent with, and sharpens,
`docs/performance/PERFORMANCE_AND_COST.md`'s existing documented expectation ("almost certainly
requires the Workers Paid plan") and `docs/status/KNOWN_RISKS.md`'s entry on the same — this
document adds the specific, evidence-based _why_ (the D1 fan-out and uncapped findings count) that
those earlier passes flagged as a shape-level risk without quantifying.

---

## 4. Concrete tightening measures to extend Free-plan headroom

**None of the following are implemented in this pass** — this is documentation only, per this
phase's explicit scope. Each is a candidate follow-up, ordered by estimated leverage.

1. **Batch the D1 write fan-out with `db.batch()`.** The single highest-leverage change found.
   Collapsing the ~21 `scan_crawler_results` inserts into one batched call, and the ~0–46
   `findings` inserts into another, would cut the ~1.5–7.6 ms of per-statement marshalling
   overhead (§3) to a small fraction of that — likely the single largest lever for staying under
   10 ms. `drizzle-orm/d1`'s `db.batch([...])` is already available via the existing
   `packages/database/src/client.ts` instance; no new dependency needed.
2. **Cap the findings count actually persisted per scan** (e.g., top N by severity, or dedupe
   near-identical per-crawler findings of the same code). Currently fully uncapped (§1.5) — a
   pathological but realistic input (many deprecated tokens) can produce ~46 rows from one scan.
   This both reduces D1 write volume and shrinks the policy-engine CPU cost proportionally.
3. **Add an explicit pre-parse size bound to RSL parsing**, matching the pattern already used for
   robots.txt (512 KB), HTML (200 KB), and `llms.txt` (50-link cap) — currently the only resource
   type scanned without one (§1.3).
4. **Add a hard byte-scan ceiling to sitemap validation** (e.g., stop scanning after the first
   100 KB even if fewer than 10 `<loc>` entries have been found), rather than relying solely on the
   sample-count exit condition, which can force a full 2 MiB regex scan on a sparse sitemap (§1.3).
5. **Fold redirect hops into the external-request budget.** `orchestrator.ts`'s
   `MAX_EXTERNAL_REQUESTS` counts resources attempted, not real network calls; a lower
   `maxRedirects` default (e.g., 3 instead of 5) or counting each redirect hop against the same
   budget would tighten the true worst-case subrequest consumption from 36 toward something closer
   to the "6" the current counter implies (§1.1).
6. **Populate `scan_resources.resource_hash` and skip a full-text rewrite for byte-identical
   monitoring re-scans** — already identified as a future option in
   `docs/deployment/CLOUDFLARE_ARCHITECTURE_AUDIT.md` and `docs/data/D1_R2_DATA_PLACEMENT_POLICY.md`;
   repeated here because it directly reduces D1 write volume for the monitoring path specifically
   (§5 of `MONITORING_CAPACITY_PLAN.md`).
7. **Consider deferred/lazy crawler evaluation** — evaluating all 21 registry crawlers eagerly at
   scan time, every scan, regardless of which crawlers the customer actually cares about, is the
   least structurally necessary cost in this budget (§1.4). A larger, more architectural change
   (e.g., persisting only crawlers whose result differs from a wildcard baseline, or evaluating on
   read rather than on write) would reduce both the write fan-out and the evaluation loop cost, but
   is a bigger lift than items 1–6 and is flagged here as a longer-term option, not a near-term
   tightening.

### Already well-bounded — no action needed

Sitemap URL sampling (10-entry cap), `llms.txt` link extraction (50-entry cap), HTML signal
parsing (200 KB cap), robots.txt parsing (512 KB cap), the 12-resource orchestrator ceiling, and
the explicit absence of any recursive sitemap crawl are all already correctly bounded and need no
further tightening.

---

## 5. Flagged follow-ups (not fixed in this pass)

- The unbatched D1 write fan-out (§1.5, §4.1) and uncapped findings count (§1.5, §4.2) are real
  gaps this pass surfaced that were not visible at the granularity of
  `CLOUDFLARE_ARCHITECTURE_AUDIT.md`'s "up to 8 `scan_resources` rows" framing. Recommend adding an
  explicit line to `docs/status/KNOWN_RISKS.md` alongside the existing free-tier-CPU-budget risk,
  naming these two specific mechanisms rather than leaving the risk at the general "several
  sequential fetches + parsing + multiple D1 writes" level it's currently described at.
- The RSL no-pre-parse-bound gap (§1.3, §4.3) and the sitemap sparse-`<loc>`-forces-full-scan gap
  (§1.3, §4.4) are both real, if narrow, worst-case CPU cost sources not previously documented
  anywhere in this repo.
- The redirect-hop undercounting in the external-request budget (§1.1, §4.5) means the orchestrator's
  own `externalRequestCount` (persisted to `scans.external_request_count`) can under-report true
  Cloudflare subrequest consumption — worth a note in `docs/operations/CLOUDFLARE_UPGRADE_TRIGGERS.md`'s
  external-subrequest row if not already covered there.
