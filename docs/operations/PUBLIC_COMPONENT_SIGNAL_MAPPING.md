# Public Component Signal Mapping

**Level 2 document.** Phase 14. For each of the 7 canonical public components, the internal
evidence that actually backs it today. Reviewed this phase; **not expanded** — every component
without a mapped signal was deliberately left unmapped because no existing metric can actually
detect user impact for it (the Phase 14 prompt's own rule: "do not create a component signal based
on a metric that cannot actually detect user impact").

| Public component       | Label                       | Internal signal today                                                              | Public-impact gate                                                                                                                                                                                                                             |
| ---------------------- | --------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `website`              | Website and public pages    | None — no synthetic homepage check exists (evaluated, not built; see below)        | N/A                                                                                                                                                                                                                                            |
| `audit_scanner`        | Audit and scanner           | None — no scanner canary exists (evaluated, not built; see below)                  | N/A                                                                                                                                                                                                                                            |
| `accounts_passkeys`    | Accounts and passkeys       | "Authentication" (`security_events`, `auth_failure`, last 1h)                      | `authFailureCount > 50`                                                                                                                                                                                                                        |
| `dashboard_domains`    | Dashboard and saved domains | None — implicitly covered by D1 reachability, no dedicated signal                  | N/A                                                                                                                                                                                                                                            |
| `scheduled_monitoring` | Scheduled monitoring        | "Scheduler / monitoring sweep" (last `monitoring_sweep` job status)                | Always `false` for the last-run signal (delays the next report, not current access) — real backlog escalation goes through the Phase 14 operational-alert path instead, which stays internal-only by design (see `OPERATIONAL_ALERT_MODEL.md`) |
| `reports_sharing`      | Reports and sharing         | None — no dedicated signal (see `SERVICE_HEALTH_SIGNAL_MODEL.md` "Reports")        | N/A                                                                                                                                                                                                                                            |
| `billing_checkout`     | Billing and checkout        | "Paddle webhook processing" (`webhook_events`, failed/permanently_failed, last 1h) | `webhookFailureCount >= 3`                                                                                                                                                                                                                     |

## Why `website` and `audit_scanner` have no signal yet

Both were evaluated for a small first-party synthetic check (§13-15 of the Phase 14 prompt:
homepage GET, a controlled scanner canary against a CrawlPact-owned fixture) and deliberately not
built this phase:

- **Homepage GET**: `scripts/smoke-test.ts` already performs this exact check post-deploy
  (`Home page: HTTP 200`), but it runs from GitHub Actions, not from inside the Worker on a
  schedule — adding a scheduled in-Worker synthetic homepage check would be a second, competing
  mechanism doing almost the same thing `smoke-test.ts` already does, for a route that has never
  once been observed down in production. Not implemented; revisit if `website`'s status is ever
  genuinely ambiguous during a real incident.
- **Scanner canary**: would require a controlled, deterministic CrawlPact-owned fixture (own
  `robots.txt`/headers/sitemap — the Phase 14 prompt's own §14 requirement) that does not exist
  yet. `apps/web/tests/integration` already has a real controlled fixture domain
  (`e2e-fixture.crawlpact.com`, used by `persist-scan-benchmark.integration.test.ts`) that could
  become this canary in a future phase, but wiring it into a scheduled in-Worker check — with its
  own timeout/frequency/quota-isolation requirements (§15) — is a real, separately-scoped piece of
  work, not a small addition. Not implemented this phase.

Both remain implicitly covered: a scanner or homepage failure severe enough to matter would also
trip `foundationalUnavailable` (D1/health-check failure → `status_unavailable`) or be caught
through the existing GitHub Actions smoke tests before/after every deploy
(`docs/operations/PHASE_14_STATUS_OPERATIONS_BASELINE.md` "Post-deployment observation").

## Why `dashboard_domains` and `reports_sharing` have no signal

Same reasoning — no existing metric distinguishes "the dashboard/report route is broken" from
general D1 unavailability, which is already caught by the foundational health check's own
`status_unavailable` fallback. Building a dedicated check would duplicate that fallback's coverage
for a route that has no history of an isolated failure mode distinct from D1 itself.
