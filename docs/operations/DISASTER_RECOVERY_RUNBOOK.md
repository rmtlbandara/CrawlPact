# Disaster Recovery Runbook

**Level 2 document.** Phase 14 (§62-72, §107-110). Per-subsystem operational runbooks plus
disaster-recovery procedures. Cross-references existing, more-detailed docs where they already
exist rather than duplicating them — this document is the map, not a second copy.

All recovery objectives below are **internal targets**, not contractual RTO/RPO — labelled
explicitly, never marketed as an SLA (§108).

## D1

**Canonical docs**: `docs/operations/BACKUP_AND_RECOVERY.md` (policy),
`docs/operations/PHASE_11_DATABASE_RECOVERY_RUNBOOK.md` (Phase 11 re-verification).

- **Query errors**: surface via `getSystemStatusSummary`'s implicit reachability check —
  `foundationalUnavailable` on `/status` if the health check itself throws.
- **Migration failure**: `pnpm db:validate` (schema/migration agreement) is part of `quality:gate`
  and CI; a migration that fails to apply in production would be caught before the
  `deploy-production.yml` workflow's subsequent steps run (migrations apply before the Worker
  deploy step).
- **Capacity**: `capacity.d1.tableCount`, `docs/operations/CLOUDFLARE_UPGRADE_TRIGGERS.md`.
- **Corruption suspicion / Time Travel recovery**: `wrangler d1 time-travel restore` against the
  **preview** database only, never production directly. **Re-verified live this phase**: a real
  Time Travel bookmark was retrieved from the preview database
  (`GET /accounts/{account}/d1/database/{id}/time_travel/bookmark` → `200`,
  bookmark `0000003e-00000000-000050c3-...`), confirming the capability is genuinely available —
  see `docs/operations/PHASE_14_RELIABILITY_GAME_DAY.md` for what was and wasn't executed.
- **Backup verification / stuck migrations / rollback-forward-fix**: no stuck migration has ever
  occurred in this repository's history; the forward-only migration policy (ADR-0002) means the
  only "rollback" for a bad migration is a new, corrective forward migration, never editing an
  applied one.
- **Recovery objective (internal target, not SLA)**: restore from Time Travel within the verified
  7-day (Free plan) window; beyond that, no D1 recovery is possible for this account tier.

## R2 (`AGENCY_LOGOS` bucket only)

- **Logo upload failure**: `lib/agency-logo.ts`'s upload path fails the specific upload request; it
  never blocks core audit or monitoring functionality (R2 and the scan/monitoring path share no
  code, no binding, no request path).
- **R2 unavailable**: same isolation — agency branding degrades gracefully (falls back to no custom
  logo), core product is unaffected.
- **Orphan cleanup**: `lib/r2-orphan-cleanup.ts`'s `findAndCleanupOrphanedLogos`, bounded
  (`maxObjects`, `graceMinutes`), dry-run by default, reachable via
  `POST /api/admin/settings/r2-orphan-cleanup` and the existing daily retention job's
  `orphaned_agency_logos` category (Phase 9, RISK-010 — see `docs/risks/RISK_ARCHIVE.md` ARC-027).
- **Missing logo object / D1-R2 reference mismatch**: detected by the same orphan-cleanup scan
  (a D1 `shared_reports`/agency-branding row referencing an R2 key that no longer exists shows up
  as a reference needing correction, not a silent 404 on next render — the branding UI already
  falls back to "no logo" when the object fetch fails).
- **Recovery objective**: none needed beyond re-upload — no logo is customer-irreplaceable data in
  the way a scan history or billing record would be.

## KV

- **What it's actually for**: `wrangler.jsonc`'s `SESSION` KV binding exists only because
  `@astrojs/cloudflare` auto-enables its own framework-level session feature whenever a KV
  namespace named `SESSION` is bound (confirmed in real build output: `[@astrojs/cloudflare]
Enabling sessions with Cloudflare KV with the "SESSION" KV binding"`). **`Astro.session` is never
  called anywhere in this codebase** (grepped, zero matches) — CrawlPact's real, customer-facing
  authentication sessions are entirely D1-backed (`lib/auth/session.ts`, the `sessions` table),
  unrelated to this KV namespace.
- **Impact if KV were unavailable**: none to real customer sessions — they don't depend on it.
  Astro's own framework-level session feature (unused) might error internally, but no route in this
  codebase reads or writes through it. Not verified with a live KV outage (would require an
  unsupported Cloudflare-side fault injection); reasoned from the code path, not tested.
- **Recovery objective**: N/A — nothing customer-facing depends on this binding today.

## Billing (Paddle)

