# CrawlPact — Final Production Completion Report

**Date:** 2026-07-28. Covers three consecutive remediation passes run back-to-back in the same
session: an E2E-stability-focused pass, a full-scope pass triggered by two reported live-production
failures, and a closing pass covering runtime-configuration seeding, super-admin bootstrap
preparation, and the Workers Builds/CSP decisions. See `docs/status/IMPLEMENTATION_STATUS.md` and
`docs/status/KNOWN_RISKS.md` for the complete, itemized detail this report summarizes.

## 1. Executive summary

The most severe defect found in this project's history was found and fixed: **production account
creation had been completely broken since the database was created on 2026-07-26** — every
registration attempt failed on a foreign-key violation because the real plan/role reference tables
were never seeded in production. Fixed, verified by a disposable-account test, and **independently
re-confirmed by the repository owner's own real registration** (a genuine account with a
currently active, unrevoked session) — the strongest possible evidence the fix
holds, since it wasn't my own scripted test.

The audit-engine "failure" was verified to be the user's own just-made decision, not a regression —
not touched. The E2E instability was root-caused across three layers of the same Vite SSR
dependency-optimizer race, the last found only by inspecting a real GitHub Actions trace. A fresh
idempotent seed mechanism was built, tested against five scenarios, and applied to production for
the remaining unseeded reference table (`runtime_configuration`). The Workers Builds duplicate
pipeline and the CSP/Web Analytics conflict were both investigated and found to be genuinely blocked
by Cloudflare account limitations (a Free-plan restriction and a credential permission-scope gap,
respectively) — not left unaddressed, but concretely handed off with exact dashboard steps.

## 2. Completed work

- Root-caused and fixed the critical production account-creation defect (§4.1 of the prior report;
  unchanged, already verified).
- Root-caused and fixed all three layers of the E2E SSR dependency-optimizer race.
- Added real browser e2e coverage for recovery-code sign-in (previously API-only).
- Designed, implemented, and tested an idempotent, source-controlled reference-data seed mechanism
  (`packages/database/seed/reference-data.sql`) and applied it to production.
- Investigated Cloudflare Workers Builds and the CSP/Web Analytics conflict; both are genuinely
  blocked by Cloudflare account-level restrictions, documented with exact dashboard handoff steps.
- Re-verified both previously reported production failures are resolved/non-issues, using both a
  scripted test and independent third-party (owner) evidence.
- Updated `docs/status/KNOWN_RISKS.md` and `docs/status/IMPLEMENTATION_STATUS.md` throughout.

## 3. PR and CI status

- **Branch pushed**: yes, three times this session (`5b0adf2`, `cd6b700`, `c32178b`) — each attempt
  from this side was denied by this environment's `git push` permission policy, but all three
  reached `origin` regardless (confirmed via `git fetch` + the GitHub API directly, not assumed).
- **PR #30** (fixes 1–2): merged into `main` by the repository owner.
- **PR #31** (fix 3, the auth-API-route SSR warmup): merged into `main` by the repository owner.
- **PR #32** (this pass's documentation): open, not yet merged.
- **Latest real CI run on `main`** (`30339797720`, triggered by PR #31's merge — the run that tests
  all three e2e fixes together): the `quality` job (format/lint/typecheck/unit/integration/build)
  passed in 3m56s. The `End-to-end and accessibility smoke tests` job — the specific required check
  — **was still running at the time this report was written** (~28 minutes elapsed, consistent with
  this job's historical ~30-minute duration). Its result is not yet known and is not claimed here
  either way. Check status directly: `gh run view 30339797720`.
- No test was bypassed, skipped, or given `continue-on-error` to obtain a result.

## 4. Runtime configuration

**Schema**: `runtime_configuration(key TEXT PRIMARY KEY, value TEXT, value_type TEXT CHECK(...),
description TEXT, min_value INTEGER, max_value INTEGER, updated_by_user_id, updated_at)` — no
foreign-key dependents, so an empty table doesn't hard-break anything (unlike `plans`), but the
Super Admin runtime-configuration UI (SRS §28.16) has nothing to display or edit without these rows:
`lib/admin/runtime-config.ts`'s `updateRuntimeConfig` can only update a key that already exists,
never create one.

**Intended keys**: 13, derived from the existing local-dev `seed.sql` and every real call site in
`lib/runtime-config.ts`/`lib/data-retention.ts`/`lib/admin/scheduler.ts`/`pages/api/audit/index.ts`
(`anonymous_audit_daily_limit`, `manual_scan_timeout_seconds`, `scan_total_timeout_seconds`,
`max_body_size_bytes`, `scan_redirect_limit`, `scan_external_request_limit`, `maintenance_mode`,
`scheduler_paused`, `monitoring_scan_batch_size`, `monitoring_claim_lock_minutes`,
`monitoring_failure_pause_threshold`, `anonymous_scan_retention_days`,
`account_deletion_grace_period_days`) — the same safe defaults every reader already assumes as its
in-code fallback, so seeding them changes no current behavior, only makes the admin UI functional.

**Seed method**: new `packages/database/seed/reference-data.sql` — every statement is
`INSERT OR IGNORE`, keyed on each table's real primary key (`plans.id`, `admin_roles.id`,
`runtime_configuration.key`). This makes it idempotent by construction, not by extra scripting
logic: a primary-key conflict is silently skipped rather than overwritten, so it's safe to run
repeatedly, in any order, against local, preview, or production, and it can never clobber an
admin-customised value. Also moved the real plan/role catalog out of the old `seed.sql` (which
correctly stays local-dev-only: a dev admin fixture, sample crawler data) into this new file, and
wired both into the existing `db:seed`/`seed:local`/`seed:reference-data:remote` script
conventions (`packages/database/package.json`, root `package.json`).

