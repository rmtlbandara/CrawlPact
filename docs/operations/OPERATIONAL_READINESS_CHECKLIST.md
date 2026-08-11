# Operational Readiness Checklist

**Level 2 document.** Phase 14 (§106). Verify each item before treating CrawlPact as ready for real
commercial customer use at scale. Each row states the real, current status — not aspirational.

| Area                 | Status                                                                                                                                            | Evidence                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Status page          | ✅ Real component state, no false-Operational fallback, bounded query cost (N+1 fixed)                                                            | `docs/operations/PHASE_14_STATUS_OPERATIONS_BASELINE.md`                                                 |
| Incident admin       | ✅ Full CRUD, audited, draft/public separation, sanitised input                                                                                   | `docs/architecture/INCIDENT_TRACKING_SYSTEM_DESIGN.md`                                                   |
| Health dashboard     | ✅ `/admin/health` + new `/admin/operations`                                                                                                      | `docs/operations/SERVICE_HEALTH_SIGNAL_MODEL.md`                                                         |
| Monitoring           | ✅ Phase 10 self-healing claim-lock model, now with real stuck/overlapping detection                                                              | `docs/operations/PHASE_10_MONITORING_RELIABILITY_RUNBOOK.md`                                             |
| Retention            | ⚠️ `product_events`/scans/accounts covered; `security_events`/`notifications` still unbounded (RISK-006, partially open)                          | `docs/data/PHASE_14_SECURITY_EVENT_RETENTION_DECISION.md`, `PHASE_14_NOTIFICATION_RETENTION_DECISION.md` |
| Billing              | ⚠️ Webhook/reconciliation reliable; RISK-001 (real paid checkout lifecycle) remains open                                                          | `docs/risks/ACTIVE_RISKS.md` RISK-001                                                                    |
| Authentication       | ✅ D1-backed, step-up for sensitive actions, revocation tooling exists                                                                            | `docs/operations/DISASTER_RECOVERY_RUNBOOK.md` "Authentication"                                          |
| Backup/recovery      | ⚠️ Time Travel capability re-verified live (preview bookmark retrieved); full restore-and-verify drill still not executed against a real database | `docs/operations/PHASE_14_RELIABILITY_GAME_DAY.md`                                                       |
| Rollback             | ✅ Redeploy previous known-good commit via the existing gated pipeline; no one-click automated rollback (deliberate)                              | `docs/operations/DISASTER_RECOVERY_RUNBOOK.md` "Deployment"                                              |
| Capacity             | ✅ Phase 11 capacity snapshot, now surfaced in a real UI (`/admin/operations`) for the first time                                                 | `docs/operations/CLOUDFLARE_UPGRADE_TRIGGERS.md`                                                         |
| Incident response    | ✅ Runbook rewritten to describe the real, current production system                                                                              | `docs/operations/INCIDENT_RESPONSE.md`                                                                   |
| Public communication | ✅ Standard defined                                                                                                                               | `docs/operations/PUBLIC_INCIDENT_COMMUNICATION_STANDARD.md`                                              |
| Support contacts     | ✅ Unchanged, already approved                                                                                                                    | `support@crawlpact.com`, `info@crawlpact.com`                                                            |

**Overall**: operationally ready for CrawlPact's current real scale. Two named, disclosed gaps
remain open by explicit decision, not oversight: RISK-001 (real paid checkout) and the
`security_events`/`notifications` retention decision (RISK-006, partial) — both require a
non-technical decision (a real payment; an explicit retention-period acceptance) outside this
phase's own scope to close.
