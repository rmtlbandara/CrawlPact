# Bulk Action Model

## Supported actions (§29's "permitted" list — implemented)

- Assign group
- Move group
- Remove from group
- Enable monitoring (where entitled)
- Disable monitoring
- Pause monitoring
- Resume monitoring
- Export selection (delegates to `CSV_EXPORT_WORKFLOW.md`'s `domainIds` scope — not a separate
  code path)

## Deferred (§29's "requires explicit decision" list — not implemented, each has its own decision

gate or is out of scope)

- Bulk rescan — `PHASE_09_BULK_RESCAN_DECISION.md` (not authorised)
- Bulk report-share creation — no SRS authorisation found for a bulk share primitive; individual
  share creation (`ShareReportDialog`) is unchanged
- Bulk deletion — irreversible, not requested by the prompt's permitted list, not implemented
- Bulk note replacement — not requested, not implemented
- Bulk policy-objective (preset) change — explicitly listed as needing its own decision; not
  implemented this phase (each domain's preset reflects that specific site's stated policy
  objective per Phase 8's own `PHASE_08_POLICY_OBJECTIVE_DECISION.md` — changing many at once
  in bulk risks exactly the kind of silent, unreviewed policy-objective drift that document argued
  against for a single domain)

## Endpoint

`POST /api/workspace/bulk-actions` — body: `{ action, domainIds: string[], groupId?,
idempotencyKey }`. One endpoint, one action enum, not one route per action — keeps authorisation,
idempotency, and per-domain-result shape identical across every action rather than risking drift
between N separate handlers.

## Execution model

1. **Server-side selection validation** — every `domainId` is re-checked against
   `owner_user_id = user.id AND deleted_at IS NULL`; any ID that fails this check is reported as
   `skipped: cross_account_or_not_found` in the per-domain result, never silently dropped and
   never causing the whole request to fail.
2. **Bounded batch size** — max 100 domain IDs per request (the Agency ceiling; there is no
   scenario where a legitimate selection could exceed it, so this is not an arbitrary new limit).
3. **Plan validation at execution time, not selection time** — re-reads `getPlan()` fresh inside
   the request (protects against the "race with plan downgrade" threat: a selection made while on
   Agency, submitted after a downgrade to Pro, is evaluated against the _current_ plan).
4. **Per-domain result, sequential** — each domain is processed and its outcome recorded
   independently (`succeeded | skipped | failed`, with a reason category); one domain's failure
   never aborts the rest of the batch (§29 "no hidden partial success").
5. **Idempotency** — `idempotencyKey` is checked the same way as CSV import's: a
   `bulk_action_jobs` row keyed on `(owner_user_id, idempotency_key)` unique constraint; a retried
   submission with the same key returns the stored result rather than re-executing.
6. **Confirmation (client-side, before the request fires)** — the UI shows: number of domains
   selected, the action, monitoring effect (if applicable), any domains that will be excluded
   (e.g. already in the target state, or plan-ineligible) computed from the _already-loaded_
   portfolio table data, and any irreversible consequence (only group removal/move has one, and
   it's not destructive to domain data — see `DOMAIN_GROUP_MODEL.md`).

## Monitoring bulk actions specifically (§30)

Reuses the exact same `updateDomain({ monitoringState })` path the single-domain toggle already
uses — no new monitoring-state machine, no new pause-reason taxonomy invented for this phase (see
`PORTFOLIO_ATTENTION_MODEL.md`'s note on the existing single-boolean `monitoring_state` model's
limits). "Enable monitoring" additionally checks `plan.monitoringFrequency != 'none'` before
attempting the toggle — a Free/Solo-without-monitoring domain is reported `skipped:
plan_no_monitoring`, never silently left showing "active" when it isn't scheduled. Because no
domain in this action ever gets a synchronous scan triggered by the toggle itself (monitoring
state only affects whether the _next_ scheduled sweep will pick it up), there is no capacity
concern from enabling monitoring on up to 100 domains in one bulk action — it changes a flag, not
a scan.

## Security

Every threat in §45's checklist (duplicate submission, replay, partial failure, race with plan
downgrade/domain deletion/group deletion/monitoring scan, quota bypass, client-controlled IDs,
cross-account selection, excessive batch size, no raw internal errors) is covered by the execution
model above and has a dedicated test in `PHASE_09_AGENCY_WORKSPACE_THREAT_REVIEW.md`.
