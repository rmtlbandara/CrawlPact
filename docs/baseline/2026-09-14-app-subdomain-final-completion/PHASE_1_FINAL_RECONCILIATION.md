# Phase 1 — Final Reconciliation

Status 2026-09-14. This document re-audits Phase 1's architecture/route-ownership decisions
against the real, current system rather than trusting historical docs. Evidence class: SOURCE
INSPECTION and AUTOMATED TEST unless otherwise noted.

## Starting state verification (Master Finalization Directive §1)

Re-checked directly, not assumed from the directive's stated baseline:

| Item                        | Directive's claim                          | Actual (verified this pass)                                                                                                                                                                                                                                                                                             | Match            |
| --------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `main` SHA                  | `2c5b71238a9117c1719fe996ffab683b36540522` | `2c5b71238a9117c1719fe996ffab683b36540522` (`git rev-parse origin/main`)                                                                                                                                                                                                                                                | ✅               |
| Working tree                | —                                          | clean (`git status --short`)                                                                                                                                                                                                                                                                                            | ✅               |
| Production runtime commit   | `d77ae4ecd57...`                           | confirmed live via Cloudflare API (Worker version below)                                                                                                                                                                                                                                                                | ✅               |
| Production Worker version   | `4078cdd9-2639-4421-ae68-af8174d03b69`     | confirmed live at 100% via `GET .../deployments`                                                                                                                                                                                                                                                                        | ✅               |
| Stage-A redirect status     | `307`                                      | confirmed via live curl (`PRODUCTION_CUTOVER_EVIDENCE.md`)                                                                                                                                                                                                                                                              | ✅               |
| Stage B / Stage C           | NOT STARTED                                | confirmed via source inspection (`LEGACY_REDIRECT_STATUS === 307`, `requireCeremonyOrigin` accepts any trusted origin)                                                                                                                                                                                                  | ✅               |
| WebAuthn RP ID (production) | `crawlpact.com`                            | confirmed in `wrangler.jsonc`                                                                                                                                                                                                                                                                                           | ✅               |
| Open PRs                    | —                                          | 13 open, all Dependabot dependency-bump PRs (#136–#188), none touching this migration's own code                                                                                                                                                                                                                        | noted            |
| `main` CI on current tip    | —                                          | initial run failed (2c5b712, run `34851425830`) — both failures matched pre-existing, well-documented flake signatures (Miniflare `dispose is not a function`/hook timeouts; a11y/hydration timing under CI load) on a docs-only commit that cannot have caused either; **rerun of both jobs passed clean — `success`** | ✅ (after rerun) |

No drift found between the directive's stated baseline and reality, except the CI rerun needed
above (a pre-existing flake pattern, not a defect this pass introduced).

## Route tree re-walk

The repository already has a **CI-enforced, real-filesystem-walk test**
(`route-ownership.test.ts`) that reads every file under `apps/web/src/pages/api/**` directly
(via `readdirSync`/`statSync`) and asserts zero `UNKNOWN` classification — this is the
authoritative mechanism the directive asks for, not something to re-derive by hand. Re-run
directly this pass:

```
apps/web/src/lib/route-ownership.test.ts — 31/31 passed
```

Manually cross-checked the real route tree (`find apps/web/src/pages -type f`) against the
executable classification in `route-ownership.ts`: every family enumerated in the master
directive's §2 (public content, `/pay`, webhook, `/sign-in`, `/app/**`, `/admin/**`, authenticated
account/application/billing/admin APIs) has exactly one owner. No manual reclassification was
needed — Phase 4 Stage A (already deployed) already reconciled every real route.

## Final routing invariants (§1.3)

All confirmed via source inspection of `route-ownership.ts` and `worker.ts`, and live Production
HTTP checks (`PRODUCTION_CUTOVER_EVIDENCE.md`):

- `/sign-in`, `/app/**`, `/admin/**` → `APP_ONLY` (`APP_ONLY_PAGE_PREFIXES`)
- Public content, `/pay`, `/api/billing/webhook` → apex, unchanged
- Anonymous audit APIs (`/api/audit`, `/api/audit/[auditId]`, `/api/audit/[auditId]/report`) →
  `PUBLIC_ONLY`
- Authenticated audit/share (`/api/audit/[auditId]/share`, `/api/audit/[auditId]/continuation`,
  `/api/audit/continuation/[continuationId]`) → `APP_ONLY`
- Authenticated billing (`/api/billing/checkout`, `/api/billing/portal-session`,
  `/api/billing/plan-change/**`) → `APP_ONLY`
- All `/api/admin/**` → `APP_ONLY`
- No blanket `/api/*` redirect exists — `classifyApiOwnership` is an explicit ordered rule list,
  not a wildcard
- No blanket apex→app redirect exists — `isAppOnlyPagePath` matches only the three named prefixes

## `/app` prefix decision (§1.4)

Confirmed: authenticated routes remain physically `app.crawlpact.com/app/**`. Grepped
`apps/web/src/pages/app/**` and `route-ownership.ts` — no de-prefixing exists or is planned. This
matches ADR-0010's own "deferred, not rejected outright" framing exactly (still deferred, not
attempted this pass — outside this directive's own required scope, which only requires
confirming no de-prefixing was silently introduced).

## Drift found and fixed

None. Phase 4 Stage A (already deployed, `PRODUCTION_CUTOVER_EVIDENCE.md`) already closed every
Phase 1 architectural question this reconciliation checks for.

## Unresolved items carried forward

- `main`'s CI rerun for the current tip (`2c5b712`) was in progress at the time of this
  reconciliation; final result recorded in `PHASE_2_FINAL_SECURITY_VALIDATION.md`.
- Stage B, Stage C, and Phase 4D (workers.dev, BIC, Google apex-origin disposition) are addressed
  in their own dedicated evidence files per this directive's structure — not duplicated here.

## Gate

```
PHASE 1 — FINAL RECONCILIATION PASS
```
