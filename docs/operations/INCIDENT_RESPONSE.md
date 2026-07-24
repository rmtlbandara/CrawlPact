# Incident Response

No production deployment exists yet, so this is a rehearsed process built against real,
tested admin mechanisms — not a tested-in-production one. Update the History section with real
learnings the first time it is actually used. Updated Part 3 Step 20: added specific procedures
below, and corrected references to admin tooling that didn't exist when this was first written.

## Severity guide

| Severity | Example                                                                | Target response                      |
| -------- | ---------------------------------------------------------------------- | ------------------------------------ |
| Critical | Public site down; data-loss risk; SSRF containment bypassed            | Immediate; activate maintenance mode |
| High     | Scanner producing incorrect results at scale; billing webhook failures | Same business day                    |
| Medium   | Isolated scan failures; non-critical UI regression                     | Next working day                     |
| Low      | Cosmetic issue; documentation gap                                      | Normal backlog                       |

## First steps for any incident

1. Confirm scope: check `/status` (public) and `/admin/health` (Super Admin system/component
   health — `lib/admin/health.ts`'s `getSystemStatusSummary`/`getComponentHealth`, real as of
   Part 3 Step 7) for affected surfaces.
2. Check `/admin/jobs` and `/admin/security` (or raw `scheduled_job_runs`/`security_events` via
   `wrangler d1 execute`) for anomalies around the incident window.
3. If the cause is a bad deploy, redeploy the previous commit (see `docs/operations/RUNBOOK.md`).
4. If the cause is a bad migration, write a forward-fix migration — never edit an applied one.
5. If the cause is a bad registry/ruleset release, roll it back (see `RUNBOOK.md`).
6. For anything customer-facing and ongoing, consider activating maintenance mode (`RUNBOOK.md`)
   so the dashboard goes read-only while you work, without taking the public site down.
7. Record what happened, even briefly, in this file's "History" section below once it has
   entries.

## Compromised-session response

If a user reports account compromise, or `/admin/security` shows suspicious session activity for
an account:

1. `POST /api/admin/users/:userId/revoke-sessions` `{ "reason": "..." }` — immediately ends every
   active session for that user (`lib/admin/users.ts`'s `revokeAllSessionsForUser`).
2. If the account itself needs to be locked out (not just the current sessions — e.g. suspected
   credential/passkey compromise), `POST /api/admin/users/:userId/suspend` `{ "reason": "..." }`
   — sets the account to `suspended` (blocks login) and revokes all sessions in the same action
   (`suspendUser`). Reverse with `.../restore` once resolved.
3. Consider `POST /api/admin/users/:userId/revoke-shared-reports` and `.../revoke-feed-tokens` if
   the compromise may have exposed shared report links or the private Atom feed token.
4. Every one of these actions is itself written to `admin_audit_logs` automatically
   (`requireAdminAction`) — no separate logging step needed.

## Scanner-abuse response

If the scanner is being pointed at a target that's complaining, or a target is generating
unusually high failure/retry volume (`/admin/scans` → high-failure hosts, or
`getHighFailureHosts` in `lib/admin/domains.ts`):

1. `POST /api/admin/blocked-targets` `{ "targetPattern": "<hostname or pattern>", "reason": "..." }`
   (`lib/blocked-targets.ts`'s `blockTarget`). Takes effect on the **next** scan attempt against
   that host — it is checked by `packages/scanner/src/target-validation.ts`'s `validateTarget`
   before any request is made, not retroactively against an in-flight scan.
2. If the abuse is coming from a high-volume anonymous caller rather than one target, check
   `/admin/security` (`getHighVolumeAccounts`/`getFrequentlyScannedHosts` in
   `lib/admin/security.ts`) to identify the source; the per-IP daily anonymous-audit limit
   (`anonymous_audit_daily_limit` runtime config) already bounds this automatically, but a
   determined abuser distributing across many IPs isn't caught by that alone (see the
   distributed-abuse gap in `docs/status/KNOWN_RISKS.md`).
3. Reverse with `POST /api/admin/blocked-targets/:blockedTargetId/unblock` once resolved.

## Incorrect-finding response

If a customer reports a finding that appears wrong:

1. Reproduce: pull up the scan's full report (findings carry the exact matched rule, line
   number, and ruleset version they were evaluated against — see `AuditReportView.tsx`) and
   confirm whether the finding is actually correct given the site's declared policy at scan time.
2. If it's a genuine bug in the ruleset logic (`packages/policy/src/conflicts.ts`/`findings.ts`),
   fix it there, add a regression test reproducing the exact case, and publish a new ruleset
   version through the normal admin flow (`/admin/registry/rulesets`) — never hand-edit a
   published ruleset version or historical finding rows (both are immutable by design).
3. If it's a registry data problem (wrong purpose classification, stale token), correct the
   crawler record through `/admin/registry/crawlers` and publish a new registry release —
   `getAffectedDomains`/`scheduleReEvaluation` will queue a fresh scan for every domain the
   correction affects, so the fix shows up as a new, honestly-dated scan, not a silent rewrite of
   history.
4. There is no mechanism to edit or delete a specific finding or historical scan directly, by
   design (immutability) — the only path to "fix" a bad past result is a corrected registry/
   ruleset release plus a fresh scan.

## Data-deletion procedure

- **Customer self-service**: `POST /api/account/deletion` (requires recent re-auth) starts a
  cancellable grace period (`account_deletion_grace_period_days`, default 30); `DELETE
/api/account/deletion` cancels it. Neither immediately deletes anything — see
  `lib/account.ts`.
- **Admin-initiated** (e.g. a legal/GDPR request that needs to go faster than self-service, or a
  support case): `POST /api/admin/users/:userId/begin-deletion` /
  `.../cancel-deletion`, same underlying grace-period mechanism, both requiring reason + audit
  log.
- **Actual purge**: happens automatically once the grace period elapses, via the same daily cron
  as monitoring (`purgeDeletedAccounts` in `lib/data-retention.ts`) — a real cascade hard-delete
  (`ON DELETE CASCADE` per ADR-0002), not a soft-delete. There is no manual "purge now" override
  by design — the grace period exists specifically to prevent an accidental or coerced deletion
  from being unrecoverable, and bypassing it defeats that purpose.
- Billing records (`transactions`, `webhook_events`) are a disclosed exception — see
  `docs/data/DATA_RETENTION.md` and the corresponding entry in `docs/status/KNOWN_RISKS.md`.

## History

_No incidents recorded yet — nothing has been deployed to any live environment._
