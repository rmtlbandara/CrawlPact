# Phase 16 research data model

## Minimum architecture actually built

One table: `research_publications` (migration `0035_research_publications.sql`). The Phase 16
prompt's §25 sketch of a possible `research_studies`/`research_corpora`/`research_corpus_entries`/
`research_runs`/`research_observations`/`research_metrics`/`research_publications` model was
deliberately **not** built in full — "Do not automatically create all of them. Choose the minimum
architecture required by real Phase 16 outputs." Since only the Registry Observatory (Layer A)
ships, and every Layer A figure is deterministically derivable from an already-immutable Phase 15
registry release with no separate collection step, there is no corpus, no run, and no observation
to model — only the publication itself.

## `research_publications`

| Column                                                        | Type                              | Notes                                                                                                     |
| ------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `id`                                                          | TEXT PK                           |                                                                                                           |
| `slug`                                                        | TEXT UNIQUE                       | URL path segment under `/research/`                                                                       |
| `kind`                                                        | TEXT                              | `'registry_landscape'` only, this phase                                                                   |
| `status`                                                      | TEXT                              | `draft \| review \| published \| corrected \| superseded \| withdrawn`                                    |
| `title`                                                       | TEXT                              | Denormalised from `content_json` for list-view queries without a JSON parse                               |
| `methodology_version`                                         | TEXT                              | Denormalised, same reason                                                                                 |
| `registry_version_id`                                         | TEXT FK -> `registry_versions.id` | The pinned source release — never advances after generation                                               |
| `content_json`                                                | TEXT                              | The full deterministic publication body (title, summary, findings, sections, limitations, correction log) |
| `checksum`                                                    | TEXT                              | SHA-256 over `content_json` minus `generatedAt`/`correctionLog` — see `RESEARCH_METHODOLOGY.md`           |
| `correction_log`                                              | TEXT                              | JSON array, append-only                                                                                   |
| `superseded_by_publication_id`                                | TEXT, nullable FK -> self         | Modelled, not yet used                                                                                    |
| `withdrawal_reason`                                           | TEXT, nullable                    |                                                                                                           |
| `created_by_user_id`                                          | TEXT FK -> `users.id`             |                                                                                                           |
| `created_at` / `updated_at` / `published_at` / `corrected_at` | TEXT                              | ISO timestamps                                                                                            |

Indexes: `status` (list/filter queries), `registry_version_id` (reproducibility lookups by pinned
release).

## When Layer B is built

The prompt's fuller model becomes relevant: a `research_corpora`/`research_corpus_entries` pair for
versioned, frozen website lists; `research_runs` for pinned registry/ruleset/methodology/scanner-
build execution metadata; `research_observations` for normalized per-origin signal booleans (never
whole HTML — §28); and a `research_studies` parent if more than one publication kind exists. None
of this is added speculatively now.

## No customer-table coupling

`research_publications` has no foreign key to `domains`, `scans`, `users` other than
`created_by_user_id` (an internal admin attribution, never rendered publicly), or any other
customer-scoped table — enforced structurally, not just by convention. See
`PHASE_16_RESEARCH_PRIVACY_THREAT_REVIEW.md`.
