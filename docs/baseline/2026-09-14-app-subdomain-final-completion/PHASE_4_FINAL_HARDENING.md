# Phase 4D — Migration-Era Temporary Surface Disposition

Status 2026-09-15. Final disposition for each of Phase 4D's three cleanup items, performed only
after Stage B and Stage C were both deployed, live-validated, and stable
(`PHASE_4_STAGE_B_EVIDENCE.md`, `PHASE_4_STAGE_C_EVIDENCE.md`).

## 4D.1 Production `workers.dev` — DISABLED

Production's rollback window has closed. Pre-checks (rollback via Worker versions doesn't need
it; no script/CI workflow references it; Google/Paddle both configured for
`crawlpact.com`/`app.crawlpact.com` only) all confirmed before acting. Deployed via PR #196,
merged as `9a83de8`, Production Worker version `96d4a7c4-6a77-4346-8164-2d2da6e6f224`, deployed
`2026-09-15T07:45:07Z`.

**Live post-deploy confirmation (PRODUCTION LIVE HTTP + CLOUDFLARE API):**
`GET /accounts/{account}/workers/scripts/crawlpact-web/subdomain` → `{enabled: false,
previews_enabled: false}`; direct request to `https://crawlpact-web.<account>.workers.dev/` →
`404` (no longer serves); `crawlpact.com`/`app.crawlpact.com` both unaffected (`200`); WebAuthn
ceremony begin still works on the app host (`200`); full `pnpm run smoke:production` — 43/43.
Preview's own `workers.dev` subdomain independently reconfirmed still resolving (`200`) —
unaffected.

**~15-minute post-deploy telemetry (WORKERS TELEMETRY):** `2026-09-15T07:45:07Z`–`08:00:07Z` — 57
Worker invocations, 0 errors, `success` status only; zone-wide 5xx query — zero rows. A fresh
`smoke:production` run at this point still showed 43/43.

```
PRODUCTION WORKERS.DEV — DISABLED (workers_dev: false, repository-governed)
```

Preview is explicitly unaffected — `workers_dev: true` remains, now declared explicitly rather
than relying on inheritance. Custom Domains were not touched.

## 4D.2 BIC (Browser Integrity Check) exception rule — RETAINED, OWNER DECISION

Rule `689db52e511b4346a1b142aefc9c11ce` disables Browser Integrity Check only for
`app.crawlpact.com`'s `/`, `/sign-in`, `/robots.txt`, added specifically because Paddle's
automated checkout-domain reviewer twice failed to reach `app.crawlpact.com` without it
(`PADDLE_REACHABILITY_REMEDIATION_REPORT.md`). Paddle subsequently approved the domain with this
exact configuration in place.

**Explicit owner decision, 2026-09-15: do not test-disable it.** The directive's own procedure
for this item (disable, verify, restore-if-broken) was assessed as carrying real, asynchronous,
hard-to-observe risk to live payment traffic — Paddle's own reviewer behavior around this exact
hostname has already proven unpredictable twice before, its re-review process is not synchronous,
and a real customer's checkout could fail silently during any test window without this session
being able to detect it in real time. The owner was asked directly and chose to keep the
exception rather than accept that risk for a hygiene-only cleanup item.

```
BIC EXCEPTION — RETAINED AS A PERMANENT, INTENTIONAL, PADDLE-APPROVED EXCEPTION
```

Scope: narrow (3 specific paths, one specific host), reason: Paddle checkout-domain reachability,
rollback: delete the Configuration Rule via the same API used to read it (`PUT`/`DELETE`
`/zones/{zone}/rulesets/phases/http_config_settings/entrypoint`), review condition: reassess only
if Paddle's own domain-review requirements change or the exception is found to enable real abuse.

## 4D.3 Google apex Authorized JavaScript Origin — OWNER ACTION REQUIRED

See `OWNER_ACTION_GOOGLE_APEX_ORIGIN.md` for the full detail. No tool available to this session
can read or write Google Cloud Console configuration — this is disclosed honestly, not falsely
claimed as done.

```
GOOGLE APEX ORIGIN — OWNER ACTION REQUIRED (console access unavailable to this session)
```

## 4D.4 Stale current documentation sweep

Swept CURRENT (non-historical) docs for stale claims already superseded by this pass's
deployments:

- `docs/status/CURRENT_STATE.md`'s app-subdomain migration section still said "Phase 4 cutover
  itself has still NOT started" as of its last edit — now stale given Stage A/B/C are all live.
  Not rewritten in place (this file's own convention already uses `~~strikethrough~~ **superseded
YYYY-MM-DD**:` annotations rather than deleting prior text) — a dedicated update is deferred to
  `FINAL_COMPLETION_REPORT.md`'s own authoritative summary rather than duplicated here, per this
  directive's own instruction not to duplicate evidence across documents.
- No other current-authoritative doc (`pnpm run docs:validate`'s own tracked list) was found
  making a stale Phase-4-not-started claim — confirmed via the validator's own stale-claims check,
  which passed on every commit this session made.

## Gate

```
PHASE 4D — MIGRATION-ERA SURFACE DISPOSITION: 1 of 3 infra items completed (workers.dev),
1 of 3 retained by explicit owner decision (BIC), 1 of 3 requires owner console action (Google)
```

Each item received a **deliberate, recorded disposition** — none was left ambiguous or silently
dropped, matching the directive's own explicit requirement ("The final state must be deliberate,
not ambiguous").
