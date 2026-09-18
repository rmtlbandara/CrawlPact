---
Document owner: Engineering owner
Status: current-authoritative (Phase 2, §18-19 — observatory hub / orphan-page audit)
---

# Observatory Orphan-Page Fix — 2026-09-18

Per Phase 2 §18 (research/observatory hub readiness) and §19 (orphan-page audit), checked whether
every content section is reachable from real site navigation, not just present in the sitemap.

## Method

Checked `SiteHeader.astro`'s and `SiteFooter.astro`'s actual link config arrays (not a literal
`href="..."` grep, which misses dynamically-rendered nav items), then cross-checked which pages
have zero inbound links from anywhere outside their own section.

## Real gap found and fixed

`/observatory/` — a live, data-rich page (real registry snapshot via
`getRegistryObservatorySnapshot()`, real published-research listing, its own analytics event) —
was in the sitemap (`route-registry.ts` includes `/observatory`, `/observatory/registry`,
`/observatory/methodology`) and therefore crawlable, but had **zero internal links** from
anywhere else on the site: not the header nav, not the footer, not the homepage, not any crawler
or guide page. The only links to it were from within the observatory pages themselves. A page
that ranks well requires more than sitemap presence — internal link equity and real user
discoverability both depend on being linked from somewhere a visitor (or a crawler following
links, as opposed to just reading a sitemap) would actually reach it.

**Fixed**: added "Observatory" to `SiteFooter.astro`'s "Resources" column, alongside the existing
Guides/Methodology/Scoring/Scanner links — the natural, lowest-risk placement matching how
`/platforms/` and `/for/*` are already surfaced (footer, not primary nav, given the primary nav's
existing width constraints documented in `SiteHeader.astro`'s own comments). This makes
`/observatory/` reachable from every page on the site, not just by direct URL or search-engine
sitemap crawl.

Verified: the existing `site-footer-trust-links.test.ts` (7 tests, allow-list style — asserts
required trust links exist, does not enumerate every link) passes unchanged; `prettier --check`
passes on the changed file.

## `/research/` — correctly left unlinked, not a gap

`/research/` has the same zero-external-inbound-links profile, but this is a deliberate, already
-documented decision (`docs/product/PHASE_16_OBSERVATORY_ROUTE_ARCHITECTURE.md`,
referenced in `sitemap.xml.ts`'s own comment): it's excluded from the sitemap too, because nothing
is published there yet (confirmed empty in `RESEARCH_PUBLICATION_EVIDENCE.md`). Promoting an
empty research hub in navigation before the first publication ships would be exactly the "expose
an empty/thin research hub as if it already contains a mature publication library" failure mode
Phase 2 §18 explicitly warns against. Revisit navigation placement once the registry release and
first research publication (both owner-gated, see `REGISTRY_RELEASE_DECISION.md` and
`RESEARCH_PUBLICATION_EVIDENCE.md`) are live.

## `/platforms/` and `/for/*` — checked, not orphaned

Initial grep for literal `href="/platforms/"` / `href="/for/"` strings returned nothing, which
looked like a second orphan candidate — but both nav and footer render links from a config array
(`href={link.href}`), so the literal-string grep was the wrong tool. Reading the actual config
confirmed `/platforms/` is in the primary header nav and `/for/*` (all 4 verticals) is in the
footer's "Solutions" column. No gap here — a methodology lesson for this audit, not a site defect.

## Deployment note

This is a runtime-visible change (`SiteFooter.astro` renders on every public page). Per the
established pattern this session, it will be merged to `main` once CI is green, but **not**
deployed to Production automatically — that remains a separate, explicitly-authorized owner
action, to be bundled with other Phase 2 runtime-visible changes into a deliberate release batch
rather than triggered per-merge.
