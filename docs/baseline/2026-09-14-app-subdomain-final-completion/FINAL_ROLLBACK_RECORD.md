# Final Rollback Record

Status 2026-09-15. Every Production Worker version deployed this pass, in order, with its
rollback target. Evidence class: CLOUDFLARE API.

| Step                                                            | Deployed version                       | Commit    | Deployed             | Rollback target (immediately prior version) |
| --------------------------------------------------------------- | -------------------------------------- | --------- | -------------------- | ------------------------------------------- |
| Pre-Stage-A baseline                                            | `886fb70e-d760-4f3b-87b1-4a71820074ff` | `e75c0d8` | 2026-09-14T02:14:11Z | — (baseline)                                |
| Stage A                                                         | `4078cdd9-2639-4421-ae68-af8174d03b69` | `d77ae4e` | 2026-09-14T10:59:45Z | `886fb70e-...`                              |
| Stage B                                                         | `226f5ce7-d5e8-4856-9c18-6d43d2264e0f` | `58da28e` | 2026-09-15T02:50:06Z | `4078cdd9-...`                              |
| Stage C                                                         | `bec609e0-afbe-4c16-90b9-b70e21ef9c60` | `d8475d4` | 2026-09-15T04:48:56Z | `226f5ce7-...`                              |
| Phase 4D (`workers.dev` disable + `WEBAUTHN_RP_ORIGIN` removal) | `96d4a7c4-6a77-4346-8164-2d2da6e6f224` | `9a83de8` | 2026-09-15T07:45:07Z | `bec609e0-...`                              |

## Rollback procedure (unchanged throughout this pass)

Cloudflare Worker version rollback (`wrangler rollback <version-id>` or the equivalent
Cloudflare API deployment call) is sufficient for any purely code-level defect at any of the
steps above — there is only ever one Worker (`crawlpact-web`), and every step's D1/KV/R2
resources are shared, unmigrated infrastructure (no schema change occurred in any step this
pass). Rolling back does not require `workers.dev` (confirmed as a Phase 4D.1 pre-check) and is
independent of the Custom Domain routes, which are untouched by any rollback.

## Rollback principles reconfirmed unchanged (ADR-0010)

- `WEBAUTHN_RP_ID` never changed at any point in this pass, including hypothetically rolling back
  Stage C — confirmed `crawlpact.com` in every stage's live-validation evidence.
- Stage B's redirect status (`308`) can be reverted to `307` (or the redirect disabled entirely)
  by the same single-constant flip that introduced it (`LEGACY_REDIRECT_STATUS` in
  `legacy-redirect.ts`) — no database migration involved either way.
- Stage C's ceremony-origin narrowing can be reverted by restoring `isTrustedOrigin` as the
  ceremony-origin check in `webauthn.ts` — a source-level revert, not a config flag, since the
  narrower rule was intentionally implemented as new logic rather than a toggle (matching the
  directive's own instruction not to leave the RP-ID-narrowing path itself flag-gated).
- No Production deployment in this pass introduced a D1 migration — reconfirmed via each
  deployment workflow's own "Apply pending migrations to production D1" step output showing no
  new migration applied beyond what already existed pre-pass.

## Hard rollback triggers — none fired this pass

None of the master directive's listed hard rollback triggers (material 5xx increase, Worker
exception spike, broken public homepage/sign-in, redirect loop, incorrect permanent redirect,
`/app` prefix loss, wrong-host API exposure, session/CSRF/passkey/Google regression, continuation
failure, pricing→billing failure, Paddle/webhook regression, app becoming indexable, GA4/Clarity
on app, Static Assets bypass, secret/token telemetry exposure) were observed at any stage —
see each stage's own evidence file for the specific telemetry/live-check proof. No rollback was
performed or required.
