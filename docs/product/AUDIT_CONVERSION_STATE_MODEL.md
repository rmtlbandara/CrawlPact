# Audit conversion state model (Phase 5)

The state machines behind `docs/product/AUDIT_CONVERSION_FLOW.md`. Two
independent state machines are involved — a continuation's lifecycle, and
the baseline-establishment decision — plus the domain's monitoring state,
which this flow only ever moves in one direction.

## 1. Continuation lifecycle

Backed by `audit_continuations` (migration `0020_audit_continuations.sql`).
`consumed_at` is the only state field; every other column is immutable after
creation.

```
                    createContinuation()
                            │
                            ▼
                    ┌───────────────┐
                    │    active     │  consumed_at IS NULL
                    │ (unconsumed)  │  expires_at > now
                    └───────┬───────┘
                            │
              consumeContinuation() succeeds
           (atomic: consumed_at IS NULL AND
                  expires_at > now)
                            │
                            ▼
                    ┌───────────────┐
                    │   consumed    │  consumed_at IS NOT NULL
                    │  (terminal)   │
                    └───────────────┘
```

A continuation that is never consumed before `expires_at` passes simply
becomes unusable — there is no separate "expired" column value; expiry is
computed at read time (`expires_at > now`) both by `consumeContinuation()`'s
own guard and by `/app/continue`'s read-only display peek. `consumeContinuation()`
returns a discriminated result — `{ ok: true, continuation }` or
`{ ok: false, reason: "not_found" | "expired" | "already_consumed" }` — computed
by a second, read-only lookup only on the failure path, purely to choose an
accurate message; the state transition itself already happened (or didn't)
atomically before that lookup runs.

There is no path back from `consumed` to `active`, and no "cancelled" or
"revoked" state — a continuation that led to an error partway through
`POST /api/audit/continuation/:continuationId` (e.g. hit the plan limit) is
still consumed; retrying requires a fresh continuation (trivially available
by clicking the CTA again from the still-visible report page). This is a
deliberate simplification: making consumption reversible would reopen the
exact TOCTOU risk the atomic CAS exists to close, for a failure mode with a
cheap workaround.

## 2. Baseline establishment decision

Computed once per completion attempt by `establishBaseline()`
(`apps/web/src/lib/audit-continuation.ts`), never persisted as its own
column — the outcome is expressed entirely through the `scans` row's
`domain_id` (adoption) or the existence of a brand-new `scans` row
(rerun). See `docs/product/ANONYMOUS_TO_AUTHENTICATED_BASELINE_POLICY.md`
for the full adopt-vs-rerun rationale.

```
                    establishBaseline()
                            │
                            ▼
              ┌─────────────────────────┐
              │ scan exists, status is  │
              │ completed[_with_warn.], │──── no ───┐
              │ registry/ruleset match  │           │
              │      current active     │           │
              └────────────┬────────────┘           │
                           yes                        │
                            │                          │
                            ▼                          │
              ┌─────────────────────────┐              │
              │ UPDATE scans SET        │              │
              │ domain_id = ?           │              │
              │ WHERE id = ? AND        │              │
              │ domain_id IS NULL       │              │
              └────────────┬────────────┘              │
                    claimed │  lost the race            │
                    (1 row) │  (0 rows)                 │
                            ▼         └──────────┬──────┘
                    ┌───────────┐                ▼
                    │  adopted  │      ┌───────────────────┐
                    │ (terminal)│      │ engine enabled AND │
                    └───────────┘      │ active registry    │──no──┐
                                        │     exists          │      │
                                        └──────────┬──────────┘      │
                                                  yes                 │
                                                   │                  │
                                                   ▼                  │
                                        ┌───────────────────┐        │
                                        │ runAudit + persist │        │
                                        │  Scan (new scan)   │        │
                                        └──────────┬──────────┘       │
                                          succeeded │  did not         │
                                                     │  succeed         │
                                                     ▼                  ▼
                                            ┌───────────┐      ┌────────────────┐
                                            │   rerun   │      │     failed     │
                                            │ (terminal)│      │ scan_missing / │
                                            └───────────┘      │ rerun_failed /  │
                                                                │ engine_disabled │
                                                                └────────────────┘
```

`failed` is not an error thrown to the caller — the domain is still saved
either way (`POST /api/audit/continuation/:continuationId` only fails the
whole request for continuation-validity or domain-limit reasons, both
checked before this runs). A `failed` baseline surfaces as
`baselineEstablished: false` plus an honest, specific `warning` string in
the response — never a fabricated score (`docs/status/KNOWN_RISKS.md`).

## 3. Domain monitoring state (this flow's slice of it)

`domains.monitoring_state` is a pre-existing column (`active` | `paused`)
shared with the manual "Add a domain" flow. Phase 5 only constrains the
states it itself produces:

```
   domain created via this flow
              │
              ▼
        ┌───────────┐   PATCH /api/domains/:id
        │  paused   │──  { monitoringState: "active" } ──▶  ┌────────┐
        │ (always,  │      (explicit "Enable monitoring"    │ active │
        │  on save) │       click; not entitled → not       └────────┘
        └───────────┘       offered at all)
              │
              │  "Not now" / not entitled / never revisited
              ▼
        stays paused indefinitely (no auto-expiry, no nag)
```

An already-existing domain reused by this flow (the "domain already saved"
case) keeps whatever `monitoring_state` it already had — this flow never
touches monitoring state for a pre-existing domain, only for one it creates.
