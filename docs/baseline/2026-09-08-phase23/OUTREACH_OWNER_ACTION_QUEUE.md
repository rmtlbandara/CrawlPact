# Phase 23 Owner Action Queue

Nothing in this file is complete merely because a draft or plan exists elsewhere in this evidence
package (Section 109's own explicit warning). Every row below requires the human product owner
specifically — none can or should be performed by an agent unilaterally, per Sections 42, 109, 110.

| #   | Action                                                                                                                                                                                                         | Why it's owner-only                                                                                          | Supporting material                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| 1   | Generate the first "AI Crawler Registry Landscape" research draft via `/admin/research` on Production, then review → submit for review → validate → publish                                                    | Requires an authenticated Super Admin session against Production, which this session correctly does not have | `RESEARCH_AUTHORITY_PLAN.md`         |
| 2   | Decide whether to enrich the registry's `Amzn-SearchBot`/`Amzn-User`/`Perplexity-User`/`PerplexityBot` descriptions with Phase 22's robots.txt-compliance facts before or after the first research publication | A registry content decision, governed by Super Admin publish workflow                                        | `RESEARCH_AUTHORITY_PLAN.md`         |
| 3   | Identify and personally invite real candidates for the external pilot (agencies/multi-site operators first, to satisfy the frozen `>= 4` threshold)                                                            | Manual recruitment is a preserved Phase 19 constraint — no scraper, no bulk contact list                     | `EXTERNAL_PILOT_RECRUITMENT_PLAN.md` |
| 4   | Review each candidate community's current self-promotion rules one at a time, immediately before any post, and decide whether/what to post                                                                     | Community-rule review must happen at the time of posting, not from a generic list prepared in advance        | `GROWTH_CHANNEL_MATRIX.md`           |
| 5   | If a research publication is published, consider a press/newsletter pitch using the pitch structure in Section 46                                                                                              | Requires an actual publication to exist first, and outreach is a human-directed act                          | `RESEARCH_AUTHORITY_PLAN.md`         |
| 6   | Decide whether/when to test a small paid-promotion budget                                                                                                                                                      | A budget commitment is a business decision this phase does not make                                          | `GROWTH_CHANNEL_MATRIX.md`           |
| 7   | Provide a Search Console Links export (or confirm none is available) so `EARNED_LINK_AND_MENTION_POLICY.md`'s register can be populated with real data if any exists                                           | The Links report is not exposed to this session's read-only API tooling                                      | `EARNED_LINK_AND_MENTION_POLICY.md`  |
| 8   | Periodically review `CONTINUOUS_GROWTH_SCORECARD.md` on the cadence in `MEASUREMENT_AND_CADENCE.md` and decide whether any `GROWTH_EXPERIMENT_REGISTER.md` entry should move to `RUNNING`                      | Ongoing operating decision                                                                                   | `MEASUREMENT_AND_CADENCE.md`         |

## Explicitly not queued

- Sending any email, DM, or community post — none is drafted for a specific real recipient/venue
  yet; item 3/4 above are the actual next steps toward that, not this file doing it for the owner.
- Making a Product Hunt/Hacker News submission — not evaluated as ready this phase
  (`GROWTH_CHANNEL_MATRIX.md`).
