# Phase 16 — Policy Observatory Event Model (Analytics)

5 new categorical events, appended to `apps/web/src/lib/analytics.ts`'s `PRODUCT_EVENT_NAMES`
following the established convention (a `const` array, `trackEvent()`/`AnalyticsBeacon` as the only
write paths — no third-party analytics vendor).

| Event                            | Fired from                                                                                     | Properties     |
| -------------------------------- | ---------------------------------------------------------------------------------------------- | -------------- |
| `observatory_viewed`             | `/observatory` hub, `<AnalyticsBeacon client:load>` on mount                                   | none           |
| `observatory_registry_viewed`    | `/observatory/registry`, on mount                                                              | none           |
| `observatory_methodology_viewed` | `/observatory/methodology`, on mount                                                           | none           |
| `research_index_viewed`          | `/research`, on mount                                                                          | none           |
| `research_publication_viewed`    | `/research/[slug]`, on mount, only when a real publication is rendered (not on the 404 branch) | `slug: string` |

## Never sent as a property

Research study internal IDs (`research_publications.id`), registry version IDs, publication
checksums, correction log content, admin user IDs, or any customer identifier — none of these are
ever passed to `AnalyticsBeacon`. `slug` is the only property, and it identifies a _public_
publication URL segment, not a private value — matching `PROHIBITED_PROPERTY_KEY_PATTERN`'s
existing checks (no `email`/`domain`/`url`/`token`/etc.-shaped key is used).

## GA boundary

`apps/web/src/lib/consent.ts`'s `isGaEligibleRoute()` is a strict **allowlist**
(`GA_ALLOWED_EXACT`/`GA_ALLOWED_PREFIXES`), not an opt-out list — a route gets consented GA only if
explicitly added. `/observatory*` and `/research*` were **not** added this phase, so no GA loads on
them regardless of consent state; only CrawlPact's own first-party `product_events` (the five
events above) are recorded. This matches §145 exactly ("Public research pages may receive consented
GA only if deliberately included in the existing marketing route allowlist") — inclusion is
optional, and this phase chose not to add it, to avoid expanding GA's surface without a specific
need. Add `/observatory`/`/observatory/`/`/research/` to the allowlist in a future pass if GA
coverage for these pages is explicitly wanted.
