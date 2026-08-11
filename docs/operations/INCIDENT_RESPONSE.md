# Incident Response

**Rewritten Phase 14 (2026-08-10)** to describe the actual current production system — CrawlPact
has been live in production at `https://crawlpact.com` since 2026-07-26, with real customer-facing
Paddle billing, real anonymous audits, and real scheduled monitoring. Earlier revisions of this
document incorrectly claimed that no production deployment or live environment existed at all —
false as of this rewrite; `pnpm operations:validate` now checks for that specific class of
staleness going forward. Update the History section with real learnings the first time this
process is actually used against a real incident.

## Incident lifecycle

```
detected → investigating → identified → monitoring → resolved → post-incident review
```

`detected` is an internal-only state (an administrator or an operational alert noticing something,
before it's confirmed as a real incident) — it has no representation in the `incidents` table's own
`status` column, which starts at `investigating` the moment a real incident record is created. The
four stored states (`investigating`, `identified`, `monitoring`, `resolved`) match the existing
`incidents`/`incident_updates` schema exactly (`packages/database/migrations/0018_incidents.sql`) —
unchanged this phase. `post-incident review` happens after `resolved`, using
`docs/operations/POST_INCIDENT_REVIEW_TEMPLATE.md`, and is not itself a stored incident state.

## Severity matrix (internal — see `docs/operations/PUBLIC_INCIDENT_COMMUNICATION_STANDARD.md` for how this maps to public incident severity)

| Severity             | Examples                                                                                                                                                                                                  | Target response                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **SEV-1 / Critical** | Broad production unavailable; confirmed data-loss risk; security containment event (SSRF bypass, compromised admin account); incorrect crawler-policy results at broad scale; billing corruption at scale | Immediate; activate maintenance mode if customer-facing mutation needs to stop |
| **SEV-2 / High**     | Major customer workflow degraded; monitoring cadence broadly failing; billing webhook processing failing; authentication broadly failing                                                                  | Same business day                                                              |
| **SEV-3 / Medium**   | Partial, isolated degradation; a limited platform error; one operational subsystem impaired (e.g. notification reconciliation backlog, not monitoring itself)                                             | Next working day                                                               |
| **SEV-4 / Low**      | Cosmetic issue; an internal warning with no customer impact; documentation gap                                                                                                                            | Normal backlog                                                                 |

This internal matrix is distinct from the public incident `severity` column (`minor`/`major`/
`critical`) — map carefully when publishing (a SEV-2 internal issue might be `major` publicly, or
might have zero public component if it has no `publicImpact`; see
`docs/operations/PUBLIC_INTERNAL_STATUS_BOUNDARY.md`).

## First 15 minutes

1. **Confirm the issue** — is this real, and still happening?
2. **Determine public impact** — check `/status` (what customers currently see).
3. **Check `/admin/operations`** (Phase 14 — the unified operations view: public/internal status,
   active operational alerts, scheduler anomalies, capacity) or `/admin/health` for the
   per-component breakdown.
4. **Check the latest deployment** — GitHub Actions' `deploy-production.yml` run history (commit
   SHA, Worker version, migration count are not obtainable from inside the Worker itself — see
   `docs/operations/PHASE_14_STATUS_OPERATIONS_BASELINE.md`).
5. **Check Worker errors** — Cloudflare dashboard (not obtainable from inside the app).
6. **Check D1** — `/admin/operations`'s capacity section, or `wrangler d1 execute` directly.
7. **Check the scheduler** — `/admin/jobs`, `/admin/operations`'s scheduler-anomalies section.
8. **Check scans** — `/admin/scans`, `capacity.monitoring.*` in `/admin/operations`.
9. **Check webhooks** — `/admin/webhooks`.
10. **Check authentication** — `/admin/security`.
11. **Identify blast radius** — which public component(s), how many customers.
12. **Decide severity** — using the matrix above.
13. **Decide whether a public incident is warranted** — real customer impact required (never
    auto-published from a single failed health check).
14. **Decide whether to activate maintenance mode** — see
    `docs/operations/MAINTENANCE_MODE_DECISION_MATRIX.md` for what remains available.
15. **Begin the timeline** — detection time, first entry, in preparation for
    `docs/operations/POST_INCIDENT_REVIEW_TEMPLATE.md` if this becomes SEV-1/2.

## Ongoing response

- If the cause is a bad deploy, redeploy the previous commit (see `docs/operations/RUNBOOK.md`).
- If the cause is a bad migration, write a forward-fix migration — never edit an applied one.
- If the cause is a bad registry/ruleset release, roll it back (see `RUNBOOK.md`).
- For anything customer-facing and ongoing, consider activating maintenance mode (`RUNBOOK.md`) so
  the dashboard goes read-only while you work, without taking the public site down.
- Post public updates per `docs/operations/PUBLIC_INCIDENT_COMMUNICATION_STANDARD.md`.
- Record what happened, even briefly, in this file's "History" section below once it has entries.
- For SEV-1/SEV-2, complete `docs/operations/POST_INCIDENT_REVIEW_TEMPLATE.md` after resolution.

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

No real production incident requiring this runbook has occurred yet as of this rewrite
(2026-08-10) — production has been live since 2026-07-26 with no SEV-1/SEV-2 event recorded in
`docs/risks/RISK_ARCHIVE.md` or `docs/reports/`. This is a factual absence-of-incidents statement,
distinct from the earlier, incorrect "nothing has been deployed" framing this rewrite replaces.
Add a real entry, linking its post-incident review, the first time this runbook is actually used.
