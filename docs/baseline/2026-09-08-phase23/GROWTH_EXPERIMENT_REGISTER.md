# Phase 23 Growth Experiment Register

Format established this phase, per Section 73. **No experiment has been started** — nothing below
is `RUNNING`. Per Section 73's own instruction ("do not call every marketing action an experiment
if no hypothesis or measurement exists"), this phase does not retroactively label prior activity
as an experiment, and does not launch one merely to populate this register.

## Register format

| Field               | Description                                                                            |
| ------------------- | -------------------------------------------------------------------------------------- |
| ID                  | `EXP-NNN`, assigned sequentially when an experiment actually starts                    |
| Hypothesis          | One sentence, falsifiable                                                              |
| Audience            | Who is targeted                                                                        |
| Channel             | Where                                                                                  |
| Asset               | What's being promoted                                                                  |
| Baseline            | The metric's value immediately before the experiment starts                            |
| Primary metric      | The one number that decides the outcome                                                |
| Secondary metric    | Supporting context                                                                     |
| Guardrails          | What would make this stop regardless of the primary metric (e.g., community complaint) |
| Start date          | —                                                                                      |
| Minimum observation | How long before drawing a conclusion                                                   |
| Cost                | Actual spend, if any                                                                   |
| Owner               | Human accountable                                                                      |
| Outcome             | Raw numerator/denominator, not a bare percentage                                       |
| Decision            | `CONTINUE` / `SCALE` / `MODIFY` / `STOP` / `INCONCLUSIVE`                              |
| Evidence            | Link to the actual data                                                                |

## Candidate first experiments (not yet started)

These are proposals, explicitly not entries — they become real rows only once a human starts one
and there is a real baseline/outcome to record.

1. **Technical-community post for one comparison guide** (e.g., the new Amazon comparison guide,
   in one specific, rules-reviewed technical community). Hypothesis: a genuinely useful,
   non-promotional post linking a comparison guide produces at least one qualified audit start
   within 7 days. Guardrail: stop immediately if the community's moderators object.
2. **Registry Landscape research publication distribution** (once published — see
   `RESEARCH_AUTHORITY_PLAN.md`). Hypothesis: a real, citable research publication produces at
   least one referral session or one unlinked mention within 28 days. This is naturally sequenced
   after item 1 in `OUTREACH_OWNER_ACTION_QUEUE.md`.

Neither is started. Both require the owner action queue's items to happen first.
