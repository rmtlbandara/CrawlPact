# Phase 8 — Saved-Domain and Timeline Event Model

Follows the existing pattern in `apps/web/src/lib/analytics.ts` exactly: new literal event names
appended to `PRODUCT_EVENT_NAMES` under a grouped comment block, each event a single row in
`product_events`, first-party only, server-side wherever the interaction has a server round-trip.

## New events

```
saved_domains_viewed
saved_domain_opened
domain_current_state_viewed
domain_change_summary_viewed
domain_timeline_viewed
domain_timeline_filtered
domain_change_event_opened
domain_comparison_opened
domain_evidence_opened
domain_scan_history_viewed
domain_rescan_started
domain_rescan_completed
domain_rescan_failed
domain_monitoring_enabled
domain_monitoring_disabled
domain_share_started
domain_report_printed
domain_retention_info_viewed
```

`domain_rescan_*` reuse the existing `audit_started`/`audit_completed`/`audit_failed` events
already fired by `scan.ts` for the underlying audit — these new names are additionally fired
specifically to distinguish "a rescan was initiated from the saved-domain page" as a UX funnel
step from the generic audit lifecycle, matching how `monitoring_setup_viewed` /
`monitoring_enabled` already coexist with `audit_started` for the Phase 5 flow.
`domain_monitoring_resumed` from the original prompt list is **not** added separately from
`domain_monitoring_enabled` — per `MONITORING_STATUS_UX_MODEL.md`, this codebase has one
active/paused toggle, not a distinct pause/resume pair, so a second resume-specific event would
be a distinction the data model doesn't actually support.

## Properties

Every property is a plan key, change origin, monitoring state, scan trigger type, or general
result category — never a domain name, full URL, evidence string, scan ID, timeline-event ID,
user email, Paddle identifier, private-share token, or finding text, matching this file's own
existing privacy convention verbatim. Example:

```ts
trackEvent(db, "domain_timeline_filtered", {
  userId: user.id,
  properties: { filter: "website_policy_change" }, // never domain.canonicalOrigin
});
```

## Rendering is never blocked on analytics

Every `trackEvent()` call in this phase's new routes is fire-and-forget from the response's point
of view — a `product_events` insert failure never fails the request it's attached to (matches
`trackEvent`'s existing signature: it has no return value routes depend on).
