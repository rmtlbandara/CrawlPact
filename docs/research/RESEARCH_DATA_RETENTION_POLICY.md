# Research data retention policy

## What exists today (Layer A only)

A single table, `research_publications` (migration `0035`). No separate corpus/run/observation
tables exist yet — see `PHASE_16_RESEARCH_DATA_MODEL.md` for why.

| Category                         | Table/field                                                         | Retention                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Publication content (any status) | `research_publications.content_json`                                | Retained indefinitely — this is the entire "dataset," not a derived artifact; there is no separate raw source to expire it against. |
| Draft/review publications        | `research_publications` where `status IN ('draft','review')`        | No automatic expiry. A Super Admin may leave a draft indefinitely; nothing publishes it automatically (§45).                        |
| Published/corrected publications | `research_publications` where `status IN ('published','corrected')` | Retained indefinitely as historical evidence — never purged while the publication is not withdrawn (§128/§176).                     |
| Withdrawn publications           | `research_publications` where `status = 'withdrawn'`                | Retained (row and `content_json` kept) so the withdrawal notice and reason remain inspectable — never hard-deleted.                 |
| Correction log                   | `research_publications.correction_log`                              | Append-only, retained for the life of the row.                                                                                      |

No raw temporary fetch artifacts exist to retain or purge, because Layer A has no fetch step —
every figure is computed from already-durable, already-governed Phase 15 registry tables.

## When Layer B is built

This document will need new sections for: corpus definitions (versioned, retained indefinitely
once frozen — §19), raw temporary fetch artifacts (bounded retention per Phase 11 minimisation,
§29), and structured observations (retained at least as long as any publication that depends on
them for reproduction, per §176). None of that exists yet, so no retention job runs for it — there
is nothing to purge.

## Integration with Phase 11/14 retention framework

Not yet integrated, since there is no bounded/temporary research data to purge. When Layer B adds
raw fetch artifacts, the purge job must be wired into the existing retention framework
(`docs/data/DATA_RETENTION.md`) rather than a new, separate mechanism, and any purge failure must
be independently observable the same way existing retention failures are (Phase 14 operational
alerting).
