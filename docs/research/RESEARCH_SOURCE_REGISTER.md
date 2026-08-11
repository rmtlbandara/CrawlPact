# Research source register

Internal file — do not expose private repository paths publicly (§86). Tracks the sources behind
Policy Observatory research claims.

| Source                                                                                                  | Claim supported                                                                                       | Source type                     | Access date                          | Publication/research use                                                                                            |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `packages/database` `registry_versions`/`registry_version_entries` (Phase 15, this repository's own D1) | All Registry Observatory crawler/operator/purpose/lifecycle/release-history figures                   | First-party, internal, verified | Continuous (live at generation time) | "AI Crawler Registry Landscape" publication                                                                         |
| `docs/registry/PHASE_15_FULL_SOURCE_REVERIFICATION_REPORT.md`                                           | Underlying crawler-record verification (not re-cited per finding, cited once as the provenance chain) | First-party, internal           | 2026-08-11 (Phase 15)                | Methodology page cross-reference                                                                                    |
| Each crawler's own `officialSourceUrl` field (operator-controlled documentation)                        | The ultimate primary source for any individual crawler's classification                               | Operator-controlled, external   | Per Phase 15 reverification pass     | Not re-cited per Registry Observatory finding (aggregate-level, not per-crawler) — available via `/crawlers/[slug]` |

No SEO aggregator, third-party crawler-list site, or AI-generated classification is used as a
source for any published claim, matching the standing rule established in Phase 15's source
verification policy (`docs/registry/SOURCE_VERIFICATION_POLICY.md`).

Add a new row here whenever a new claim class or data source is introduced — before publication,
not after.
