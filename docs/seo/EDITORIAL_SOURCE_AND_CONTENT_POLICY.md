# Editorial and Source Governance Policy

This is CrawlPact's central editorial policy: who is responsible for public content, what counts
as an acceptable source, how content gets reviewed and corrected, and how automation may be used
in producing it. It applies to every public content type: crawler-reference pages
(`apps/web/src/content/crawlers/*.md`), guides (`apps/web/src/content/guides/*.md`), free-tool
pages, `/methodology`, `/scoring`, `/scanner`, comparison/decision content, vertical landing pages
(`apps/web/src/content/verticals/*.md`, Phase 7), platform guides
(`apps/web/src/content/platforms/*.md`, Phase 7), and any future SEO article added to the site.

It does not replace the narrower policies it builds on:

- `docs/registry/SOURCE_VERIFICATION_POLICY.md` — the specific standard for verifying a crawler
  registry record's operator, token, and purpose.
- `docs/seo/SEO_CONTENT_GOVERNANCE.md` — content-minimum tracking and the no-thin-pages rule.
- `docs/registry/CRAWLER_REGISTRY_GOVERNANCE.md` — how registry releases are versioned.
- `docs/seo/AI_ASSISTED_CONTENT_GOVERNANCE.md` (Phase 7) — this policy's "How automation assists
  content production" section applied concretely to vertical/platform content.
- `docs/content/VERTICAL_PAGE_CONTENT_STANDARD.md` and
  `docs/content/PLATFORM_GUIDE_CONTENT_STANDARD.md` (Phase 7) — the specific required-sections and
  prohibited-claims lists for each new content type.

Where this document and those disagree, the narrower, more specific document governs its own
area; this document governs everything those don't already cover.

## Who creates CrawlPact content

Content is published under organizational authorship — **"CrawlPact"** or **"CrawlPact Editorial
Team"** — not an invented individual byline. CrawlPact does not have named public authors,
credentialed reviewers, or a research staff to attribute content to, and inventing one (a fake
name, a fake bio, a fake "years of experience" claim) would be exactly the kind of fabricated
expertise this policy exists to prevent. If that changes and a real person takes editorial
ownership of a content area, attribute it to them by name at that point — not before.

## How automation assists content production

Some of CrawlPact's content, including parts of this document, has been drafted with AI
assistance (an AI coding agent operating under a human product owner's direction) rather than
written entirely by hand. This is stated plainly rather than concealed, consistent with the
"rules against fabricated expertise" below — claiming purely human authorship for AI-assisted
work would itself be a fabrication.

AI assistance changes _who drafts_ content; it does not change _what's required_ of it:

- Every factual claim about a crawler, specification, or standard must still trace to a primary
  source (see "Acceptable sources" below) — an AI assistant proposing a fact without a citable
  primary source is a draft to verify, not a fact to publish.
- AI-assisted drafts go through the same review expectations as any other draft (see
  "Content-review workflow"); publication is a decision the responsible human product owner makes,
  not something an agent does unilaterally and unreviewed.
- AI assistance must never be used to manufacture the appearance of a larger editorial team,
  additional reviewers, or human expertise that doesn't exist.
- "Last verified" and "last updated" dates reflect when the underlying claim was actually
  rechecked against a primary source, not when a file was last touched — see
  `docs/registry/CRAWLER_REGISTRY_GOVERNANCE.md`'s note on this for the registry specifically, and
  "artificial freshness" below for the general rule.

## Why CrawlPact publishes each content type

- **Crawler-reference pages**: the primary reason CrawlPact's registry is useful — a single,
  source-cited answer to "what does this crawler token do."
- **Guides**: answer a specific, real configuration or troubleshooting question (e.g., "why isn't
  this robots.txt rule blocking a crawler") — not written to hit a word count or keyword target.
- **Free tools**: let someone check one signal without running a full audit, and demonstrate the
  same parser the paid product uses.
- **Methodology/scoring/scanner pages**: the trust and reproducibility case for the product —
  what CrawlPact evaluates, how, and what it deliberately does not claim.
- **Comparison/decision content**: helps a reader choose between two adjacent options (e.g., two
  similarly-named crawler tokens) where the official documentation alone doesn't make the
  distinction obvious.

Content that doesn't serve one of these purposes for a real reader question shouldn't be
published merely to increase page count — see `SEO_CONTENT_GOVERNANCE.md`'s no-thin-pages rule.

## Acceptable sources

In priority order, for any factual claim about a crawler, specification, or standard:

1. **The operator's own current documentation** (e.g., `developers.openai.com`,
   `support.claude.com`, `developers.google.com`) — the only acceptable source for a crawler's
   user-agent token, purpose, or documented behaviour.
2. **The current text of the relevant standard or specification itself** (e.g., RFC 9309 at
   `rfc-editor.org`/`datatracker.ietf.org`, a proposal's own canonical site such as `llmstxt.org`
   or `rslstandard.org`) — for claims about what a specification says or its maturity/governance
   status.
3. **Official Cloudflare, Paddle, or Astro documentation** — for claims about this product's own
   infrastructure behaviour.
4. **The relevant platform's own official documentation, repositories, and changelogs** (Phase 7
   platform guides — e.g. Cloudflare, WordPress, Shopify, Vercel, Netlify) — the only acceptable
   source for a claim about how that specific platform serves `robots.txt`, headers, or other
   crawler-policy-relevant public signals. See `docs/seo/PLATFORM_CLAIM_SOURCE_REGISTER.md` for
   the per-claim evidence this produced.

