# Phase 17 Pilot Baseline

Status: current-authoritative. Owner: Product owner. Last verified: 2026-08-11.

Records the actual state Phase 17 started from — verified directly, not assumed from the Phase
17 prompt's "historical" placeholder values.

## Starting repository/production state

| Item                                  | Value                                                                                      | How verified                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `main` HEAD                           | `2722529` (`27225296700db561743107625a56ac412978d307`)                                     | `git log origin/main -1`                                               |
| Production Worker                     | `e5cf03ea-7cd4-4970-b331-2f6879a84035`                                                     | Cloudflare Workers list                                                |
| Migration state                       | 35/35 (`0035_research_publications.sql` latest)                                            | live `d1_migrations` query                                             |
| Active crawler registry               | `2026.07.3`, unchanged                                                                     | live `registry_versions` query                                         |
| Research publications live            | 0                                                                                          | live `research_publications` count                                     |
| Pricing                               | Unchanged since Phase 6 (Free/Solo/Pro/Agency, monthly+yearly)                             | `docs/deployment/PADDLE_LIVE_CONFIGURATION.md`, not touched this phase |
| RISK-001 (real paid Paddle lifecycle) | Was "open" per `docs/risks/ACTIVE_RISKS.md`; **new evidence found this phase** — see below | direct read of the risk register, then independent verification        |

## RISK-001 — new evidence found during preflight

Production already contains two **real, live** (non-sandbox — `PADDLE_ENVIRONMENT=production`)
Paddle subscriptions:

- A Solo subscription, `status=active`, `first_billed_at` populated, created 2026-07-28.
- An Agency subscription, `status=active`, `first_billed_at` populated, created 2026-08-05.

Both belong to the **same `billing_customer_id`**, which is linked to the **Super Admin's own
user account** (`admin_role_assignments` confirms `user_has_admin_role = 1`) — i.e. the product
owner's own account, not an external customer. Both were independently re-verified read-only
against the live Paddle API (`subscriptions.get`): real checkout, real payment
(`collection_mode: automatic`, `first_billed_at` set), a linked webhook event
(`last_paddle_event_id IS NOT NULL` in D1), correct plan (`solo`/`agency`), correct billing
period. This is genuine evidence that the full checkout → payment → webhook → account linkage →
plan grant chain works end-to-end in production.

Per this phase's own doctrine (§9, §19, §24): this **may close the technical half of RISK-001**
(a real lifecycle has now been observed) but **provides zero commercial-validation evidence**
(owner's own account is explicitly excluded from paid-conversion counts). See
`docs/pilot/REAL_PAID_CHECKOUT_VALIDATION_PROTOCOL.md` for the full evidence trail and the
resulting risk-register update.

## Existing user/subscription baseline

Two active subscriptions total in production (both described above, both excluded from any
future pilot commercial-evidence counts as the owner's own account). No other subscription rows
exist. No pilot cohort, participant, or feedback data exists prior to this phase (new tables).

## What Phase 17 builds this session

Technical pilot-readiness infrastructure only: a minimal cohort/participant/feedback data model,
a Super Admin pilot workspace, an authenticated in-app feedback widget, governance/methodology
documentation, and tests. **No real external participant recruitment occurs in this session** —
recruitment is explicitly an owner action (§26, §194) that a coding agent cannot perform. See
`docs/pilot/PHASE_17_PILOT_READY_AWAITING_EXTERNAL_EVIDENCE.md`.
