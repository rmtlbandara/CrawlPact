# Phase 09 — Agency Workspace Event Model

Uses the existing approved analytics architecture (`apps/web/src/lib/analytics.ts`'s
`trackEvent(db, name, properties)`, first-party, D1-stored, already used by every existing event
in the codebase such as `domain_saved`). No new provider is added.

## Events

```text
agency_workspace_viewed
portfolio_summary_viewed
portfolio_attention_filter_applied
portfolio_change_feed_viewed
portfolio_domain_opened
domain_group_created
domain_group_updated
domain_group_deleted
domain_group_assignment_changed
saved_view_created
portfolio_import_previewed
portfolio_import_confirmed
portfolio_import_completed
portfolio_import_failed
portfolio_export_started
portfolio_export_completed
bulk_action_started
bulk_action_completed
agency_branding_updated
agency_logo_uploaded
agency_logo_removed
agency_report_share_created
agency_report_share_revoked
plan_limit_reached_from_portfolio
```

Adapted from the prompt's suggested list: `portfolio_import_started` is merged into
`portfolio_import_previewed` (the preview step _is_ the start — there is no separate
"started" moment given import has no background job to mark the beginning of, per
`CSV_IMPORT_WORKFLOW.md`'s "why no background job" finding).

## Properties — every event, without exception

Only categorical/safe values, matching every existing event in this codebase:

| Property          | Example values                                                                                                                                                                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plan`            | `free \| solo \| pro \| agency`                                                                                                                                                                                                                                        |
| `batchSizeRange`  | `1 \| 2-10 \| 11-50 \| 51-100` (bucketed, never the exact count when it could imply row content — though a plain integer count is safe here since it reveals nothing about domain identity; bucketing is used anyway for consistency with the "categorical" principle) |
| `actionType`      | e.g. `assign_group \| enable_monitoring` (the bulk-action enum itself)                                                                                                                                                                                                 |
| `resultCategory`  | `all_succeeded \| partial_success \| all_failed`                                                                                                                                                                                                                       |
| `monitoringState` | `active \| paused`                                                                                                                                                                                                                                                     |
| `changeOrigin`    | Phase 8's existing five-value enum                                                                                                                                                                                                                                     |

## Never sent (verified against every new event's call site during implementation)

Domain name, client/group name, notes, uploaded row content, file name, import-job ID, share
token, user email, Paddle identifiers, evidence, report findings. None of the properties table
above includes any of these, and every `trackEvent` call site in this phase's new code is reviewed
in `PHASE_09_AGENCY_WORKSPACE_THREAT_REVIEW.md`'s "Analytics privacy" test to confirm the actual
call sites match this document, not just the intent.
