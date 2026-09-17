---
Document owner: Engineering owner
Status: current-authoritative (Phase 1, Workstream D/E/F/G)
---

# Google Growth Control Plane — implementation record

## What existed before this pass

`apps/web/src/lib/admin/google-insights.ts` (Phase from PR #200) is a real-time, read-only
diagnostic: `GET /api/admin/integrations/google-insights` queries Search Console (10 rows, `query`
dimension only, trailing 28 days), GA4 (`activeUsers`/`sessions` totals, trailing 7 days), and CrUX
live, on every request. Nothing was ever persisted. This is confirmed by reading the actual
implementation, not assumed from the Phase 1 directive's description of it.

## What this pass adds

A persistence layer underneath the existing diagnostic — additive, not a replacement:

- **Migration `0039_growth_snapshots.sql`**: three new tables, `gsc_daily_metrics`,
  `ga4_daily_metrics`, `crux_snapshots`, each one row per `(data_date, dimension_type,
dimension_value)`, idempotent via a `UNIQUE` constraint + `ON CONFLICT ... DO UPDATE`. Drizzle
  schema added in `packages/database/src/schema/growth.ts`; `pnpm db:validate` passes (59 tables
  verified consistent).
- **`apps/web/src/lib/growth/collect.ts`**: `collectGrowthSnapshots(d1, config, referenceDate)`.
  For Search Console, queries five dimension breakdowns (`site` total, `query`, `page`, `device`,
  `country`) each with `date` as a leading dimension, over a 5-day trailing window by default
  (configurable) — the window is re-collected and upserted every run rather than tracked as
  "settled/unsettled" per day, so a day's row keeps quietly correcting itself for the ~2-3 days
  Search Console takes to settle (§8.1 of the directive). For GA4, queries four breakdowns (`site`,
  `sessionDefaultChannelGroup`, `landingPage`, `deviceCategory`) for the single most-recently
  completed day, capturing `activeUsers`/`newUsers`/`sessions`/`engagedSessions`/`keyEvents`. For
  CrUX, persists the existing single-origin query's LCP/INP/CLS p75 values when available. Every
  provider is independently isolated (a GA4 misconfiguration cannot block GSC or CrUX, and one
  failing GSC dimension call cannot block the other four) — verified by dedicated tests, not just
  asserted in a comment.
- **`apps/web/src/worker.ts`**: wired as its own `ctx.waitUntil(runGrowthCollectionJob(...))` in the
  existing daily (`0 3 * * *`) cron, using the same `scheduled_job_runs` row-per-run convention
  every other job in this file already uses (job name `growth_collection`). Unconditional — like
  the retention job — since every Google config value is legitimately absent on Preview
  (Production-only vars) and `collectGrowthSnapshots` already reports that as `not_configured`,
  never a job failure.
- **`apps/web/src/lib/admin/growth-dashboard.ts`**: `getGrowthDashboard(db, cruxOrigin,
referenceDate)` — pure SQL reads (Drizzle) over the persisted tables: 7-day and 28-day GSC
  totals, a 28-day-vs-prior-28-day period comparison with click/impression delta percentages,
  top-10 queries/pages and top devices/countries by clicks, GA4 7-day totals, top acquisition
  channels and landing pages, and the latest CrUX snapshot. Every "no rows yet" case returns an
  explicit `hasData: false` / `{status: "no_data"}` rather than a fabricated zero.
- **`apps/web/src/pages/admin/growth.astro`**: new Super Admin page (linked from `AdminNav.astro`
  under "Overview") rendering the above — data-quality freshness chips, GSC/GA4/CrUX sections, and
  honest empty states ("No settled Search Console data yet") when a table has no rows.

## What this pass deliberately does not change

- The existing `/api/admin/integrations/google-insights` diagnostic endpoint and its narrower
  client functions (`queryGa4Report`, the original `querySearchConsole` call shape) are untouched —
  they remain the live connectivity check. `queryGa4DimensionedReport` is a new, additive function
  in `ga4.ts`, not a replacement.
- Nothing here calls a live Google API from this session — the collection code only runs inside the
  Cloudflare Worker runtime (Production-only secrets). No GSC/GA4 baseline numbers could be pulled
  in this pass without either deploying this code or the account owner running an authenticated
  admin session against production; `GSC_BASELINE.md`/`GA4_BASELINE.md` (directive §36) are
  therefore deferred to after this branch reaches Preview/Production, not fabricated now.

## Test evidence

- `apps/web/src/lib/growth/collect.test.ts` (7 tests): not-configured isolation without a token
  exchange, a fully successful run's exact row counts and bound SQL parameters, GA4-misconfigured
  isolation, partial-dimension-failure still reporting `ok` with a partial count, whole-provider
  failure reporting the real reason, token-exchange failure propagating to both GSC and GA4, and a
  custom `gscWindowDays` option computing the right query window.
- `apps/web/src/lib/google/ga4.test.ts`: 4 new tests for `queryGa4DimensionedReport` (request shape,
  row normalization, the null-dimension "site" label, and a 429 mapping to `rate_limited`).
- `apps/web/tests/integration/growth-dashboard.integration.test.ts` (5 tests, real D1 via
  Miniflare, migrations applied as-is): empty-install low-data state, 28-day-vs-prior-28-day delta
  arithmetic verified against hand-computed expected values, top-N ranking by clicks, GA4 channel/
  landing-page aggregation independent of GSC, and CrUX latest-snapshot-per-origin selection.
- Full repo: `pnpm typecheck` (astro check, 0 errors), `pnpm lint` (0 warnings/errors), `pnpm
format:check` (clean after `prettier --write`), `pnpm build` (succeeds), `pnpm db:validate` (59
  tables consistent), unit suite 846/846 passing, integration suite 399/399 passing (at
  `--maxWorkers=2`; see the local-parallelism note in `GIT_AND_REPOSITORY_RECONCILIATION.md`).

## Remaining before this workstream is fully done

- Deploy to Preview and manually verify the `/admin/growth` page renders correctly against a real
  (if empty) D1 instance, per directive §29.
- After a Production deploy, let the daily cron run at least once and confirm real rows land in
  `gsc_daily_metrics`/`ga4_daily_metrics`, then produce `GSC_BASELINE.md`/`GA4_BASELINE.md` from
  real collected data — not before, and not fabricated.
- Own-site Web Vitals RUM (directive §13) and the search-opportunity classification model
  (directive §8.2) are separate, not-yet-started pieces of Workstream D/I — tracked as continuing
  work, not silently folded into "done."
