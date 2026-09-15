# Phase 3 — Final Production Readiness

Status 2026-09-14. Evidence class marked per claim.

## 3.1 Production smoke propagation hardening

**Required first change before further Production deployment, per the Master Finalization
Directive.** A real Stage-A deployment (run `34835290020`) proved `deploy-production.yml`'s smoke
step can observe stale pre-deploy Worker behavior for a few seconds immediately after `wrangler
deploy` returns — ordinary Cloudflare edge-propagation lag, not a routing defect (independently
confirmed: an identical smoke re-run ~18 minutes later, no redeploy in between, passed 43/43).

Fixed with `scripts/smoke-retry.sh` — a bounded, propagation-aware retry wrapper (3 attempts
default, short initial delay + backoff, every attempt logged, never redeploys, persistent failure
still fails the workflow). `deploy-production.yml`'s smoke step now runs `pnpm run
smoke:production` through this wrapper. Regression tests execute the real script against fixture
commands (immediate success, retry-then-success, bounded exhaustion, configurable bound,
per-attempt logging, no hidden deploy call) plus a full re-confirmation that every pre-existing
Production safety guard is unchanged (`workflow_dispatch`-only, typed confirmation + exact SHA,
exact-main membership, exact-commit CI check, non-cancelling concurrency, single deploy step,
unconditional evidence upload).

PR #192, narrow infrastructure-only change (GITHUB ACTIONS + AUTOMATED TEST evidence). CI showed
one transient failure on rerun-check (wholesale Miniflare `dispose is not a function`/hook-timeout
signature across ~15 unrelated integration test files — registry, pilot, research — none touching
this change); rerun of the affected job passed clean. Merged as `3b37d4897fcd21845c678f5acb404b9f18155e12`.
`main` CI on that exact SHA: **success** (run `34862757850`). Post-merge Preview auto-deploy:
**success**.

```
PRODUCTION SMOKE PROPAGATION HARDENING — PASS
```

## 3.2 Preview two-origin topology (PREVIEW LIVE HTTP)

Re-checked directly this pass:

| Host                                 | Status | `robots.txt`  |
| ------------------------------------ | ------ | ------------- |
| `https://preview.crawlpact.com/`     | 200    | `Disallow: /` |
| `https://app.preview.crawlpact.com/` | 200    | `Disallow: /` |

Both resolve, both remain fully disallowed/noindex. Both point to the Preview Worker
(`crawlpact-web-preview`) per `wrangler.jsonc`'s `env.preview` block — no change since Phase 4
Stage A's own topology work. Preview D1/KV/R2 remain distinct from Production (unchanged
`env.preview` bindings). Preview never uses Production Paddle credentials (`AUDIT_ENGINE_ENABLED
=false`, sandbox Paddle values per `wrangler.jsonc`).

## 3.3 Observability (SOURCE INSPECTION)

`wrangler.jsonc`: Production declares a top-level `observability: {enabled: true,
head_sampling_rate: 1}`; Preview declares the equivalent under `env.preview`. Both were
independently verified live in prior sessions (Cloudflare Workers Logs receiving telemetry,
automatic redaction of high-entropy path-embedded values confirmed against a real deployed
Worker). Not re-probed with a fresh live token this pass (no new redaction-relevant code changed);
relying on the previously-established, separately-confirmed platform guarantee, consistent with
`OBSERVABILITY_EVIDENCE.md`'s own honest disclosure of the same limitation (no authenticated raw
Workers Logs/tail tool available in this non-interactive session).

## 3.4 Production readiness snapshot (CLOUDFLARE API + SOURCE INSPECTION)

| Item                      | Value                                                                                                                                                                                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production Worker version | `4078cdd9-2639-4421-ae68-af8174d03b69` (live at 100%)                                                                                                                                                                                                                                                   |
| Preview Worker version    | not re-queried this pass (unchanged since last Preview deploy; Preview topology re-confirmed live above)                                                                                                                                                                                                |
| `main` SHA                | `3b37d4897fcd21845c678f5acb404b9f18155e12` (post PR #192 merge)                                                                                                                                                                                                                                         |
| Stage-A redirect status   | `307` (`LEGACY_REDIRECT_STATUS` in `legacy-redirect.ts`)                                                                                                                                                                                                                                                |
| BIC rule                  | `689db52e511b4346a1b142aefc9c11ce` — confirmed live via Cloudflare API (`http_config_settings` ruleset): disables Browser Integrity Check only for `app.crawlpact.com`'s `/`, `/sign-in`, `/robots.txt`; enabled, unchanged since 2026-09-10                                                            |
| `workers.dev` status      | confirmed live via Cloudflare API (`GET .../subdomain`): `{enabled: true, previews_enabled: true}` — still in its temporary rollback-window state                                                                                                                                                       |
| Google/Paddle state       | Paddle checkout-domain approval for `app.crawlpact.com` previously confirmed via the Paddle API (`approved`); Google Authorized JavaScript Origins remain unverifiable by any tool available to this session (no Google Cloud Console access) — carried forward as an open OWNER ACTION, not fabricated |
| Rollback target           | Worker version `d77ae4e`'s predecessor is `886fb70e-d760-4f3b-87b1-4a71820074ff` (version 85, `2026-09-14T02:14:11Z`) — the last known-good pre-Stage-A version, confirmed via the Cloudflare versions API                                                                                              |

## Gate

```
PHASE 3 — FINAL PRODUCTION READINESS PASS
```

PR #192 merged (`3b37d489`), `main` CI green on that exact SHA, post-merge Preview auto-deploy
succeeded. Stage B is now eligible to begin.
