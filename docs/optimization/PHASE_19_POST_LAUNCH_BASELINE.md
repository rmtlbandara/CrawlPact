# Phase 19 Post-Launch Baseline

Status: current-authoritative, 2026-08-14. Recorded before any Phase 19 optimisation work, per
§129 ("baseline before optimisation" — otherwise improvement cannot be measured). All figures
below are read directly from live production D1 via a read-only query; nothing is estimated or
inferred. Zero is recorded as zero, not omitted (§128).

## Snapshot

| Field                         | Value                                             |
| ----------------------------- | ------------------------------------------------- |
| Date                          | 2026-08-14                                        |
| Commit                        | `8e5a58073e73d9ca0e6b87c48cee63a6acf65669` (main) |
| Production application commit | `16fb16088aef652fe021ac6b4eb8fa2db5e789d3`        |
| Production Worker version     | `280cac36-d3cb-4ca0-a7a2-03aab2c6ecf8`            |
| Migrations applied            | 36/36                                             |
| Active registry release       | `reg_2026_07_3`                                   |
| Active ruleset                | `rules_2026_07_2`                                 |
| D1 size                       | 2.09 MB                                           |

## Accounts

| Metric                          | Value | Note                                                                                                                                                   |
| ------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Total accounts (non-deleted)    | 2     |                                                                                                                                                        |
| Admin/owner accounts            | 1     | Super Admin, plan `agency`                                                                                                                             |
| Non-admin accounts              | 1     | Plan `free`, created 2026-07-30                                                                                                                        |
| **External activated accounts** | **0** | The 1 non-admin account has 0 saved domains and 0 subscriptions — no activation signal exists to count it as activated, external, or otherwise engaged |

## Domains

| Metric                               | Value |
| ------------------------------------ | ----- |
| Total saved domains                  | 4     |
| Monitored domains (frequency ≠ none) | 4     |
| Domains owned by non-owner accounts  | 0     |

All 4 saved domains belong to the owner's Super Admin account.

## Billing (Paddle, authoritative)

| Metric                        | Value                                                    |
| ----------------------------- | -------------------------------------------------------- |
| Billing customers             | 1                                                        |
| Total subscriptions           | 2 (Solo, created 2026-07-28; Agency, created 2026-08-05) |
| Active subscriptions          | 2                                                        |
| Cancelled subscriptions       | 0                                                        |
| **External paying customers** | **0**                                                    |
| **MRR (external)**            | **$0**                                                   |

Both subscriptions belong to the single billing customer linked to the owner's Super Admin
account — confirmed by joining `users` → `billing_customers` → `subscriptions` directly. This
matches and reconfirms the existing Phase 17 finding (`docs/pilot/PHASE_17_COMMERCIAL_VALIDATION_DECISION.md`):
0 external paying customers.

## Audit / scan activity

| Metric                          | Value |
| ------------------------------- | ----- |
| Total scans (all time)          | 8     |
| Scans in last 30 days           | 8     |
| Anonymous scans                 | 1     |
| Scheduled (monitoring) scans    | 5     |
| Completed scans                 | 7     |
| Total `product_events` recorded | 1,466 |

Volume is low and consistent with a pre-external-launch state — no external users have exercised
the product yet.

## Commercial baseline (Phase 17 frozen criteria, unchanged)

| Criterion                             | Threshold                | Current                                   | Status      |
| ------------------------------------- | ------------------------ | ----------------------------------------- | ----------- |
| External participants                 | ≥ 8 (preferred 10–15)    | 0                                         | Not met     |
| Agency/multi-site participants        | ≥ 4                      | 0                                         | Not met     |
| Independent external paying customers | ≥ 2                      | 0                                         | Not met     |
| Unresolved P0/P1 integrity blockers   | = 0                      | 0                                         | **Met**     |
| Minimum observation window            | ≥ 14 days (preferred 30) | N/A — no pilot participants recruited yet | Not started |

## Search Console

Not connected. No Google-authenticated Search Console tool is available in this session
(confirmed by tool search — none exists). Owner action remains open and documented:
`docs/release/PHASE_18_SEARCH_CONSOLE_REQUIRED_ACTION.md`.

## Current active risks

24 entries in `docs/risks/ACTIVE_RISKS.md` as of this pass (unchanged count from the Phase 0-18
final reconfirmation) — see `docs/optimization/PHASE_19_EVIDENCE_BACKLOG.md` for which of these
carry forward as Phase 19 triggers.

## Content/indexing baseline

Cannot be measured without Search Console access. `pnpm run content:links:check` and
`registry:public:validate` remain the available proxy checks (both passing as of this pass) —
neither substitutes for real indexing/query data.

## Conclusion

This baseline shows a technically healthy, fully-launched product with **zero real external
usage** — the expected and honestly-recorded starting point for Phase 19's actual work: obtaining
real external evidence, not building more product surface.
