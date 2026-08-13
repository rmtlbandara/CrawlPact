# Pilot Feedback Coding Schema

Status: current-authoritative.

## Structured feedback fields (stored in `pilot_feedback`, §41)

| Field                 | Values                                                                                                                                                                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `category`            | `onboarding`, `audit_clarity`, `evidence`, `recommendation`, `saved_domain`, `timeline`, `monitoring`, `notification`, `report_sharing`, `agency_workspace`, `pricing`, `billing`, `reliability`, `support`, `feature_request`, `other` |
| `usefulness`          | `low`, `medium`, `high`                                                                                                                                                                                                                 |
| `clarity`             | `clear`, `unclear`                                                                                                                                                                                                                      |
| `difficulty`          | `easy`, `moderate`, `hard`                                                                                                                                                                                                              |
| `primary_value`       | `crawler_matrix`, `evidence_findings`, `recommended_configuration`, `saved_history`, `monitoring`, `timeline_attribution`, `reports_sharing`, `agency_workflows`                                                                        |
| `blocking_issue`      | `none`, `partial`, `blocked`                                                                                                                                                                                                            |
| `purchase_reason`     | `monitoring`, `portfolio`, `evidence`, `time_saving`, `client_reporting`, `change_detection`, `governance`, `other`                                                                                                                     |
| `non_purchase_reason` | `no_current_need`, `free_is_sufficient`, `price`, `missing_capability`, `trust`, `unclear_value`, `too_few_domains`, `existing_solution`, `billing_friction`, `not_decision_maker`, `other`                                             |
| `comment`             | optional free text, ≤1000 characters                                                                                                                                                                                                    |

## Interview/observation themes (§85)

For qualitative notes taken outside the structured form (interviews, observed sessions), code
each finding into one of:

```text
problem_not_relevant
category_unclear
audit_useful
audit_unclear
evidence_valuable
recommendation_unclear
monitoring_valuable
monitoring_unclear
agency_valuable
pricing_high
pricing_fair
pricing_unclear
missing_feature
reliability_problem
auth_friction
billing_friction
support_needed
```

## Problem-source distinction (§151)

Every piece of feedback must also be tagged with what actually caused it:

```text
target_site_issue     — the studied website itself is the problem (e.g. blocks CrawlPact's scanner)
product_bug           — a real CrawlPact defect
usability_issue       — the product works but is confusing
expectation_gap       — participant expected something CrawlPact doesn't do
feature_gap           — a real, reasonable capability CrawlPact doesn't have
pricing_objection      — a pricing/value disagreement, not a defect
```

A target site blocking CrawlPact's scanner is never automatically recorded as a CrawlPact
platform outage.

## Frequency discipline (§86)

One participant raising a theme is a **data point**. The same theme raised independently by
multiple participants is a **pattern**. Only patterns should influence any scope decision — a
single feature request never becomes a development roadmap.

## Defect severity (§87-91)

| Tier            | Meaning                                                                                                                                                                                    | Response                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| P0              | Security / data / billing integrity (e.g. cross-account exposure, wrong plan billed, duplicate charge, incorrect crawler-policy result, broken auth, monitoring falsely marked successful) | Fix immediately; pause pilot expansion until resolved |
| P1              | Core commercial journey blocked (e.g. signup fails, baseline can't establish, checkout can't open, payment succeeds but plan isn't granted)                                                | Fix before drawing further commercial conclusions     |
| P2              | Repeated major usability/value friction                                                                                                                                                    | Evaluate a narrow fix                                 |
| P3              | Improvement                                                                                                                                                                                | Record only                                           |
| Feature request | New capability request                                                                                                                                                                     | Route to Phase 19 unless genuinely launch-blocking    |

## Anonymous participant labelling (§158-159)

Never write a participant's real name, employer, or other identifying detail into a
repository-tracked document. Use a stable label of the form `<segment-letter>-<number>`:

```text
I-01, I-02, ...   individual
P-01, P-02, ...   professional
A-01, A-02, ...   agency / multi_site
```

The mapping from label to real `user_id` lives only in the Super Admin pilot workspace (private,
Super-Admin-only), never in a GitHub-tracked file.
