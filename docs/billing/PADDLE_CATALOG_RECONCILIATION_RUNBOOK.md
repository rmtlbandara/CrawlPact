# Paddle catalog reconciliation runbook

Two layers of drift detection between the DB-backed `plan_prices` catalog and reality, and one
explicitly separate, not-yet-built layer for actually fixing drift.

## Layer 1 — always-on, in-app (`/admin/plans`)

`computeCatalogStatusFlags()` (`apps/web/src/lib/admin/plan-catalog-status.ts`) runs on every
`/admin/plans` page load, comparing `plan_prices` against **itself** (no external call): missing
mappings (a paid plan/interval/environment combination with zero active rows for the _currently
running_ environment), duplicate mappings, non-unique Paddle price IDs, a legacy price still
marked active for new checkout, and an archived price with live subscribers still on it. This
catches internal data-entry mistakes instantly, with no credentials or network call beyond D1
itself, and is what a Super Admin sees first.

## Layer 2 — on-demand, against live Paddle (`pnpm paddle:catalog:verify`)

`scripts/paddle-catalog-verify.ts` additionally compares `plan_prices` against a live read of
Paddle's own `/prices` API — the thing Layer 1 structurally cannot see (Paddle-side drift: a price
archived directly in the Paddle dashboard, an amount changed outside this app's own process,
etc.).

```
pnpm paddle:catalog:verify <preview|production>
```

Requires `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN` (read-only D1 REST query — the same
narrowly-scoped Workers deploy credentials `deploy:verify-bindings` already uses) and
`PADDLE_API_KEY` for the **matching** Paddle environment (`preview` → sandbox key, `production` →
production key — the script reads `apps/web/wrangler.jsonc`'s `PADDLE_ENVIRONMENT` for the target
to pick the right Paddle API base URL automatically). Never writes to D1 or Paddle. Exits non-zero
if any row has a status other than `matched`/`verification-blocked`, so it can be run as a manual
pre-deploy check or wired into a scheduled CI job later if that's ever wanted — neither is
currently automated into the deploy pipeline itself, to avoid adding a live-credentials dependency
to every routine deploy.

### Status vocabulary

| Status                 | Meaning                                                                                                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `matched`              | Paddle and the DB agree on product, amount, currency, interval, and trial state.                                                                                                         |
| `missing-in-paddle`    | `plan_prices` references a Paddle price ID that doesn't exist live.                                                                                                                      |
| `missing-in-app`       | A live Paddle price under one of our known product IDs has no `plan_prices` row at all.                                                                                                  |
| `amount-mismatch`      | The cents amount differs.                                                                                                                                                                |
| `interval-mismatch`    | Paddle's `billing_cycle.interval` differs from the DB's `interval`.                                                                                                                      |
| `currency-mismatch`    | Paddle's currency isn't USD.                                                                                                                                                             |
| `trial-mismatch`       | The live price has a `trial_period` set — Phase 6 policy prohibits trials entirely, so any trial period found here is itself the defect.                                                 |
| `environment-mismatch` | The live price's `product_id` doesn't match the DB's recorded `paddle_product_id` for that row.                                                                                          |
| `verification-blocked` | The row can't be checked at all — currently only fires for the sandbox seed's placeholder IDs (`pri_sandbox_placeholder_*`), which were never created as real Paddle prices (see below). |

Duplicate `paddle_price_id` values across rows are reported separately (`DUPLICATE` lines), mirroring
Layer 1's own check, re-derived independently in this script so it works standalone.

### Current known state (as of Phase 6 shipping)

- **Production**: all 9 non-archived rows (6 current + 3 legacy) reference real, live-created
  Paddle prices — see `docs/billing/PADDLE_LIVE_CATALOG_MAP.md` for the exact IDs and their
  origin. Running this command against `production` is expected to report all `matched` (modulo
  normal transient API issues).
- **Preview/sandbox**: the 6 sandbox rows are seeded with placeholder IDs
  (`pri_sandbox_placeholder_*`), not real Paddle sandbox prices — no sandbox Paddle catalog was
  created in Phase 6 (out of scope; production was the only live-write target this phase touched,
  per `docs/billing/PADDLE_LIVE_PREFLIGHT_CHANGE_MANIFEST.md`). Running this command against
  `preview` today will report all 6 as `verification-blocked`, honestly, not as a false `matched`
  or a crash. Creating real sandbox prices (for genuine end-to-end sandbox checkout testing) is a
  separate, future, explicitly-scoped piece of work.

## Layer 3 — fixing drift (not yet built)

There is deliberately no `pnpm paddle:catalog:sync` (write) command yet. If Layer 2 ever reports
real drift against production, the fix today is manual and explicit: re-run the same
preflight/idempotency/stop-condition process `docs/billing/PADDLE_LIVE_PREFLIGHT_CHANGE_MANIFEST.md`
used for the original 6 price creations — write a fresh manifest describing exactly what would
change, get explicit confirmation, then make the specific, itemized live write. A future
`paddle:catalog:sync` command, if built, must be a separate script from `verify` (never folded into
it) and must apply the same idempotency-check-before-write discipline the manifest process used —
this is a deliberate scope boundary, not an oversight: this phase does not build unattended
catalog-repair automation for a live payments account.
