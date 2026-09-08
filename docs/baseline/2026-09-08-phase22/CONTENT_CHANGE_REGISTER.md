# Phase 22 Content Change Register

## `apps/web/src/content/crawlers/amazonbot.md`

- **GSC evidence**: 247 90d impressions, position 65.2; part of the ambiguous "amazonbot user
  agent" 3-way split — see `GSC_QUERY_CLUSTER_ANALYSIS.md`.
- **Intent**: REFERENCE/DEFINITIONAL, broad-owner role.
- **Reason for change**: differentiate from Amzn-SearchBot/Amzn-User with a real comparison
  resource, matching the pattern other crawler families already use.
- **Primary sources re-read**: `https://developer.amazon.com/amazonbot` (fetched fresh 2026-09-08).
- **Content sections changed**: added a "Related crawlers" section (previously only had an inline
  mention); linked to the new comparison guide.
- **Metadata changed**: `lastVerified` → 2026-09-08 (genuine re-verification against the live
  source, not a routine bump).
- **Internal links changed**: added link to `/guides/amazonbot-vs-amzn-searchbot-vs-amzn-user/`.
- **Dates changed**: `lastVerified` only, per the re-verification above.
- **Expected metric**: no change expected in Amazonbot's own position (differentiation content, not
  a ranking lever); watch whether the ambiguous-query 3-way split resolves toward clearer
  per-page ownership over the T+28/T+56 windows.
- **No-change safeguards**: the crawler's own purpose/token/summary facts were not altered — only
  new, additive facts and a cross-reference were added.

## `apps/web/src/content/crawlers/amzn-searchbot.md`

- **GSC evidence**: 33 90d impressions, position 30.7 (emerging); already owns its own exact-token
  query well (position 5-20).
- **Reason for change**: add a previously-undocumented fact — Amazon's own documentation states
  this crawler falls back to other search-bots' `robots.txt` rules if not named specifically.
- **Primary sources re-read**: `https://developer.amazon.com/amazonbot` (2026-09-08).
- **Content sections changed**: new "A `robots.txt` behaviour worth knowing" section; "Related
  crawlers" section updated to link to the new comparison guide.
- **Metadata changed**: `lastVerified` → 2026-09-08.
- **Internal links changed**: added link to the new comparison guide.
- **Expected metric**: no ranking change expected; this is an accuracy/completeness improvement.

## `apps/web/src/content/crawlers/amzn-user.md`

- **GSC evidence**: 19 90d impressions, position 22.9.
- **Reason for change**: **real factual gap** — the page previously implied a standard `Disallow`
  rule would work; Amazon's own documentation states this token "may not follow all robots.txt
  directives" because requests are user-triggered.
- **Primary sources re-read**: `https://developer.amazon.com/amazonbot` (2026-09-08).
- **Content sections changed**: new "A `robots.txt` limitation worth knowing" section; rewrote
  "Site-owner controls" to state the limitation directly instead of implying reliable compliance;
  summary field updated to carry the same caveat.
- **Metadata changed**: `lastVerified` → 2026-09-08; `summary` field text.
- **Internal links changed**: added link to the new comparison guide.
- **Expected metric**: no ranking change expected; this is a correctness fix a reader could act on
  incorrectly before this change.

## `apps/web/src/content/crawlers/perplexitybot.md`

- **GSC evidence**: 14 90d impressions, position 77.3; part of the thin Perplexity cluster.
- **Reason for change**: make the crawler's robots.txt-respecting behaviour explicit (previously
  only implied by omission), for contrast with Perplexity-User's corrected page.
- **Primary sources re-read**: `https://docs.perplexity.ai/guides/bots` (2026-09-08).
- **Content sections changed**: added a sentence to the intro; "Site-owner controls" section now
  explicitly contrasts with Perplexity-User.
- **Metadata changed**: `lastVerified` → 2026-09-08; `summary` field text.
- **Expected metric**: no ranking change expected; accuracy/completeness improvement.

## `apps/web/src/content/crawlers/perplexity-user.md`