**Canonical doc**: `docs/security/BILLING_SECURITY.md`, `docs/billing/PADDLE_WEBHOOK_EVENT_MATRIX.md`.

- **Webhook processing failure**: `/admin/webhooks`, `retryWebhookEvent` (re-runs the real
  idempotency-checked `processPaddleWebhookEvent` path, never fabricates success).
- **Paddle unreachable**: checkout creation and webhook processing both fail cleanly with a
  specific error; no silent fallback that could grant an unpaid entitlement.
- **Checkout unavailable**: `/pay` page and checkout API return an honest error; `BILLING_ENABLED`
  can disable the whole surface if needed (env var, requires a redeploy — not a runtime toggle).
- **Duplicate / out-of-order events**: handled by existing idempotency (`paddle_event_id`
  uniqueness) and the atomic compare-and-swap fix on `subscriptions.last_applied_occurred_at`
  (Phase 12, `docs/status/BILLING_WEBHOOK_RACE_TEST_FLAKE.md`).
- **Failed subscription reconciliation**: the existing "Paddle resync" admin action
  (`lib/admin/subscriptions.ts`) re-fetches real state directly from Paddle.
- **Price mismatch**: `scripts/paddle-catalog-verify.ts` (already exists, not new).
- **No manual plan-granting shortcut** — confirmed: no code path in this codebase lets an admin
  directly set a user's plan bypassing Paddle state, other than the existing, already-audited
  temporary-entitlement grant tooling (a distinct, intentional, time-boxed mechanism — not a
  billing-state override).
- **Real payment boundary**: RISK-001 (a real paid checkout lifecycle has never been run) remains
  open and unrelated to Phase 14 — this phase does not authorise or attempt a real transaction.

## Authentication (WebAuthn/passkeys)

- **Passkey login failures**: normal, expected (a device without a registered passkey) — not an
  incident signal on its own; `auth.failure_spike` (Phase 14 operational alert) only fires above 50
  in an hour.
- **RP ID / origin misconfiguration**: would manifest as a sudden, broad spike in `auth_failure`
  security events — the existing alert threshold catches this class of incident, not a dedicated
  separate check.
- **Session issue / D1 session failure**: sessions are entirely D1-backed (`sessions` table); a D1
  outage affects authentication the same way it affects everything else — see "D1" above.
- **Compromised user session**: `/admin/users` supports session/passkey revocation for a specific
  account — existing tooling, not built this phase.
- **Admin access failure**: Super Admin sessions use the same D1-backed mechanism plus
  `requireRecentAuthentication` (step-up) for sensitive actions — no separate admin-only auth
  system to fail independently.
- **Preserve Phase 12 security controls**: WebAuthn validation is never disabled as an emergency
  workaround, under any circumstance — there is no code path or runtime-config flag that does this,
  by design.

## Scanner

- **Widespread scanner error / incorrect findings / parser failure / policy-engine regression**:
  `AUDIT_ENGINE_ENABLED=false` disables new scans entirely (env var, requires redeploy) —
  preferred over publishing incorrect reports, per the Phase 14 prompt's own §69 rule. Historical
  scan evidence is never deleted as part of this containment.
  `status.astro`'s public status page already reports the audit engine as unavailable honestly when
  disabled (`docs/status/IMPLEMENTATION_STATUS.md`).
- **SSRF control failure**: `packages/scanner`'s safe-fetch chokepoint (ADR-0005) is the single
  place all scanner network calls go through — see `docs/security/` for the full threat model; a
  suspected SSRF-control regression is treated as a security incident (Phase 12 process), not an
  operational one.
- **Target abuse**: `/admin/blocked-targets`, plus Phase 12's cross-request target-frequency
  detection (`target_abuse_observations`, detection-only).

## Monitoring

**Canonical docs**: `docs/operations/PHASE_10_MONITORING_RELIABILITY_RUNBOOK.md`,
`docs/operations/MONITORING_STATE_RECONCILIATION.md`. Monitoring truth remains entirely owned by
Phase 10's model — this phase adds observability (`operational_alerts`,
`/admin/operations`) on top, never a second engine.

- **Scheduler missed / backlog rising / target failure / platform failure / paused domains**: all
  visible at `/admin/operations` (scheduler anomalies, capacity backlog counts, operational alerts)
  and `/admin/domains`.
- **Worker CPU failures**: not directly observable from inside the Worker; see
  `docs/operations/CLOUDFLARE_UPGRADE_TRIGGERS.md` for the capacity thresholds that would predict
  this class of failure before it happens.
- **Reconciliation / capacity threshold**: `docs/operations/MONITORING_STATE_RECONCILIATION.md`,
  `docs/operations/CLOUDFLARE_UPGRADE_TRIGGERS.md`.