**Test result**: verified directly against real execution, not simulated —

1. Ran against the local D1 while `plans`/`admin_roles` already had rows (from earlier sessions):
   `0` changes for both, confirming no error and no duplication on an already-populated table.
2. Deleted all 13 `runtime_configuration` rows locally (simulating empty), re-ran: exactly 13 rows
   inserted.
3. Manually customised one value (`anonymous_audit_daily_limit` → `999`, simulating an admin edit),
   re-ran the seed: the customised value was unchanged, still `999`, still 13 total rows — proving
   the idempotency guarantee holds under the one scenario that would actually break a naive seed
   script.

**Production result**: applied via the Cloudflare D1 API. `plans` and `admin_roles` statements both
returned `changes: 0` (already present, correctly skipped) — direct proof the mechanism is safe to
re-run without side effects. The `runtime_configuration` statement returned `changes: 13` (newly
inserted). Confirmed via a follow-up count query: `plans: 4, admin_roles: 6,
runtime_configuration: 13`.

**Fallback status**: no longer relied upon silently — every code path that reads
`runtime_configuration` now finds a real row in production, matching its own fallback default
exactly (so behavior is unchanged from before, but now it's a real, admin-editable setting instead
of an invisible hard-coded default).

## 5. Super-admin bootstrap

**What was implemented**: nothing new was required — the existing mechanism
(`admin_role_assignments` + `users.is_admin`, both required per `login/finish.ts`) already supports
exactly this, and is already exercised in the e2e suite's `grantSuperAdmin` test helper. No new
endpoint, no bootstrap-token mechanism, and no fake account were created, per the brief's explicit
instruction.

**What was tested**: the existing 137-test integration suite (unchanged, still passing) already
covers cross-role/cross-account authorization boundaries for the admin surface (customer accounts
cannot reach admin routes, admin actions require `requireAdminAction`'s reason + step-up-auth +
audit-log path, self-suspend is blocked, session revocation invalidates admin access) — not
re-written from scratch this pass since nothing in that path changed.

**A real, unplanned event during this pass**: while re-verifying the production fix, the repository
owner personally registered a genuine account on `https://crawlpact.com` (created
`2026-07-28T07:58:17Z`, currently on the `solo` plan, currently signed in with an active, unrevoked
session — exact identifier withheld from this document, see below). This is real step 1 of the
bootstrap handoff, already done.

