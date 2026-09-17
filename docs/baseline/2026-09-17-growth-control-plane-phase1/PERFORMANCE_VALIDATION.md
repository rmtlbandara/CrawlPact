---
Document owner: Engineering owner
Status: current-authoritative (Phase 1 — performance baseline)
---

# Performance Validation — 2026-09-17

## Real baseline against the live, deployed Production site

Obtained after `9a3f950` actually reached Production (`deploy-production.yml`, Worker version
`a0847529`) — using `scripts/lighthouse-check.mjs` exactly as it is designed to be used: against a
real deployed environment, devtools-throttled (real network replay, not Lighthouse's `simulate`
mode — this project previously found `simulate` badly misjudges this app's real timing, see
`RISK-033` in the script's own header comment), median of 3 runs per page.

| Page                     | Performance | Accessibility | Best Practices | SEO | LCP (median) | CLS (median) |
| ------------------------ | ----------- | ------------- | -------------- | --- | ------------ | ------------ |
| `/`                      | 99          | 100           | 92             | 100 | 1,661 ms     | 0.0001       |
| `/pricing/`              | 99          | 100           | 92             | 100 | 1,792 ms     | 0.0001       |
| `/sample-report/`        | 99          | 100           | 92             | 100 | 1,684 ms     | 0.0001       |
| `/crawlers/amazonbot/`   | 99          | 100           | 92             | 100 | 1,841 ms     | 0.0001       |
| `/for/agencies/`         | 99          | 100           | 92             | 100 | 1,567 ms     | 0.0001       |
| `/platforms/cloudflare/` | 98          | 100           | 92             | 100 | 1,755 ms     | 0.0001       |

All six pages pass the script's own thresholds (performance ≥85, accessibility ≥95,
best-practices ≥85, SEO ≥90, LCP ≤3000ms, CLS ≤0.1) with wide margin, and comfortably clear the
Core Web Vitals "good" targets this phase adopted (LCP ≤2.5s, CLS ≤0.1) at every page tested — real
LCP values cluster at 1.5–1.8 seconds, roughly 40% under the 2.5s target. CLS is effectively zero
across every page (~0.0001), meaning no layout-shift regression from anything added this phase
(the new `/admin/growth` page and RUM script aren't in this public-page set, but neither adds any
visible layout element to these pages — RUM is a background script, `/admin/growth` is a separate,
authenticated page).

`Lighthouse check passed for all pages (median of 3 runs each)` — the script's own overall verdict.
Full raw results (all 18 individual runs, not just medians) saved to
`/tmp/lighthouse-prod/lighthouse-results.json` for this session; not committed to the repository
(local artifact, matches how CI's own equivalent runs handle this).

## Why this is trustworthy (unlike the earlier local attempts)

Two earlier attempts this phase to get a local baseline (against `wrangler dev` on `localhost`)
were explicitly abandoned as unreliable — devtools-throttling against a zero-latency loopback
address doesn't reflect real network conditions even when the local server stays up, and in this
session's case the local server also became genuinely unresponsive under concurrent load. This run
has neither problem: it measured the actual deployed Worker over the real internet, from a
completely different machine than the one serving the app.

## What this confirms about Phase 1's own changes

Nothing in this phase's code (the growth-control-plane persistence, RUM collection, or the registry
addition) touches any of the pages measured here, and none of them regressed — consistent with the
directive's own build-output inspection finding no oversized bundle or new hot-path dependency
(`CRUX_AND_RUM_BASELINE.md`). `/admin/growth` itself was not included in this pass (it's
authenticated, and Lighthouse would need a real session to measure it meaningfully) — its own
accessibility was separately validated via the full CI a11y suite (112/112 passing, including a
dedicated test for this exact page) rather than a Lighthouse run.