- **Never manually change customer monitoring cadence** — no admin tooling exists to do this, by
  design (cadence is plan-derived, not admin-overridable).

## Notifications

**Canonical doc**: `docs/operations/PHASE_10_NOTIFICATION_RECONCILIATION_RUNBOOK.md`.

- **Generation failure / reconciliation backlog**: `POST /api/admin/operations/reconcile-notifications`
  (Phase 14, reuses the exact Phase 10 function the daily cron calls).
- **Atom failure**: private per-account Atom feeds (`/feed/[token].xml`) are entitlement-gated and
  re-checked on every read (Phase 10) — distinct from the new _public_ status Atom feed
  (`/status/feed.xml`, Phase 14), which has no entitlement concept at all.
- **Dedupe failure / notification storm**: prevented by `idx_notifications_user_dedupe` (Phase 10).
- **Invariant preserved**: notification failure never alters monitoring truth — Phase 10's ordering
  (commit monitoring state first, attempt notification second, isolated try/catch) is unchanged.

## Retention

**Canonical doc**: `docs/data/PHASE_11_RETENTION_DECISION_MATRIX.md`,
`docs/data/PHASE_14_SECURITY_EVENT_RETENTION_DECISION.md`,
`docs/data/PHASE_14_NOTIFICATION_RETENTION_DECISION.md`.

- **Purge failure / foreign-key issue / unexpected deletion count / partially completed category**:
  per-category try/catch isolation (Phase 11, Stage 11D) — one category's failure never aborts the
  others; `POST /api/admin/operations/retention-dry-run` (Phase 14) lets an operator verify exactly
  what the next run would affect before trusting a change.
- **D1 lock**: not observed in this codebase's history; D1's own write serialization means a
  concurrent retention run and a normal request never corrupt each other's writes, only potentially
  contend briefly.
- **Never manually mass-delete customer history** — no admin tooling exists to bypass the
  retention job's own bounded, category-scoped deletion logic.

## Deployment

See `docs/operations/PHASE_14_STATUS_OPERATIONS_BASELINE.md` "Post-deployment observation" and
`docs/reports/PHASE_14_STATUS_OPERATIONS_RELIABILITY_COMPLETION_REPORT.md` for this phase's own
deployment evidence. Rollback: redeploy the previous known-good commit via the same
`deploy-production.yml` workflow (no automated one-click rollback exists — a deliberate choice,
matching §127's "no destructive one-click admin action" spirit extended to deployment).

## Disaster scenarios (§107)

| Scenario                                                                    | Response                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main Worker broken deployment                                               | Redeploy the previous known-good commit via `deploy-production.yml`                                                                                                                                                          |
| D1 unavailable                                                              | Cloudflare-side incident — check Cloudflare status directly; no application-level workaround exists (D1 is the only datastore)                                                                                               |
| Accidental data modification                                                | D1 Time Travel restore (preview-verified capability, production restore requires explicit approval per this repo's standing infrastructure-action rule)                                                                      |
| R2 issue                                                                    | Isolated — does not affect core audit/monitoring (see "R2" above)                                                                                                                                                            |
| Compromised deployment secret                                               | Rotate the affected Cloudflare API token / Worker secret immediately (`wrangler secret put`), redeploy; see `docs/security/` for the incident-response process                                                               |
| Billing-webhook disruption                                                  | `/admin/webhooks` retry + Paddle resync (see "Billing" above)                                                                                                                                                                |
| Scanner disabling                                                           | `AUDIT_ENGINE_ENABLED=false` + redeploy (see "Scanner" above)                                                                                                                                                                |
| Authentication issue                                                        | See "Authentication" above; never disable WebAuthn validation                                                                                                                                                                |
| Registry: active release invalid (checksum mismatch or unparseable entries) | Check `/admin/operations`'s "Registry health" section (Phase 15). Roll back to the last release with a verified-valid checksum via `docs/registry/REGISTRY_ROLLBACK_RUNBOOK.md`. Never edit the bad release's entries.       |
| Registry: accidental bad activation (wrong release published)               | Same rollback runbook — rollback is idempotent and always available to any previously-_published_ release.                                                                                                                   |
| Registry: failed activation or rollback (D1 error mid-request)              | `publishRegistryVersion`/`rollbackRegistryVersion` run as a single `db.batch()` — a mid-request failure leaves the previous active release untouched (no partial pointer flip is possible), so simply retry the same action. |
| Registry: incorrect crawler classification found in production              | Not a rollback scenario by itself unless it's actively producing wrong evaluations — follow `docs/registry/REGISTRY_CORRECTION_WORKFLOW.md` to publish a corrected release instead.                                          |