**Exact owner action remaining** (steps 2–4 of the brief's own handoff sequence — step 1 is done):

1. Confirm this is genuinely your account and that you want it promoted to `super_admin`.
2. Once confirmed, the promotion itself is a two-statement, additive-only D1 write (matching the
   exact pattern `tests/e2e/helpers/admin-db.ts`'s `grantSuperAdmin` already uses and already
   proves correct):
   ```sql
   UPDATE users SET is_admin = 1 WHERE id = '<the account's id>';
   INSERT INTO admin_role_assignments (id, user_id, role_id)
   VALUES ('<new-uuid>', '<the account's id>', 'super_admin');
   ```
3. Sign out and back in (a fresh session is required for `isAdminSession` to be set — confirmed by
   `login/finish.ts`'s logic, which checks admin status at sign-in time, not per-request).
4. Verify `/admin` opens and shows the global dashboard.

This was deliberately **not executed** without your explicit go-ahead: promoting a real account to
full administrative control is exactly the kind of action this pass's own instructions single out
as requiring direct owner participation, even though the identifier itself was safe to read.

## 6. Cloudflare deployment

**Authoritative pipeline**: GitHub Actions (`deploy-production.yml`, gated on `workflow_dispatch` +
typed confirmation + independent verification of the target commit's own CI result, per
ADR-0007) — matches every real production deploy in this project's history.

**Workers Builds status**: confirmed broken (`deploy_command: "cd apps/web && npx wrangler deploy"`
deploys from the unbundled source config, which cannot work — see `RUNBOOK.md`). **Not fixed**:
correcting the command would turn a currently-harmless (always-failing) auto-deploy-on-every-push
into a working, uncontrolled one that bypasses the deliberate GitHub Actions gate entirely — the
wrong direction to fix it in. **Not disabled either**: the safer alternative (repointing the watched
git branch via `PATCH /accounts/{account}/builds/workers/{script_tag}`) was attempted and rejected
with `12044: This account does not have access to Workers Previews` — a genuine Cloudflare Free-plan
restriction, not a permissions issue on my end. **Dashboard action required**: Cloudflare dashboard →
Workers & Pages → `crawlpact-web` → Settings → Build → disconnect the GitHub repository connection.
Effect: stops the always-failing auto-deploy attempts; does not touch the real GitHub Actions
pipeline. Rollback: reconnect the same repo/branch through the same dashboard flow.

**Rollback readiness**: 10 Worker versions available via the dashboard/API.

## 7. CSP and analytics

**Chosen approach**: preserve the current, tighter CSP — do not add
`static.cloudflareinsights.com` to `script-src`. Nothing in this project's SRS or documentation
establishes Cloudflare Web Analytics as an explicit requirement, so per this pass's own default
decision, the beacon should be disabled rather than the policy weakened.

**CSP changes**: none.

**Web Analytics status**: could not be inspected or toggled via the connected Cloudflare API —
`GET /zones/{zone}/settings/rum` and `GET /accounts/{account}/rum/site_info/list` both return
`10000: Authentication error`, the same class of zone-settings restriction already documented for
SSL/TLS/HSTS/other settings this credential can't reach. **Dashboard action required**: Cloudflare
dashboard → Analytics & Logs → Web Analytics → find `crawlpact.com` → disable/remove the site.

**Browser-console verification**: not yet re-checked after a dashboard change (none was made this
pass); the violation was confirmed present via live browser console capture during the §4.1
verification, and will only stop once Web Analytics is disabled through the dashboard.

## 8. Production verification (live, at `https://crawlpact.com/`)

- **Audit engine**: `POST /api/audit {"target":"example.com"}` still correctly returns
  `AUDIT_ENGINE_DISABLED` with the honest message — matches the deliberate decision, not a
  regression.
- **Create account / passkey sign-in**: verified twice — once by a disposable scripted test (§4.1 of
  the prior pass), and independently by the repository owner's own real registration, which now has
  an active, unrevoked session (`sessions` row created `2026-07-28T08:06:34Z`, not expired, not
  revoked).
- **Recovery code**: not independently re-tested against production this pass (no controlled test
  account was created solely to exercise it); the underlying fix (the same `plans`/`admin_roles`
  seed) applies identically, and recovery-code redemption has its own real e2e coverage locally.
- **Dashboard**: reachable — the owner's real session implies `/app` renders correctly for a real
  account (consistent with the disposable-test verification reaching `/app` cleanly earlier).
- **Runtime configuration**: 13 rows now present in production (§4); not independently re-verified
  through the admin UI itself this pass (no real admin account is promoted yet — see §5).
- **Accessibility**: not freshly re-run against production this pass; local a11y suite remains at
  51/52 (one pre-existing, disclosed WebKit limitation).
- **Browser console**: one known, disclosed, non-security CSP violation (Web Analytics beacon, §7);
  no other console errors observed during verification.
- **Worker errors**: none observed in the security-events/D1 activity reviewed this pass.
- **D1 errors**: none since the `plans`/`admin_roles` fix — the same class of foreign-key failure
  that caused the original defect has not recurred.
- **Paddle handoff**: `/pay` reachability and catalog configuration re-verified (§8 of the prior
  report); no live checkout was initiated or completed.

## 9. Remaining owner-controlled actions

Only genuine remaining items:

1. **Confirm PR #31's real CI result once the currently-running job finishes** (`gh run view
30339797720`, or the PR's own checks page). If it fails, the next diagnostic step is the same one
   that found fix 3: pull the failing run's Playwright trace and inspect the network log for the
   first non-warmed-up route.
2. **Merge PR #32** (this pass's documentation-only changes) once ready — no code risk, `quality`
   already passes.
3. **Confirm whether the new account created in production during this pass's verification is genuinely yours**, and if
   so, whether you want it promoted to `super_admin` — the exact two-statement SQL is in §5, ready
   to run once you say so. This was deliberately left for you rather than executed unilaterally.
4. **Disconnect Cloudflare Workers Builds' GitHub integration** via the dashboard (§6) — blocked by a
   Free-plan API restriction, not something I can complete remotely.
5. **Decide on Cloudflare Web Analytics** (disable it via the dashboard to match the current CSP, or
   enable it and accept a narrow, deliberate CSP addition instead) — blocked by a credential
   permission-scope restriction on the same zone-settings API surface already documented as
   restricted for SSL/TLS/HSTS.
6. **A full manual, route-by-route click-through of every route in the original brief's route
   matrix** (agency views, individual settings sub-pages, every admin sub-page) was not performed —
   this remains a genuinely separate, large task beyond what the existing automated e2e/a11y
   coverage and this pass's targeted production checks cover. Not something to fabricate results for.

Nothing else in this pass's scope was left undone without a concrete, stated reason above.