**Not acceptable as a primary source, ever**: SEO blogs, "list of AI bots" aggregator sites,
forum posts, social media claims, or a competitor's marketing copy — even to corroborate something
plausible. If only a secondary source can be found for a claim, the content states that
explicitly (as `docs/registry/CRAWLER_REGISTRY_GOVERNANCE.md`'s Bingbot exception already does)
rather than publishing it with unearned confidence.

## How conflicting operator documentation is handled

When two official pages from the same operator disagree, or a page contradicts what's currently
published:

1. Prefer the more recently updated page (check any visible "last updated" date on the source
   itself).
2. Prefer the more specific page over a general overview page.
3. If genuinely unresolvable, publish the more conservative/qualified claim and note the ambiguity
   in the content rather than picking one arbitrarily and hiding the conflict.
4. Record what was found and why a choice was made — future re-verification passes need that
   context, not just the final answer.

## How last-verified dates are assigned

A "last verified" or "last updated" date changes only when the underlying claim was actually
rechecked against a current primary source and confirmed (or corrected) — never as a matter of
routine, and never to make a page look fresher than the work that was done. This rule already
governs the crawler registry (`CRAWLER_REGISTRY_GOVERNANCE.md`) and applies identically to guides,
methodology, and every other page type with a visible date.

## Content-review workflow

Before publishing new or materially changed content:

1. Every crawler or specification claim is checked against an acceptable source (above), not
   assumed from general knowledge or a prior draft.
2. The claim is checked against what's already live elsewhere on the site (e.g., a guide's
   description of a crawler must match that crawler's own reference page) — internal consistency,
   not just external accuracy.
3. The content is checked against the non-negotiable product-language rules already in force
   sitewide (no fabricated statistics/customers/testimonials, no "guaranteed"/"100% compliant"
   language, no implying crawler obedience) — see `CLAUDE.md` and `docs/status/KNOWN_RISKS.md`.
4. The responsible human product owner reviews and approves publication — this is a human
   decision point, not an automated one, regardless of whether a draft was AI-assisted.

## How guide updates are reviewed

A guide is updated (not just re-dated) when: the underlying fact it describes has actually
changed (e.g., an operator renamed a token), a reader-facing error is found, or a related guide's
content has diverged and needs reconciling. Merging or removing a guide that substantially
duplicates another's search intent follows `SEO_CONTENT_GOVERNANCE.md`'s existing rule.

## How corrections are submitted and processed

At present, CrawlPact does not have a published public correction-submission channel (a security
or content-error contact address requires a verified legal/business contact, which is not yet
established — see `docs/status/KNOWN_RISKS.md` and the legal-information checklist referenced
from `docs/status/`). Until that exists:

- Do not publish an invented contact address or form to appear to satisfy this requirement.
- Internally, a correction is handled the same as any other content update: re-verify against a
  primary source, update the content and its last-verified date together, and — for registry
  entries specifically — follow the versioned-release process in
  `CRAWLER_REGISTRY_GOVERNANCE.md` rather than silently editing a published release.
- Adding a real public correction mechanism is a tracked follow-up, not an open-ended deferral —
  see the legal-information checklist for what unblocks it.

## Rules against fabricated expertise, fake authors, and artificial freshness

- Never invent a human author, credential, job title, "years of experience," or editorial board
  member.
- Never invent or imply a review process, certification, or audit that didn't happen.
- Never change a "last updated" date without a real, substantive recheck (see above).
- Never cite a source that wasn't actually consulted, or imply a broader research process (e.g.,
  "our research team surveyed...") than what actually took place.
- Where AI assistance was used, don't obscure that fact behind generic "our team" language that
  implies a human-only process.

## Quality-control requirements

- Every published crawler or specification claim traces to a source from the "Acceptable sources"
  list above, checkable by a reader.
- No content is published purely to hit a page-count or keyword target (`SEO_CONTENT_GOVERNANCE.md`).
- Every page has a unique title, description, and search intent — no near-duplicate content
  competing with an existing page for the same query.
- Sitewide product-language rules (no fabricated proof points, no overclaiming crawler obedience,
  no unqualified "standard" claims for non-standards) apply to every content type covered by this
  document, not only to marketing pages.