- **GSC evidence**: 17 90d impressions, position 60.7.
- **Reason for change**: **real factual inaccuracy** — the page previously stated "Standard
  `robots.txt` disallow rules apply," directly contradicting Perplexity's own current
  documentation ("since a user requested the fetch, this fetcher generally ignores robots.txt
  rules").
- **Primary sources re-read**: `https://docs.perplexity.ai/guides/bots` (2026-09-08).
- **Content sections changed**: new "A `robots.txt` limitation worth knowing" section; rewrote
  "Site-owner controls" to state the limitation directly.
- **Metadata changed**: `lastVerified` → 2026-09-08; `summary` field text.
- **Expected metric**: no ranking change expected; this corrects information a reader could act on
  incorrectly.

## `apps/web/src/content/guides/perplexitybot-vs-perplexity-user.md`

- **Reason for change**: propagate the same robots.txt-compliance correction into the existing
  comparison guide's "The decision" section, which previously discussed only the AI-training
  distinction and omitted the (more operationally important) robots.txt-compliance difference.
- **Primary sources re-read**: same as above.
- **Content sections changed**: intro sentence, "The two tokens," "The decision."
- **Metadata changed**: `description`; added `updatedDate: 2026-09-08` (a genuine, material update
  to an existing published guide, per `EDITORIAL_SOURCE_AND_CONTENT_POLICY.md`'s rule that this
  date reflects a real recheck, not routine).
- **Expected metric**: none specific; this is a correctness fix to existing published content.

## `apps/web/src/content/guides/amazonbot-vs-amzn-searchbot-vs-amzn-user.md` (new page)

- **GSC evidence justifying a new page**: the genuine 3-way ambiguous-query split on "amazonbot
  user agent" (2 impressions to each of 3 pages) plus the combined Amazon cluster's ~299 90d
  impressions (higher than the Perplexity cluster, which already has an equivalent comparison
  guide).
- **New-page gate** (phase prompt Section 55, all 10 criteria evaluated in
  `PHASE_22_DECISIONS.md`): passed.
- **Primary sources re-read**: `https://developer.amazon.com/amazonbot` (2026-09-08).
- **Category**: `decision` (matches the existing `claudebot-vs-claude-user-vs-claude-searchbot.md`
  and `perplexitybot-vs-perplexity-user.md` pattern exactly).
- **Internal links**: linked from and to all three Amazon crawler pages; discoverable via
  `/guides/` (content-collection index, automatic) and each crawler page's own body.
- **Expected metric**: watch whether it accumulates its own impressions for the ambiguous query
  cluster over the T+28/T+56 windows, and whether the 3-way split narrows.

## `apps/web/src/content/platforms/vercel.md`

- **GSC evidence**: 43 90d impressions, position 17.6 (near-win, explicitly flagged by the phase
  prompt Section 41).
- **Primary sources re-read**: `https://vercel.com/kb/guide/are-vercel-preview-deployment-indexed-by-search-engines`
  (2026-09-08) — confirmed every claim on the page (automatic `noindex` on Preview Deployments and
  outdated Production Deployments, the custom-domain-on-branch exception) still matches Vercel's
  current documentation exactly.
- **Content sections changed**: **none.** Per Section 29 ("when content is already strong, do not
  rewrite it merely to create a diff").
- **Metadata changed**: `platformDocsVerifiedDate` → 2026-09-08 (a genuine re-verification event,
  even though the outcome was "confirmed accurate, no change").
- **Expected metric**: none — no content changed, nothing to attribute a metric shift to.

## Sitewide: internal-link canonicalization (49 content files)

See `INTERNAL_LINK_DELTA.md` for the full file list and reasoning — a mechanical fix (trailing
slash added to every bare internal link in Markdown content bodies), not a content or metadata
change to any individual page's substance.

## `apps/web/src/pages/tools/robots-txt-ai-validator.astro`

- **Reviewed, not changed.** See `SEO_OPPORTUNITY_REGISTER.md` category C — the highest-impression
  page on the site, classified CONTENT_READY–AUTHORITY_LIMITED. No content, title, or metadata
  change made; the disposition itself (documented, evidence-based inaction) is the Phase 22 output
  for this page.
