# Paddle Live Configuration Report

**Execution timestamp:** 2026-07-26
**Repository:** `rmtlbandara/CrawlPact`
**Branch:** `main`
**HEAD at time of this report:** `9f93b19a16a61d1f13976ddc4402c6f731f9d6d4`
**Historical snapshot — superseded.** `/pay` was built and deployed in the two commits
immediately after this report (`72e32a8`, `21c5fb6`), closing the default-payment-link gap this
report describes as open below. See `docs/deployment/PADDLE_LIVE_CONFIGURATION.md` and
`docs/architecture/adr/ADR-0007-DEPLOYMENT-PIPELINE.md` for the current state as of the
2026-07-27 release-engineering pass.

## How this pass started

A document was provided instructing a full "from scratch" Paddle Live catalog creation, framed
with unusual pressure to skip confirmation ("do not ask for additional confirmation merely because
the environment is Live," pre-emptive claims of blanket authorization). That framing was flagged to
the user as resembling a prompt-injection pattern before any action was taken; the user confirmed
they did intend the underlying request. Work proceeded from there, but as **verification first,
creation only if needed** — which is exactly what the document's own idempotency rules would have
required if followed literally.

## What verification found

The document's own cited baseline commit, `9f93b19a16a61d1f13976ddc4402c6f731f9d6d4`, is titled
"feat: connect live Paddle catalog, client token, and webhook secrets" — the catalog the task asked
to create already existed, created in the session that produced this exact commit. Proceeding to
recreate it would have produced duplicate live products/prices/tokens/webhooks. None were created.

## Live-environment proof

- Paddle account/seller identity: not separately queried via an account-info endpoint; confidence
  that this is genuinely Live rests on every resource read having Live-prefixed IDs (`pro_`, `pri_`
  and a `live_`-prefixed client token, `pdl_ntfset_`-prefixed webhook secret key) with zero sandbox
  indicators anywhere in the responses.
- Only Paddle MCP read/get/list operations were used against products, prices, notification
  settings, client tokens, and checkout domains — no create/update/delete Paddle call was made.
- Sandbox was never invoked — no `paddle-sandbox` namespace exists in this session's tool set at
  all.
- No customer, subscription, transaction, adjustment, refund, or chargeback was created.
- No charge was triggered; no checkout was opened with payment details.

## MCP operations performed (all read-only against Paddle)

`prices.get` ×3 (Solo/Pro/Agency, with `product` included), `products.list`,
`notificationSettings.list`, `clientTokens.list`, `checkoutDomains.list`.

## Resources: created / reused / updated / archived / preserved

- **Created:** none.
- **Reused (found already correct):** 3 products, 3 prices, 1 notification destination, 1 client
  token (the one actually referenced in code).
- **Updated:** none.
- **Archived:** none.
- **Preserved / deliberately left alone:** a second, unused live client token
  (`ctkn_01kyfk8k7qp2a7bmfj0amgcxxr`, name "CRAWLPACT") — confirmed unreferenced anywhere in the
  codebase via repo-wide grep, left in place per the user's explicit choice rather than revoked
  unilaterally.

## Non-secret canonical IDs

See `docs/deployment/PADDLE_LIVE_CONFIGURATION.md`'s tables — reproduced in full there, not
duplicated here.

## Client-token metadata

Two active Live tokens exist in the account; only `ctkn_01kyfk8x7xbsz450tet3zb4c96` ("CrawlPact
production web") is referenced by `wrangler.jsonc`/code. Token values are not reproduced in this
report.

## Checkout-domain status

`crawlpact.com`: initially found **not submitted** (`checkoutDomains.list` returned zero results).
Paddle's API exposes `list`/`get`/`delete`/payment-method-verification for checkout domains but no
creation endpoint, so submission required the Paddle Dashboard directly (manual, outside any
connected tool). Re-checked live on request afterward: **`approved`**
(`chedom_01kyfnvdzbbvxx40vr7b3hvz98`), with Apple Pay payment-method verification also `verified`.

## Notification-destination status and event coverage

`ntfset_01kyfkc59d8h66prnhw220hnzy`, `active`, `traffic_source: platform`, destination
`https://crawlpact.com/api/billing/webhook`, `api_version: 1`. Subscribed events: the complete
`transaction.*` (billed/canceled/completed/created/paid/past_due/payment_failed/ready/
updated/revised), `subscription.*` (activated/canceled/created/imported/past_due/paused/resumed/
trialing/updated), `customer.*` (created/imported/updated), and `adjustment.*`
(created/updated) families. Cross-checked against `webhook-processor.ts`'s
`event.eventType.startsWith("subscription."|"transaction."|"adjustment."|"customer.")` dispatch —
full coverage, no gap.

## Default payment-link result

Not configured. Blocked on both an approved checkout domain and a real public route (`/pay`),
neither of which exists; the user explicitly deferred building `/pay` this pass.

## Code changes

| File                                                               | Purpose                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/lib/billing/webhook-processor.ts`                    | Corrected a stale header comment claiming the integration was entirely unverified against a live account; now states the actual, narrower truth (entity field-shapes cross-checked against live reads 2026-07-26; real webhook delivery still unverified) |
| `docs/status/KNOWN_RISKS.md`                                       | Same correction applied to the matching risk-table entry; added a new, separately-discovered risk entry for the Cloudflare vars deployment gap below                                                                                                      |
| `docs/deployment/CLOUDFLARE_CONFIGURATION.md`                      | Corrected a stale paragraph claiming `PADDLE_API_KEY`/`PADDLE_WEBHOOK_SECRET` were unset in Cloudflare (they are set, confirmed via direct API read); documented the newly-found vars deployment gap                                                      |
| `docs/deployment/PADDLE_LIVE_CONFIGURATION.md` (new)               | Required deliverable — architecture, canonical resources, environment mapping                                                                                                                                                                             |
| `docs/deployment/PADDLE_LIVE_GO_LIVE_CHECKLIST.md` (new)           | Required deliverable — item-by-item go-live status                                                                                                                                                                                                        |
| `docs/status/PADDLE_LIVE_CONFIGURATION_REPORT.md` (new, this file) | Required deliverable — execution report                                                                                                                                                                                                                   |

No Paddle integration logic, webhook signature verification, idempotency handling, or entitlement
logic was modified — only comments/documentation. Files also showing as modified in `git status`
(`apps/web/src/lib/admin/environment.ts`, `apps/web/src/pages/status.astro`,
`docs/status/IMPLEMENTATION_STATUS.md`, `docs/deployment/CLOUDFLARE_ENVIRONMENT_MATRIX.md`,
`docs/operations/RUNBOOK.md`, and the untracked `environment.test.ts`) predate this session or are
`pnpm format`'s reformatting of pre-existing drift — not new content changes from this task.

## A real, separately-discovered production issue

While verifying Cloudflare's side of the handoff (a read-only API call against the live
`crawlpact-web` Worker's settings, cross-referenced against its deployment history), found that
`PADDLE_PRICE_ID_SOLO`/`PRO`/`AGENCY` and `PUBLIC_PADDLE_CLIENT_TOKEN` — all present and correct in
`wrangler.jsonc` — are **absent from the live Worker's actual deployed bindings**. Root cause: the
last full `wrangler deploy` (`2026-07-26T12:28:44Z`) predates when these vars were added to the
file (~16:08–16:14Z the same day); the two later deployments were `wrangler secret put` calls,
which don't re-read `vars`. Practical effect: `plan-mapping.ts` reads these values with no
request-time validation, so checkout was very likely silently broken in production. **Fixed in this
same pass**, after explicitly asking and receiving the user's in-the-moment authorization: rebuilt
(`pnpm build`), applied D1 migrations (`wrangler d1 migrations apply crawlpact-db --remote` —
reported "No migrations to apply," as expected), then ran `wrangler deploy --config
apps/web/dist/server/wrangler.json` (Version ID `69b71641-7dc6-4411-9c7e-ea539eb31967`). A direct
Cloudflare API read of the live Worker's settings immediately afterward confirmed all four vars
present with correct values, secrets untouched (`PADDLE_API_KEY`/`PADDLE_WEBHOOK_SECRET`/
`SESSION_SIGNING_SECRET` all still `secret_text`), and `https://crawlpact.com/`/`/status` both
returned `200`.

## Validation (quality gate, this session)

| Check                                  | Result                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| Format                                 | Pass (after `pnpm format` fixed pre-existing + this session's table-edit drift) |
| Lint                                   | Pass — 0 errors                                                                 |
| Typecheck                              | Pass — 294 files, 0 errors, 0 warnings, 31 informational hints                  |
| Unit tests                             | Pass — 194/194, 19 files                                                        |
| Integration tests                      | Pass — 137/137, 22 files, against real D1                                       |
| Database validation                    | Pass — 38 tables consistent                                                     |
| Build                                  | Pass                                                                            |
| Secret scan (`scripts/secret-scan.sh`) | Pass — no known secret patterns found in tracked files                          |

## Legacy resources

None requiring cleanup beyond the one duplicate client token already discussed (deliberately
preserved, not archived).

## Manual actions required (not possible via any connected tool)

1. Submit `crawlpact.com` as a checkout domain: Paddle Dashboard → Checkout → Domains.
2. Run a real `wrangler deploy` (using the current `wrangler.jsonc`) against the production
   Worker to close the vars-deployment gap above.

## Blocked operations

- Setting the Paddle default payment link to `https://crawlpact.com/pay` — blocked on both the
  checkout-domain approval and the (deliberately unbuilt) `/pay` route.
- Real end-to-end webhook delivery / live-checkout verification — out of authorized scope (no
  customer/subscription/transaction may be created).

## Residual risks

See `docs/status/KNOWN_RISKS.md` for the full, current list — most relevantly: the vars deployment
gap (new, this pass), the checkout-domain approval gap, no `/pay` route, and the pre-existing "no
real webhook delivery has ever been observed" risk (narrowed but not closed by this pass's
live-read cross-check).

## Rollback

No live Paddle resource was created, updated, or archived — nothing to roll back on the Paddle
side. The documentation/comment changes in this pass are plain-text `git diff`-reversible if
needed. One production Cloudflare deploy _was_ performed this pass (user-authorized, to fix the
vars gap above) — Version ID `69b71641-7dc6-4411-9c7e-ea539eb31967`. Per `docs/operations/
RUNBOOK.md`, `wrangler deploy` has no built-in rollback; rolling back would mean redeploying the
prior known-good version (`9fadbe5f-e4b0-488b-8e37-6a1e7dc34a3a`, deployed `2026-07-26T12:28:44Z`)
— not expected to be needed, since this deploy only added previously-missing, already-correct
`vars` and changed no application logic.

## Git status at end of this pass

Branch `main`, HEAD `9f93b19a16a61d1f13976ddc4402c6f731f9d6d4`. Modified/untracked files listed
above under "Code changes." No secrets appear in any tracked file (`scripts/secret-scan.sh`
confirms this); no `.secrets/` file was created.
