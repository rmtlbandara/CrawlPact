# Phase 17 Commercial Metric Dictionary

Status: current-authoritative. Every metric below is computed live from authoritative tables
(`domains`, `subscriptions`, `billing_customers`, `product_events`) via
`apps/web/src/lib/admin/pilot-analytics.ts` — never stored redundantly on a pilot row (§66, §75).

| Metric                         | Definition                                                                                                                                                                                                     | Source                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Participants invited/joined    | Count of `pilot_participants` rows by `participation_status`                                                                                                                                                   | `pilot_participants`                        |
| First audits started/completed | Existing `audit_started`/`audit_completed` `product_events`, filtered to participant `user_id`s                                                                                                                | `product_events`                            |
| Report understood              | Structured pilot feedback (`usefulness`/`clarity` on an `audit_clarity` feedback row), plus interview notes                                                                                                    | `pilot_feedback` + interview notes          |
| Accounts created               | Participant `user_id` exists (implies an account, since only real accounts can be added as participants)                                                                                                       | `pilot_participants.user_id`                |
| Saved-domain activation        | Same definition as Phase 13's product analytics: ≥1 domain with `last_scan_id IS NOT NULL AND deleted_at IS NULL` for the participant's `user_id`                                                              | `domains`                                   |
| Monitoring enabled             | ≥1 domain with `monitoring_state = 'active'` and not deleted, for the participant's `user_id`                                                                                                                  | `domains`                                   |
| Return usage                   | Meaningful authenticated `product_events` activity (timeline review, monitoring review, report usage, rescan) after the initial session — never background scheduled monitoring alone (§97)                    | `product_events`                            |
| Pricing viewed                 | `pricing_viewed` `product_events` for the participant's `user_id`                                                                                                                                              | `product_events`                            |
| Checkout started/completed     | `checkout_started` / `subscription_activated` `product_events` for the participant's `user_id`                                                                                                                 | `product_events`                            |
| Paid conversion                | A real Paddle-backed subscription (`subscriptions.status IN ('active','trialing','past_due')`) linked via `billing_customers.user_id` — never `users.plan_id` alone, which can reflect a temporary admin grant | `subscriptions` + `billing_customers`       |
| Support intervention           | `pilot_participants.human_help_count` + linked `internal_user_notes`                                                                                                                                           | `pilot_participants`, `internal_user_notes` |
| Participant withdrawal         | `participation_status = 'withdrew'`                                                                                                                                                                            | `pilot_participants`                        |
| Cancellation                   | Real `subscriptions.status` transition to `canceled`, observed naturally — never forced (§64)                                                                                                                  | `subscriptions`                             |
| Primary objection              | `pilot_feedback.non_purchase_reason` distribution                                                                                                                                                              | `pilot_feedback`                            |

## Reporting rules

- Every ratio is shown as `numerator / denominator — percent%`, never a bare percentage (§68).
- Drop-outs and negative results are never removed from a denominator (§161-162).
- No metric here is duplicated into Google Analytics, and no participant identifier is ever sent
  to GA (§72).
