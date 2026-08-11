# Phase 16 Observatory route architecture

## Routes shipped

| Route                      | Rendering                                                                                               | Purpose                                                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/observatory`             | SSR, `Cache-Control: public, max-age=120`                                                               | Hub: Registry Observatory summary, Website Policy Observatory status (not yet published), latest research list, links to methodology/registry-releases/corrections |
| `/observatory/registry`    | SSR, `max-age=120`                                                                                      | Full Registry Observatory report: counts, distributions, operator matrix, verification freshness, release history                                                  |
| `/observatory/methodology` | Static (`prerender = true`)                                                                             | Research methodology, claim classes, missing-data/small-cell/comparability rules, corpus-decision summary                                                          |
| `/research`                | SSR, `max-age=120`, `noindex` while 0 publications exist                                                | List of published publications only                                                                                                                                |
| `/research/[slug]`         | SSR, `max-age=3600` (published/corrected) or `max-age=60` (withdrawn), `noindex` if not found/withdrawn | One publication: findings table, sections, limitations, corrections, provenance                                                                                    |
| `/admin/research`          | SSR, Super Admin only (`X-Robots-Tag: noindex` via existing `/admin` middleware rule)                   | Draft/review/publish/correct/withdraw workspace                                                                                                                    |

`/observatory/policies` (the Website Policy Observatory route) is **not created** — per §73, an
empty "coming soon" SEO page is worse than no page at all; see
`docs/research/PHASE_16_RESEARCH_CORPUS_DECISION.md`.

## Why `/research` + `/research/[slug]`, not `/observatory/research/[slug]`

§74 requires choosing one coherent architecture to avoid duplicate SEO content. `/research` was
chosen over nesting under `/observatory` because it mirrors the existing `/changelog` top-level
pattern this codebase already uses for chronological public content, and keeps the Observatory hub
itself (`/observatory`) from becoming a deep nesting root.

## `/methodology` vs `/observatory/methodology` — not merged

The pre-existing `/methodology` page (scanner-level: robots.txt evaluation, declared vs. observed
vs. actual, registry verification, signal support matrix, corrections contact) already fully owns
its route and is linked from many existing pages (`index.astro`, `changelog.astro`, `crawlers/*`,
`tools/*`, `contact.astro`, `about.astro`, `terms.astro`, `scoring.astro`). Rather than merge or
redirect it, `/observatory/methodology` is a **new, separate, dedicated research-methodology page**
that cross-links to `/methodology` (and specifically `#registry-verification`/`#corrections`) for
the underlying scanner/registry explanation, per §87's "prefer a dedicated research methodology
when complexity warrants it." No existing `/methodology` link was changed.

## Sitemap

`/observatory`, `/observatory/registry`, `/observatory/methodology` were added to
`apps/web/src/pages/sitemap.xml.ts`'s `STATIC_ROUTES`. `/research` and `/research/[slug]` were
**deliberately excluded** — that file is `prerender = true` (build-time, no D1 binding available),
so it cannot reflect which publications are actually published, and nothing is published yet.
Revisit once a first publication ships (a build-time D1 query isn't possible; either move sitemap
generation to SSR, matching the `for/[slug].astro` precedent, or accept the gap and rely on
`/research`'s own internal link plus the Observatory hub for discovery).

## Caching

Follows Phase 11's established public-cache policy (`docs/performance/PUBLIC_CACHE_POLICY.md`):
every new page was read in full before adding `Cache-Control: public`, confirming no
session/cookie-dependent rendering. `/observatory*` uses `max-age=120` (changes only on registry
publication, which is infrequent but the hub reasonably expects to look current).
`/research/[slug]` uses a long `max-age=3600` for published/corrected content (genuinely immutable
between corrections) and a short `max-age=60` for withdrawn content (so a withdrawal propagates
quickly). `/admin/research` is never publicly cached.
