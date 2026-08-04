# Billing deployment and rollback runbook (Phase 6)

Deployment-specific guidance for the pricing/checkout/plan-change work. This supplements, and does
not replace, the standard pipeline (`docs/deployment/DEPLOYMENT.md`,
`docs/deployment/GITHUB_ACTIONS_DEPLOYMENT.md`) and the general rollback runbook
(`docs/release/ROLLBACK_RUNBOOK.md`) — read those first for the mechanics of `deploy-preview.yml`/
`deploy-production.yml` themselves. Nothing here bypasses CLAUDE.md's rule that production
deployment always requires a fresh, explicit, in-the-moment confirmation.

## The reference-data seed step is now automatic — why that changed

**Finding during Phase 6's own deployment prep**: migration `0021_plan_prices.sql` creates the
`plan_prices` table, but a migration only creates schema — it never contains data. The actual
price rows live in `packages/database/seed/reference-data.sql`, which historically had to be run
**manually** via `pnpm db:seed:reference-data:remote` after a migration that adds seed-dependent
data (this is how `plans`/`admin_roles`/the crawler registry were originally seeded into
production). Neither `deploy-preview.yml` nor `deploy-production.yml` ran this automatically.

Because `/pricing` is now SSR and reads `plan_prices` on every request (`getPlanCatalogEntry`
throws if an active price row is missing for a paid plan — see `plan-catalog.ts`), an unseeded
`plan_prices` table doesn't fail quietly: **the pricing page 500s**, and so does `/app/billing`,
`/api/billing/checkout`, and both plan-change endpoints. Worse, `deploy-preview.yml` auto-triggers
on every successful `main` CI run and its own `smoke:preview` step checks `/pricing/` for a 200 —
so merging Phase 6 without fixing this would have caused the very next automatic preview deploy to
fail its own smoke test, autonomously, with no human in the loop at that moment.

**Fix**: both `deploy-preview.yml` and `deploy-production.yml` now run the reference-data seed
step immediately after migrations, on every deploy:

```yaml
- name: Apply pending migrations to production D1
  run: pnpm exec wrangler d1 migrations apply crawlpact-db --remote --config apps/web/wrangler.jsonc
- name: Seed reference data into production D1
  run: pnpm run db:seed:reference-data:remote
```

This is safe to run unconditionally on every deploy because `reference-data.sql` is entirely
`INSERT OR IGNORE` (verified: every statement in the file uses this form) — it never overwrites or
deletes an existing row, so a deploy where nothing reference-data-related changed is a no-op here.
This closes the gap for good, not just for Phase 6's own new table — any future migration that
adds seed-dependent data now gets it automatically on the next deploy, for both environments.

`packages/database/package.json` gained one new script for this:
`seed:reference-data:remote:preview` (targets `crawlpact-db-preview`, mirroring the existing
`seed:reference-data:remote` which targets production's `crawlpact-db`) — exposed at the root as
`db:seed:reference-data:remote:preview`.

## Deployment order for this phase specifically

Standard order (`deploy-production.yml`'s existing step sequence, unchanged in shape): quality
gate → environment contract validation → build → **migrate** → **seed** (new) → deploy Worker →
verify bindings → smoke test. For Phase 6, this means:

1. Migration `0021_plan_prices.sql` creates `plan_prices` and the 5 new nullable `subscriptions`
   columns — additive only, no destructive change, safe to run against a live database with
   traffic (expand side of expand-and-contract; there is no contract side needed here since
   nothing is being removed).
2. The seed step populates `plan_prices` with the real production Paddle price IDs (already
   created live — see `docs/billing/PADDLE_LIVE_CATALOG_MAP.md`) and the sandbox placeholder rows.
   **This must succeed before the new Worker code serves traffic** — if the Worker deploy step ran
   before seeding, there would be a window where new code reads an empty table. The workflow order
   (seed before deploy) already prevents this; do not reorder it.
3. The Worker deploy itself is the point every checkout/plan-change/pricing-page code path
   actually goes live.

## Rollback specifics for this phase

- **Application code rollback** (a bad `plan-catalog.ts`/checkout/plan-change bug): follow
  `docs/release/ROLLBACK_RUNBOOK.md`'s standard "redeploy a known-good commit" procedure —
  unchanged. The `plan_prices` table and its data are additive and harmless to leave in place even
  if the _code_ is rolled back to a pre-Phase-6 commit; a rolled-back Worker simply won't read that
  table (the old `plan-mapping.ts`/env-var routing no longer exists in a rolled-back build only if
  rolling back past the commit that removed it — see below).
- **Do not roll back past the commit that removed `plan-mapping.ts` and the env-var price
  routing** without also reverting the webhook/checkout code that depends on `plan_prices` — the
  two were replaced together, not incrementally, so a partial rollback (new schema, old routing
  code) would leave checkout resolving prices via `PADDLE_PRICE_ID_SOLO`/`PRO`/`AGENCY` env vars
  again, which have been effectively frozen at their original single-annual-price values and would
  silently ignore the new monthly prices and the 3 legacy rows entirely.
- **Never delete or archive a live Paddle price as a rollback step.** If Phase 6's live catalog
  writes (the 6 new prices) ever need to be "undone," the correct action is to set
  `active_for_new_checkout = 0` on the affected `plan_prices` rows (a local, reversible,
  non-destructive change) — never to archive or delete the price in Paddle itself, which is
  irreversible and would break any subscriber who already purchased it. See
  `docs/billing/LEGACY_PRICE_AND_SUBSCRIBER_POLICY.md`.
- **The scheduled-downgrade cron job** (`applyDueScheduledDowngrades`, wired into `worker.ts`'s
  `scheduled()` handler) is gated behind `BILLING_ENABLED === "true"`, matching every other
  billing surface — a rollback of the whole Phase 6 Worker automatically stops this job from
  running (no separate toggle needed), and any subscription with a pending
  `scheduled_change_effective_at` simply stays pending (never partially applied) until a working
  deploy resumes the sweep.

## Post-deployment verification checklist (billing-specific, beyond the standard smoke test)

1. `smoke:production`'s existing `/pricing/` check confirms the page renders (200) — this alone
   confirms `plan_prices` is non-empty for the running environment, since a missing active price
   row throws inside `getPlanCatalogEntry` and would surface as a 500.
2. Manually spot-check `/admin/plans` in the deployed environment: `computeCatalogStatusFlags`
   should show zero flags (see `docs/billing/PADDLE_CATALOG_RECONCILIATION_RUNBOOK.md` for the
   fuller reconciliation process, including the live-Paddle-comparing `paddle:catalog:verify`
   script).
3. Confirm the existing pre-Phase-6 subscriber (see
   `docs/billing/PHASE_06_EXISTING_BILLING_BASELINE.md`) still resolves correctly: their
   `subscriptions.paddle_price_id` should already be backfilled the next time any webhook event
   fires for them (no backfill migration was run — the column is nullable and only populated
   going forward, by design, since a backfill would require calling Paddle's API for every
   existing subscription and was judged unnecessary given there is exactly one).
