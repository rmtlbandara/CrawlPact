# Phase 3 Starting Baseline — App-Subdomain Migration

Date: 2026-09-09. This is the re-verified state immediately before any Phase 3 external or
deployment action. Everything below was captured this session, live, not assumed from Phase 1/2
records.

## Git / working tree

- Branch: `fix/canonical-hash-fragment-links`
- HEAD: `db4c3ea243fd0f18b81167371e4d62df2b778be5` — identical to `origin/fix/canonical-hash-fragment-links`
  (this branch's already-pushed history is unaffected; all Phase 1+2 work is uncommitted local
  changes on top of it)
- Working tree: 38 modified files + 9 new source/test files + 3 new documentation folders
  (`docs/baseline/2026-09-09-app-subdomain-phase1/`, `.../phase2/`, ADR-0010), exactly as Phase 2
  left them — verified via `git status`, nothing lost or altered
- **Nothing has been committed. Nothing has been pushed. Nothing has been deployed.**

## Revalidation of Phase 2 (rerun this session, not copied from the Phase 2 report)

| Check                   | Result                                                                                                                                                                                                                                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`        | PASS — 0 errors                                                                                                                                                                                                                                                                                                        |
| `pnpm test:unit`        | PASS — 52 files, 603 tests                                                                                                                                                                                                                                                                                             |
| `pnpm test:integration` | PASS — 56 files, 394 tests, on the second attempt. The first attempt hit the same pre-existing local Miniflare/D1-harness resource-contention pattern documented in Phase 1/2 (this time compounded by a stale `workerd` process left over from an earlier test run in this session, which was killed before retrying) |

## Cloudflare (live-verified, re-queried this session)

- `app.crawlpact.com`: **still no DNS record of any kind, still no Custom Domain attached.** No
  drift since Phase 1's original finding.
- Zone DNS records unchanged: `www` CNAME, mail (MX/TXT/DKIM/DMARC), `AAAA` for apex/`preview`/
  `e2e-fixture`. No conflicting record for `app`.
- Custom Domains attached account-wide: `crawlpact.com`→`crawlpact-web`,
  `preview.crawlpact.com`→`crawlpact-web-preview`, `e2e-fixture.crawlpact.com`→`crawlpact-e2e-fixture`,
  plus four unrelated domains belonging to other projects in this account (`echobuddha.com`,
  `ezroamguide.com`, `nimblegridgames.com`, `lowerbillhome.com`) — untouched, not in scope.
- Production Worker: `crawlpact-web` (id `3d5f91afdf5245b0b067a7525e9e387f`) — this session did not
  fetch a full deployment/version history; that is a Phase 3 in-flight recording item once a
  deployment actually happens.

## Paddle (live-verified, re-queried this session)

- Exactly one approved checkout domain: `crawlpact.com` (unchanged from Phase 1). `app.crawlpact.com`
  is still not registered with Paddle at all.

## Production blast radius (live D1 aggregate counts, re-queried this session, no PII)

| Metric                    | Phase 1 (2026-09-09) | Phase 3 (this check) |
| ------------------------- | -------------------- | -------------------- |
| Total users               | 3                    | 3                    |
| Currently active sessions | 0                    | 0                    |
| Passkey credentials       | 4                    | 4                    |
| Subscriptions             | 2                    | 2                    |

No drift. This remains the lowest-risk possible window for the migration's one-time
reauthentication cost.

## Google

Not independently re-checked this session — this session has no Google Cloud Console access, same
as Phase 1. Assumed unchanged (no reason to believe otherwise); will be re-confirmed at the point
the origin is actually added.

## What this baseline means for how Phase 3 proceeds

Every fact Phase 1 and Phase 2 relied on still holds. There is no technical reason Phase 3 cannot
proceed. What it needs next is a series of genuinely irreversible or externally-consequential
actions — a commit and push, a Preview deployment, a Production deployment, a Cloudflare Custom
Domain attachment, a Google Cloud Console change, and a Paddle live-domain submission — each of
which requires the user's explicit, in-the-moment authorization before being taken, per standing
project instruction. See the conversation for the specific go/no-go points raised before proceeding
further, and `PHASE_3_ACTION_PLAN.md` for the exact prepared sequence awaiting authorization.
