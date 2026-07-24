# Runbook

Operational procedures, citing real routes/functions/commands only — nothing here is
hypothetical. Updated Part 3 Step 20 to correct sections that were placeholders in Part 1 and are
now real, built features.

## Deploying (manual)

There is no automated deploy pipeline — CI builds and validates but never deploys (project rule:
no production deployment without explicit, in-the-moment permission). To deploy manually once
authorised:

```bash
pnpm install
pnpm build
wrangler d1 migrations apply crawlpact-db --remote --config apps/web/wrangler.jsonc
wrangler deploy --config apps/web/wrangler.jsonc
```

## Rotating secrets

Set via `wrangler secret put <NAME> --config apps/web/wrangler.jsonc`. Never in `wrangler.jsonc`
itself (that file is committed) — only non-secret `vars` belong there.

## Maintenance mode (SRS §28.17)

Implemented since Part 3 Step 11. Toggled via the runtime-configuration key `maintenance_mode`
(one of two `HIGH_IMPACT_KEYS` requiring extra confirmation in the admin UI). When on: the public
site stays online, the customer dashboard becomes read-only (enforced in
`lib/auth/require-session.ts` for every non-safe HTTP method), new anonymous audits are blocked
(`pages/api/audit/index.ts`), the scheduled monitoring sweep is skipped (`worker.ts`), Paddle
webhooks keep processing, and Super Admin itself stays fully operational (administrators are
exempt from the dashboard-read-only check, so the person managing the incident isn't locked out).

**To activate**: go to `/admin/settings` (Runtime settings) and toggle "Maintenance mode," or call
the underlying route directly:

```
POST /api/admin/settings/maintenance_mode
{ "value": "true", "reason": "<why — required, min 3 chars, goes to the audit log>" }
```

This route requires an authenticated Super Admin session with a **recent** passkey
authentication (step-up) — it cannot be scripted with a bare API key or curl alone; use the admin
UI, which handles the WebAuthn re-authentication prompt.

## Pausing the scheduled monitoring sweep

Separate from maintenance mode — use this when the scanner itself is misbehaving (e.g. causing
abuse complaints or hammering a target) but the rest of the product should stay normal. Toggled
via the runtime-configuration key `scheduler_paused` (also a `HIGH_IMPACT_KEY`), same route shape:

```
POST /api/admin/settings/scheduler_paused
{ "value": "true", "reason": "..." }
```

Enforced in `worker.ts`'s `scheduled()` — the cron sweep records a "skipped" `scheduled_job_runs`
row with this reason instead of claiming/scanning domains. Paddle webhooks and the public site
are unaffected.

## Scheduled job monitoring

`worker.ts`'s `scheduled()` writes a row to `scheduled_job_runs` on every cron tick, for both the
monitoring sweep and the daily data-retention purge. Since Part 3 Step 7, this is surfaced in the
admin UI at `/admin/jobs` (list of runs) and `/admin/health` (missed/overlapping/stuck/
high-failure-rate anomaly detection — `lib/admin/scheduler.ts`'s `detectSchedulerAnomalies`), not
just a raw table. Manual query if needed:

```bash
wrangler d1 execute crawlpact-db --remote --config apps/web/wrangler.jsonc \
  --command "SELECT * FROM scheduled_job_runs ORDER BY started_at DESC LIMIT 10;"
```

## Rolling back a bad deploy

`wrangler deploy` has no built-in rollback; redeploy the previous known-good commit. Database
migrations are forward-only (see `docs/data/MIGRATION_POLICY.md`) — a bad migration needs a new
forward-fix migration, never editing or deleting an applied one.

## Rolling back a bad registry or ruleset release

Since Part 3 Step 8, this has real admin tooling instead of requiring a raw D1 edit:

```
POST /api/admin/registry/releases/:versionId/rollback   { "reason": "..." }
POST /api/admin/registry/rulesets/:versionId/rollback   { "reason": "..." }
```

(`lib/admin/registry.ts`'s `rollbackRegistryVersion`/`rollbackRulesetVersion` — repoints
`is_active` back to the target version; never deletes the bad release, since release history is
immutable per FR-REG-007). Use `/admin/registry/releases` (or `/rulesets`) in the UI, which also
shows `compareRegistryVersions`'s diff and lets you run `getAffectedDomains`/
`scheduleReEvaluation` to force a fresh re-scan of every domain the bad release affected.

## Reconciling a subscription against Paddle

Since Part 3 Step 4. If `/admin/subscriptions` shows an `entitlementMismatch` (local `plan_id`
disagrees with the subscription's real plan) or a recorded `syncError`:

```
POST /api/admin/subscriptions/:subscriptionId/resync   { "reason": "..." }
```

(`lib/admin/subscriptions.ts`'s `resyncSubscription` — makes a real Paddle API call via
`getSubscription`, not a local-only guess; on failure it honestly records `syncError` rather than
claiming success.)
