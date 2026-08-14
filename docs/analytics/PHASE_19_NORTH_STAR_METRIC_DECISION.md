# Phase 19 North-Star Metric Decision

Status: current-authoritative, 2026-08-14.

## Candidates evaluated

| Candidate                                              | For                                                                                                                     | Against                                                                                                                                                                                 |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| External activated accounts (saved ≥1 baseline domain) | Cheap to reach, signals genuine intent to use the product beyond a single free audit                                    | Doesn't require ongoing value — a one-time save could be abandoned immediately                                                                                                          |
| External monitored domains                             | Requires the user to explicitly opt into CrawlPact's core differentiator (ongoing change detection, not a one-off scan) | Slower to accumulate than raw activation; undercounts value delivered to non-monitoring users                                                                                           |
| Engaged paying accounts                                | Directly reflects willingness to pay _and_ implies retained value (a churned payer would drop out)                      | Lagging indicator — with 0 external customers today, this metric would read 0 for a long time regardless of earlier-funnel health, hiding whether the top of the funnel is even working |

## Decision

**North-star metric: external monitored domains.**

Reasoning: CrawlPact's actual product promise is "know what your website tells AI crawlers — and
when it changes" — the monitoring/change-detection loop, not a one-time audit. A domain under
active monitoring is the smallest real signal that a user has adopted the product's core
mechanism, not just sampled it. It sits between "activated" (too cheap, doesn't require ongoing
intent) and "paying" (too lagging, given the current near-zero external base — it would stay at 0
long after real engagement started building, masking whether acquisition/activation is working at
all).

This does not replace the commercial floor in `docs/pilot/PHASE_17_SUCCESS_CRITERIA.md` — paid
conversion remains the ultimate validation gate. External monitored domains is the operating
metric Phase 19 watches week to week while that evidence accumulates.

## Current value

0 (baseline, 2026-08-14 — see `docs/optimization/PHASE_19_POST_LAUNCH_BASELINE.md`; the 4
monitored domains that exist all belong to the owner's account and are excluded).

## Review

Revisit this decision once external monitored domains exceeds roughly 10 and real behavior can be
observed (§35: "choose one only after reviewing actual product behavior" — at 0 external users,
there is no real behavior to review yet beyond this reasoned choice).
