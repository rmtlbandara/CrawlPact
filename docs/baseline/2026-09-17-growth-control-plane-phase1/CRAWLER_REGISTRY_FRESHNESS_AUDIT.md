---
Document owner: Engineering owner
Status: current-authoritative (Phase 1, Workstream 2/3 — crawler registry freshness)
Verified: 2026-09-17, against live vendor documentation fetched this pass
---

# Crawler Registry Freshness Audit — 2026-09-17

Every currently governed crawler operator's primary source documentation was fetched live this
pass (not assumed current from the prior verification dates recorded in `reference-data.sql`).
Active release `2026.07.3` (published 2026-07-28) governs 23 crawlers across 9 operators, per a
live D1 read against production (see `GIT_AND_REPOSITORY_RECONCILIATION.md`).

## Per-operator findings

### OpenAI (GPTBot, OAI-SearchBot, ChatGPT-User, OAI-AdsBot)

Source: `https://developers.openai.com/api/docs/bots`. All four documented tokens match exactly
what's governed; purpose/classification for each (training / search / user-triggered / ads
validation) matches the current `crawlers` rows verbatim. **No change.**

### Anthropic (ClaudeBot, Claude-User, Claude-SearchBot)

Source: `https://support.claude.com/en/articles/8896518-...`. All three documented tokens match;
classifications match. **No change.**

### Perplexity (PerplexityBot, Perplexity-User)

Source: `https://docs.perplexity.ai/guides/bots`. Both documented tokens match; both explicitly
confirmed as _not_ used for model training, matching the current `search`/`user_triggered`
classifications. **No change.**

### Google (Googlebot, Google-Extended, Google-CloudVertexBot, GoogleOther)

Source: `https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers`. The
four governed tokens all match current documentation. Google's page additionally documents
`Googlebot-Image`, `Googlebot-Video`, `Googlebot-News`, `Storebot-Google`, and
`Google-InspectionTool` — none of which are governed. These are classic product-specific search
sub-bots (images/video/news/shopping/testing-tools), not AI-training or AI-generation-adjacent —
consistent with this registry's existing, long-standing scope (it never governed these either), not
a newly-discovered gap. **No change to governed data; scope-boundary noted for the record.**

### Common Crawl (CCBot)

Source: `https://commoncrawl.org/ccbot`. Purpose (open research corpus, reused by third-party
trainers) and user-agent token match. **No change.**

### Meta (Meta-ExternalAgent, Meta-WebIndexer, Meta-ExternalAds, Meta-ExternalFetcher)

Source: `https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/`. All four governed
tokens match current documentation exactly. The page also documents `FacebookExternalHit` (link-
preview/OG-scraper bot for shared links) — not AI-related, same "already out of scope, not a new
gap" reasoning as Google's sub-bots above. **No change.**

### Amazon (Amazonbot, Amzn-SearchBot, Amzn-User)

Source: `https://developer.amazon.com/amazonbot`. All three match exactly, including the
explicit "not used for generative AI training" statements for the latter two. **No change.**

### Microsoft/Bing (Bingbot)

Source: `https://www.bing.com/webmaster/help/which-crawlers-does-bing-use-8c184ec0`. This page is
JS-rendered and could not be fetched as static content — consistent with the pre-existing
`manual_review_required` note already recorded against this source in `reference-data.sql` (added
Phase 15, 2026-08-11, when the source URL itself last moved). Not a new problem; no automated
re-verification of this source is currently possible, by design of the existing
`docs/registry/SOURCE_VERIFICATION_POLICY.md` policy. **No change; limitation pre-exists.**

### Apple (Applebot-Extended) — real finding, acted on

Source: `https://support.apple.com/en-us/119829`, fetched twice this pass, the second time for a
verbatim quote rather than a paraphrase (to avoid over-interpreting a summarized fetch of something
this consequential). The exact text:

> "The data crawled by Applebot is used to power various features, such as the search technology
> integrated into many user experiences in Apple's ecosystem including Spotlight, Siri, and
> Safari."
>
> "Applebot crawled data may be used to provide additional context and up-to-date content when AI
> models are used to generate output for display in Apple products and services."

`Applebot-Extended` (foundation-model training, opt-out-able) was already governed. The **base**
`Applebot` was not governed at all — and Apple's own documentation now describes it performing an
AI-adjacent function (feeding live context to AI-generated output) distinct from both classic
search indexing and from Applebot-Extended's training role. Unlike the Google/Meta sub-bots above,
this is squarely inside CrawlPact's stated scope (AI-crawler policy auditing), not a deliberate
exclusion.

**Action taken:** added `crw_applebot` to `packages/database/seed/reference-data.sql`'s master
`crawlers` table, classified `mixed` (the same purpose category already used for `Amazonbot`, which
also blends a classic-service role with an AI-adjacent one), `first_verified_at`/
`last_verified_at` `2026-09-17`. Verified locally: `pnpm registry:validate` passes; the existing
active release `reg_2026_07_3`'s membership (23 crawlers) is untouched — per its own documented
immutability guarantee (RISK-018), a new master-data row is never retroactively added to an
already-published release. `crw_applebot` exists in `crawlers` but currently belongs to zero
published releases.

## Registry release decision (§9)

**Outcome A, partially** — one evidence-backed crawler addition (`Applebot`) was made to the master
data, but **no new registry release was published** in this pass. Publishing a release that
actually puts a crawler into effect for real audits is a governed, audited action
(`registry_versions`/`registry_version_entries`, checksum computation, `approved_by_user_id`) that
correctly runs through the Super Admin `/admin/registry/releases` publish workflow against a live
admin session — not something to fabricate via a raw migration or seed insert, which would bypass
the checksum/audit-trail integrity the existing governance model deliberately requires (see
`docs/registry/PHASE_00_18_REGISTRY_IMMUTABILITY_FIX.md`). This is the concrete next step once a
local dev server (or Preview/Production) admin session is available: publish release `2026.09.1`
(or similar) carrying the existing 23 crawlers plus `Applebot`, with a changelog entry citing the
Apple source above.

Every other operator's governed data was reconfirmed current and accurate. No other release change
is warranted from this pass's research.

### ByteDance (Bytespider) — investigated, deliberately not added

CrawlPact governs zero ByteDance crawlers. Checked whether this is a real gap: ByteDance's own
Bytespider crawler is reportedly among the highest-volume AI crawlers observed on the open web
(per Cloudflare Radar-adjacent third-party trackers), used to gather training data for ByteDance's
Doubao/Lark models. However, **no official ByteDance documentation exists for it anywhere** — no
vendor robots.txt statement, no published IP range, no operator-published purpose statement —
multiple independent third-party crawler-tracking sites explicitly note this as the single largest
transparency gap among major AI crawlers. Every existing CrawlPact registry entry cites an official
`official_source_url`; adding Bytespider based only on third-party blog reports would violate that
same evidentiary bar this registry holds every other entry to (`docs/registry/
SOURCE_VERIFICATION_POLICY.md`'s preference for vendor documentation over third-party sources).
**Deliberately not added.** Revisit only if ByteDance ever publishes an official statement.

## Static validation

`pnpm registry:validate`, `pnpm registry:public:validate` (24 registry records against 22 content
pages), `pnpm content:validate`, `pnpm content:links:check` (11 official source links, all live),
`pnpm brand:validate`, and `pnpm trust:validate` all pass against the current tree (one pre-existing
`brand:validate` warning — a code comment using the word "guaranteed" in
`apps/web/src/lib/admin/research.ts`, not user-facing copy — is a false positive, not a real trust
issue, and was not touched).
