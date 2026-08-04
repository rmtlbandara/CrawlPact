# Phase 5 analytics event model: anonymous audit conversion

The 13 `PRODUCT_EVENT_NAMES` entries (`apps/web/src/lib/analytics.ts`) added
for the anonymous audit → account-conversion funnel
(`docs/product/AUDIT_CONVERSION_FLOW.md`). Same first-party-only model as
every other product event in this codebase (SRS §33): no third-party
analytics, `isProductEventName()` enforces the closed union server-side, and
— specific to this funnel — **no domain, email, continuation id, or scan id
is ever sent as an event property.** `variant`/`intendedAction`/`reason`
values are all small closed enums, never free text or identifiers.

## Funnel, in firing order

| #   | Event                                 | Fired from                                                  | Properties                                                       | Fires when                                                                                                             |
| --- | ------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | `anonymous_conversion_cta_viewed`     | `AuditConversionCta.tsx` (client)                           | `variant` (the 6-way CTA copy variant)                           | The CTA renders for a viewer who doesn't already own the domain — once per mount                                       |
| 2   | `anonymous_conversion_cta_clicked`    | same                                                        | `variant`, `intendedAction`                                      | Either CTA button is clicked, before the continuation-create request resolves                                          |
| 3   | `audit_continuation_expired`          | `/app/continue` (server, GET)                               | —                                                                | An authenticated visitor's continuation link is found but past `expires_at` (distinct from not-found/already-consumed) |
| 4   | `audit_domain_save_started`           | `POST /api/audit/continuation/:id`                          | `intendedAction`                                                 | Right after the continuation is successfully consumed, before the domain-create attempt                                |
| 5   | `audit_conversion_plan_limit_reached` | same                                                        | —                                                                | The account's saved-domain limit blocks the save                                                                       |
| 6   | `audit_baseline_rerun_started`        | same (via `establishBaseline`'s `onRerunStarting` callback) | —                                                                | Adoption was ruled out (scan stale/mismatched/already claimed) and a fresh scan is about to run                        |
| 7a  | `audit_baseline_adopted`              | same                                                        | —                                                                | The original anonymous scan was successfully claimed as-is                                                             |
| 7b  | `audit_baseline_rerun_completed`      | same                                                        | —                                                                | The fresh rerun (from #6) completed successfully                                                                       |
| 8   | `audit_conversion_failed`             | same                                                        | `reason` (`scan_missing` \| `rerun_failed` \| `engine_disabled`) | Baseline establishment failed outright (domain is still saved either way — see the state model doc)                    |
| 9   | `audit_conversion_completed`          | same                                                        | `intendedAction`, `baselineStrategy` (`adopted` \| `rerun`)      | The whole save+baseline sequence succeeded                                                                             |
| 10  | `monitoring_setup_viewed`             | `AuditConversionHandoff.tsx` (client)                       | —                                                                | The result screen shows an eligible, successful save with the monitoring choice visible                                |
| 11a | `monitoring_enabled`                  | same                                                        | —                                                                | "Enable monitoring" clicked                                                                                            |
| 11b | `monitoring_skipped`                  | same                                                        | —                                                                | "Not now" clicked                                                                                                      |

Events 1–2 and 10–11 are client-side beacons (`track()` in
`analytics-client.ts`, fire-and-forget via `POST /api/analytics/track`,
never blocking navigation or surfacing an error). Events 3–9 are recorded
server-side, in the same request that performs the underlying mutation,
using the existing `trackEvent()` helper — consistent with every other
mutation-adjacent event in this file (`domain_saved`, `subscription_activated`,
etc.).

## Why some steps have no distinct event

- **Sign-in / sign-up itself** reuses the existing `account_started` /
  `account_created` events unchanged — Phase 5 doesn't fork the auth funnel,
  it only changes what page the visitor lands on before and after it
  (`sign-in.astro`'s continuation-aware heading/redirect).
- **The confirm click on `/app/continue`** has no separate "confirm clicked"
  event distinct from #4 (`audit_domain_save_started`) — the confirm click
  and the save-started moment are the same request, so a client-side
  "clicked" beacon would be redundant with the server-recorded one.
- **A replayed/invalid continuation hit at `/app/continue`** (GET, read-only
  peek) does not fire a distinct event beyond #3 for the specific
  "expired" case — "not found" and "already consumed" are read as the same
  generic error state by the visitor and aren't distinguished analytically
  either; the `POST` endpoint's own `AUDIT_CONTINUATION_INVALID` response
  (for a direct replay attempt after the page already blocked it) is
  security-relevant but not a funnel-analytics moment.

## Consistency check

`analytics-sharing.integration.test.ts` and the wider integration suite
assert `isProductEventName()` accepts every name actually used and rejects
unknown ones; `audit-conversion.integration.test.ts` exercises the real
`POST /api/audit/continuation/:continuationId` paths that fire events 4–9
end to end against a real D1 instance (though it does not assert on the
`product_events` table directly — see that file for what it does assert).
