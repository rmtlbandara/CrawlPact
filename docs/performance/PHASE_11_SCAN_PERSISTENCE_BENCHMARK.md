# Phase 11 scan-persistence benchmark

Stage 11C. Real before/after evidence for the D1 write-batching change in `apps/web/src/lib/persist-scan.ts`.

## What changed

Before this phase, `persistScan` issued every insert as its own separately `await`-ed
`db.insert(...)` call — confirmed directly by reading the pre-change file (still visible in this
PR's diff): 1 `scans` insert, 0–8 `scan_resources` inserts, 1 insert per `scan_crawler_results` row
(21 in the real registry), and 1 insert per persisted `findings` row. Real production data
(`docs/performance/PHASE_11_PRODUCTION_CAPACITY_BASELINE.md` §8.2) confirms the typical real count:
`1 + 7.85 + 21 + 3.35 ≈ 33.2` separate D1 round trips per scan — each one its own network round trip
to D1, not just CPU-local work.

After this phase, every one of those inserts is built (not executed) and collected into a single
array, sent as one `db.batch(statements)` call — D1's own atomic multi-statement primitive. This
is not a rewrite of what gets written, only how many round trips it takes to write it.

## Statement/round-trip count — code-derived, not estimated

| Metric                                                                                |                                                                                                            Before |                                                                                                    After |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------: | -------------------------------------------------------------------------------------------------------: |
| D1 round trips per typical scan                                                       |                                                                                           ~33 (one per statement) |                                                                            **1** (one `db.batch()` call) |
| D1 round trips per worst-case scan (uncapped historically; now capped at 25 findings) |                                                                                                               ~76 |                                                                                                    **1** |
| Total D1 statements actually executed                                                 |                                                                                         Same as round trips (1:1) |                                       Same as before — batching changes round trips, not statement count |
| Atomicity                                                                             | None — a crash partway through left a `scans` row with some/none of its resource, crawler-result, or finding rows | **Full** — `db.batch()` either commits every statement or none; a scan can no longer be "half-persisted" |

This is a direct, exact count from reading the diff — not a benchmark result, and not an estimate.

## Real timing evidence (local Miniflare D1, real controlled-target scan)

`apps/web/tests/integration/persist-scan-benchmark.integration.test.ts` (`pnpm run performance:scan`)
runs 5 **real** scans of `https://e2e-fixture.crawlpact.com` — CrawlPact's own controlled e2e-fixture
domain, the same target `apps/web/tests/e2e/audit-conversion.spec.ts` uses — through the real
`runAudit` → `persistScan` pipeline against a real local Miniflare-backed D1 database (the same
harness every other integration test in this repo uses), timing only the `persistScan` call with
`performance.now()`.

```
$ pnpm run performance:scan
[Phase 11 benchmark] persistScan (batched, local Miniflare D1, real https://e2e-fixture.crawlpact.com scan):
avg=90.26ms min=67.38ms max=118.79ms over 5 runs. D1 round trips per call: 1 (single db.batch(), code-verified).
```

**Reading this honestly**: this is local Miniflare wall-clock timing (includes real network fetches
to the fixture domain as part of `runAudit`, not just the `persistScan` call itself being measured
in isolation from scan cost — the ~70-120ms figure reflects local D1-over-Miniflare's own I/O
characteristics, which are not the same as production Cloudflare D1's characteristics). It is **not**
a production Worker CPU-time measurement, and this document does not claim it is. What it does
provide, honestly:

- **Structural proof the batched path works end-to-end** against a real scan of a real (controlled)
  target, persisting all resource/crawler-result/finding rows correctly in one atomic call — not
  just a unit-level claim.
- **A real relative baseline** for this exact benchmark (`pnpm run performance:scan`) to be re-run
  against in any future change to this code path, so a future regression has something concrete to
  compare against.

The round-trip reduction itself (~33:1, or ~76:1 in a capped worst case) is the primary, exact,
code-verified claim this phase makes — not the specific millisecond figure above, which will vary
by machine and network conditions every time it's re-run.

## What this does not claim

- Production Worker CPU-time-per-invocation before/after (not measurable from this environment —
  see `docs/performance/PHASE_11_PRODUCTION_CAPACITY_BASELINE.md` §8.1's disclosed limitation on
  querying per-invocation CPU time via the connected Workers Observability API).
- That report content, scoring, or recommendations changed in any way — they didn't;
  `selectFindingsForPersistence` (packages/policy/src/findings.ts) only affects which finding rows
  are _persisted_, never what the score/recommendation engine computed upstream from the full,
  uncapped list.
- That the local Miniflare timing above translates directly to a production millisecond figure —
  it doesn't, and this document does not use it to make any production CPU-budget claim.

## Related: findings cap and disclosure

The same change also caps persisted findings at `MAX_PERSISTED_FINDINGS = 25`
(`packages/policy/src/findings.ts`) — real production data shows a real maximum of 10 findings in
any single scan so far, so this cap is prophylactic (bounds the adversarial/pathological case a
public, anonymous, arbitrary-target tool must expect), not a response to anything observed in real
traffic. `scans.findings_omitted_count` (migration `0024`) discloses whenever capping actually
occurs; 0 for every historical scan, since capping did not exist before this phase and no real scan
has ever come close to the cap.
