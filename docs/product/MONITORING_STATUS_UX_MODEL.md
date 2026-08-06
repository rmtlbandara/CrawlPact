# Monitoring Status UX Model

Presents the domain's real, existing monitoring data model — no new states are added to
`domains.monitoringState`/`monitoringFrequency` (schema unchanged; this is presentation only).

## Displayed states (derived, not stored)

| Displayed state                  | Derived from                                                                                                                                                                                                                                                                                                                              |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Active                           | `monitoringState = "active"` and `monitoringFrequency != "none"` and `consecutiveFailureCount < FAILURE_PAUSE_THRESHOLD`                                                                                                                                                                                                                  |
| Disabled                         | `monitoringFrequency = "none"` (plan doesn't include monitoring — Free plan)                                                                                                                                                                                                                                                              |
| Paused by user                   | `monitoringState = "paused"`, `consecutiveFailureCount = 0` at time of pause (best-effort: this codebase does not currently record _why_ a domain was paused, only that it is; a domain paused by the user after prior failures cannot be distinguished from a fresh user pause — documented as a known limitation, not silently guessed) |
| Paused after repeated failures   | `monitoringState = "paused"` and `consecutiveFailureCount >= FAILURE_PAUSE_THRESHOLD` (the auto-pause path in `monitoring.ts:222-230` always fires at exactly the threshold, so this combination reliably identifies it)                                                                                                                  |
| Scan overdue                     | `monitoringState = "active"`, `nextScanAt` is in the past (sweep hasn't reached it yet — informational, not an error)                                                                                                                                                                                                                     |
| Plan does not include monitoring | same signal as "Disabled" above, worded to point at Review pricing                                                                                                                                                                                                                                                                        |

"Baseline pending" and "Scheduling unavailable" (from the prompt's suggested list) are **not**
separate stored states in this codebase and are represented instead as: baseline pending →
`lastScanId === null` (a derived condition, not a monitoring state); scheduling unavailable has no
current failure mode in this codebase's scheduler (`claimDueDomains()` has no "unavailable"
outcome) so it is omitted rather than fabricated.

## Required fields shown

Monitoring enabled/disabled (derived state above); frequency (`none|monthly|weekly`, plain
English "Not monitored" / "Monthly" / "Weekly"); last successful scan (`lastScanAt`); next
scheduled scan (`nextScanAt` — **first UI surface to show this field**, confirmed absent from
every existing view during baseline research); consecutive failures (`consecutiveFailureCount`,
shown only when `> 0`, never a raw stack/error detail); current plan; "Review pricing" link when
`monitoringFrequency = "none"`.

## Actions

Enable/disable monitoring (existing `PATCH` toggle, unchanged); no separate "Pause"/"Resume" verbs
are introduced beyond the existing active/paused toggle — the schema has exactly one boolean-like
state, and inventing two "pause" verbs (one for the toggle, one from the prompt's suggested
vocabulary) over the same underlying field would misrepresent the data model. "Retry baseline" is
implemented as the existing "Re-scan now" action when `lastScanId === null` — same endpoint, same
quota rules, contextual label only.

## Explicit non-changes

No monitoring frequency change, no new notification channel, no real-time/hourly/daily monitoring,
no automatic re-enable without user action — all match the Phase 8 prompt's prohibited-changes
list and this codebase's existing Phase 6 entitlement boundaries exactly.
