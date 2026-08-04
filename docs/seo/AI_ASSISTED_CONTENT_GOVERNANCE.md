# AI-assisted content governance (Phase 7)

This is Phase 7's specific instantiation of the AI-assistance rules already established sitewide
in `docs/seo/EDITORIAL_SOURCE_AND_CONTENT_POLICY.md` ("How automation assists content production"
and "Rules against fabricated expertise, fake authors, and artificial freshness"). That document
remains the authoritative, general policy; this document does not restate it in full — it applies
it concretely to the vertical/platform content this phase adds, per the phase prompt's explicit
requirement for a named `AI_ASSISTED_CONTENT_GOVERNANCE.md` file.

## Permitted use

An AI coding agent, operating under this repository's product owner's direction, may:

- Organise research findings (e.g., a platform's documented `robots.txt` behaviour) into a
  structured draft.
- Draft page outlines and prose from verified source material.
- Run consistency checks against existing site copy (terminology, claims, pricing).
- Compare multiple official-source pages for a platform and summarise agreement/disagreement.
- Suggest metadata (titles, descriptions) within the constraints `docs/seo/SEO_CONTENT_GOVERNANCE.md`
  already sets.

## Prohibited use

- AI assistance must never substitute for actually reading a cited official source — a claim is
  verified when the source document was actually fetched and read this session, not when it
  merely "sounds right" from general model knowledge.
- Never publish AI-generated code (example configuration snippets) without confirming the syntax
  against the platform's own current documentation.
- Never publish a citation the agent did not actually retrieve and read in this session — an
  invented or remembered-but-unverified URL is not a source.
- Never fabricate first-hand experience with a platform ("in our testing...", "we've found...")
  the agent did not actually perform.
- Never claim a manual human expert review occurred unless the product owner explicitly performed
  one — draft-then-publish by an AI agent under product-owner direction is disclosed as exactly
  that, not upgraded to "reviewed by our team."
- Never generate a large set of near-identical pages by substituting only a platform or audience
  name — each Phase 7 page must independently satisfy the uniqueness requirements in
  `docs/content/PLATFORM_GUIDE_CONTENT_STANDARD.md` / `docs/content/VERTICAL_PAGE_CONTENT_STANDARD.md`.

## Verification workflow

For every platform-specific technical claim added in Phase 7:

1. Fetch the current official documentation page for the claim (see source priority in
   `docs/seo/EDITORIAL_SOURCE_AND_CONTENT_POLICY.md`'s "Acceptable sources").
2. Record the claim, source, and access date in `docs/seo/PLATFORM_CLAIM_SOURCE_REGISTER.md`
   before the claim is written into a published page.
3. If the official source does not clearly support the claim, either remove it, label it
   explicitly as an inference, or label it as a CrawlPact-observed result (only if genuinely
   observed via the product's own scanner/methodology) — never present an inference as
   documented platform behaviour.
4. Cross-check the claim against anything already published elsewhere on the site (e.g., a
   platform guide describing Cloudflare must not contradict `/methodology`'s own description of
   what CrawlPact evaluates).

## Source checks

- Every published platform guide must link a visible "Official references" section built directly
  from the same `officialSources` frontmatter array the source register cites — the visible page
  and the internal register can never independently drift, since both read the same list (see
  `apps/web/src/content.config.ts`'s `platforms` collection schema).
- A source that returns an error or has moved is not silently dropped — see
  `docs/seo/CONTENT_FRESHNESS_AND_REVIEW_POLICY.md`'s broken-source handling.

## Reviewer responsibility

Per `docs/seo/EDITORIAL_SOURCE_AND_CONTENT_POLICY.md`: "The responsible human product owner
reviews and approves publication — this is a human decision point, not an automated one, regardless
of whether a draft was AI-assisted." For this phase specifically, that review happens at the pull
request stage — the PR description's "Official-source governance" section (required by the phase
prompt's PR template) is what the product owner reviews before merge, alongside the rendered pages
themselves.

## Correction process

Unchanged from the sitewide policy: `docs/seo/EDITORIAL_SOURCE_AND_CONTENT_POLICY.md`'s "How
corrections are submitted and processed" applies identically to Phase 7 content — corrections route
to `support@crawlpact.com` (see `apps/web/src/lib/trust-config.ts`'s `correctionsContact`), and a
correction is handled as a real content update (re-verify against the primary source, update the
content and its `platformDocsVerifiedDate`/`updatedDate` together), never a silent edit with no
freshness signal.

## Publication gate

A Phase 7 page may not be published (i.e., may not have its frontmatter committed to `main`)
unless, at minimum:

- Every technical claim has a corresponding `docs/seo/PLATFORM_CLAIM_SOURCE_REGISTER.md` entry
  (platform guides) or is a verified product/pricing fact sourced from the existing central
  configuration, never invented (vertical pages).
- `pnpm content:validate` passes for the page (see `docs/seo/SEO_CONTENT_GOVERNANCE.md`'s
  Phase 7 addendum for what this checks).
- The page has a `platformDocsVerifiedDate` (platform guides) that reflects an actual, dated check
  performed this phase, not a copy-pasted or estimated date.
- No prohibited claim (unsupported feature, false partnership/integration, fabricated metric,
  public country/address) appears anywhere in the page.

Where a platform's official documentation was too account-specific, too thin, or too
unstable to support a genuinely useful public guide meeting this bar, publication was deferred
rather than forced — see the Phase 7 completion report for which platforms (if any) this applied
to and why.
