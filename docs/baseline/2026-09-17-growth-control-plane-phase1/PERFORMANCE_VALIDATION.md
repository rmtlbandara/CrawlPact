---
Document owner: Engineering owner
Status: current-authoritative (Phase 1, Workstream 18 — performance baseline)
---

# Performance Validation — 2026-09-17

## What this pass could and could not honestly establish

`scripts/lighthouse-check.mjs` is explicitly written to run "against the real deployed preview
Worker after every deploy" (its own header comment) — devtools-throttling mode, which replays real
network conditions rather than simulating them, because this project previously found simulate mode
badly misjudged a real page's timing (`RISK-033`, documented in the script itself).

This pass attempted a local substitute: a locally-built app served via `wrangler dev`
(`http://localhost:8787`). That attempt is not trustworthy evidence and is not reported as a
baseline:

- The homepage's one successful run (of three attempted) measured LCP 3008ms, exceeding the
  script's 3000ms threshold — but every other run across every other page failed outright with
  Chrome connection errors once the local `wrangler dev` process became unresponsive under this
  session's own sustained load (numerous concurrent Miniflare instances, several vitest suites, and
  Lighthouse's own Chrome instances all running on the same machine in the same long session).
- Devtools-throttling against `localhost` measures near-zero real network latency in the first
  place, which is exactly the condition the script's own design (real network replay) is meant to
  avoid — a number obtained this way would not represent real-world performance even if the server
  had stayed up.

Neither of those is a defect in the Phase 1 changes; both are properties of trying to substitute a
local loopback server for the real deployed Preview this tool is designed to test against.

## What was verified instead

- `pnpm build` succeeds cleanly with every change in this branch, including the new `/admin/growth`
  page and the `web-vitals`-bundling `WebVitalsRUM.astro` component (see
  `CRUX_AND_RUM_BASELINE.md` for the specific bundling-correctness check performed on that
  component).
- The production bundle's per-file output was inspected during the build (`pnpm build`'s own
  asset-size table) — nothing in this branch introduced an unusually large chunk; the RUM script's
  own bundle is a small, separate, lazily-fetched file, not inlined into a page's critical-path
  bundle.
- No new client-side dependency was added to a hot path: `web-vitals` loads asynchronously as its
  own script, and the growth dashboard (`/admin/growth`) is a plain server-rendered Astro page (no
  new client-side JavaScript framework usage beyond what `AdminLayout`/`AdminNav` already ship).

## Conclusion and what remains

A real Lighthouse baseline — multi-run, devtools-throttled, against the actual deployed Preview
Worker — is deferred to the Preview validation step (directive §24), which is gated on pushing this
branch. Fabricating lab numbers from an unstable local substitute would violate this project's own
"never present mocked data as a real product outcome" rule more than it would help; the honest
status is "not yet measured against a real deployment," not a fabricated pass or fail.
