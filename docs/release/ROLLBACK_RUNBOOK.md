# Rollback Runbook

## Application rollback (Worker code)

1. Identify the last known-good commit and Worker version ID — both are recorded in every
   `deploy-production.yml` run's job summary and in the `production-deploy-<sha>` artifact
   (`deploy-output.txt`).
2. Preferred: re-run `.github/workflows/deploy-production.yml` with `commit_sha` set to the
   known-good commit and the typed `confirm` input. This goes through the same quality gate,
   binding-drift check, and smoke tests as any other deploy — a rollback is just a deploy of an
   older, already-proven commit, not a special code path.
3. Emergency-only fallback: `wrangler rollback --config apps/web/dist/server/wrangler.json
--version-id <known-good-version-id>` reverts traffic to a previously-deployed Worker version
   without a rebuild. Follow up with a proper redeploy via the workflow above once the immediate
   incident is over — a `wrangler rollback` is not tracked by `deploy:verify-bindings` or smoke
   tests the way a workflow-driven deploy is.

## D1 recovery

- Never edit or delete an applied migration file. A production defect found after a migration
  shipped is fixed with a new, forward-only migration — never by reversing the old one.
- For destructive or otherwise risky schema changes, use an expand-and-contract pattern: add the
  new column/table in one migration, backfill and switch reads/writes over in application code, and
  only drop the old column/table in a later migration once nothing reads it anymore.
- Cloudflare D1 Time Travel (`wrangler d1 time-travel restore`) can restore a database to a prior
  point in time within its retention window. Rehearse this against the **preview** database only —
  never rehearse against production. See `docs/operations/BACKUP_AND_RECOVERY.md`.

## Paddle recovery

- Never delete a product, price, or notification destination as a way to "undo" a mistake —
  archive instead, and only after confirming no active customer depends on it (zero live
  subscribers on that price — see `docs/billing/LEGACY_PRICE_AND_SUBSCRIBER_POLICY.md`).
- A wrong price mapping (Phase 6 onward) is fixed by correcting the affected `plan_prices` row(s)
  — via a corrective migration/seed change, never a direct production DB edit — and shipping a
  normal release; never by mutating the price in Paddle itself. See
  `docs/billing/PADDLE_CATALOG_RECONCILIATION_RUNBOOK.md` for detecting drift and
  `docs/billing/BILLING_DEPLOYMENT_AND_ROLLBACK_RUNBOOK.md` for billing-specific deployment/
  rollback guidance.
- Transaction, subscription, and webhook history are never deleted.

## Cloudflare recovery

- Don't blindly revert DNS, TLS, WAF, or crawler-policy (robots.txt / AI Crawl Control) settings
  after an incident without first recording what they were — a rollback that isn't itself recorded
  just moves the "what changed and when" problem somewhere else.
- After any Cloudflare-side rollback, re-verify the canonical-host matrix
  (`http`/`https` × apex/`www`) exactly as described in
  `docs/deployment/CLOUDFLARE_CONFIGURATION.md`.

## Binding drift after any rollback

Always run `pnpm deploy:verify-bindings <preview|production>` after a rollback of any kind — a
`wrangler rollback` in particular reverts _code_, not necessarily the _vars_ a later deploy might
have also changed, so bindings can end up in a combination that was never actually tested together.
