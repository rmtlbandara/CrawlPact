# Vertical page content standard

Requirements every entry in the `verticals` content collection (`apps/web/src/content/verticals/*.md`,
served at `/for/<slug>`) must meet before publication. Enforced by `pnpm content:validate` where
automatable; the rest is a human/agent review checklist.

## Required frontmatter (`apps/web/src/content.config.ts`)

`title`, `description`, `audience`, `primaryProblem`, `recommendedPlan` (must be `solo`, `pro`, or
`agency` — never `free`, since the entitlement matrix has no meaningful "recommended free plan"
framing), `publishedDate`, optional `updatedDate`/`relatedPlatformSlugs`/`relatedGuideSlugs`/
`relatedCrawlerSlugs`.

## Required sections (body content)

Per the phase prompt, each vertical page's specific required-sections list differs slightly (see
the phase prompt §14–17), but every vertical page must include, at minimum:

1. A hero stating the audience and their core problem in the visible `<h1>`/lede.
2. A section on the audience-specific risk/problem this page addresses.
3. A section describing the relevant CrawlPact workflow (audit → evidence → monitor).
4. A link to the sample report.
5. A section on current, real product capabilities relevant to this audience — sourced from the
   actual entitlement matrix (`docs/billing/APPROVED_PRICING_AND_ENTITLEMENT_MATRIX.md`), never a
   duplicated or invented capability list.
6. A pricing/plan-recommendation section that reads live pricing via `getPlanCatalog()` — never a
   hard-coded figure.
7. A methodology/trust section or link (what CrawlPact does and does not claim for this audience).
8. An FAQ (optional; only add `FAQPage` structured data if this section exists and is genuine).
9. A primary audit CTA.

## Prohibited content (sitewide product-claim rules, applied here)

- Any capability listed in the phase prompt's per-vertical "Do not claim" list (e.g., client
  portal, team roles, cross-domain comparison, daily/hourly/real-time monitoring, unlimited users,
  ownership verification — see the phase prompt §14–17 for the exact per-vertical list).
- A public country, jurisdiction, address, registration number, tax information, or phone number.
- Negative wording about absent support channels (e.g. "we don't offer live chat") — simply state
  what _is_ offered.
- A fabricated statistic, customer story, or testimonial.
- A claim that CrawlPact blocks, monetises, licenses, or enforces anything — CrawlPact audits and
  monitors published policy signals only (`BRAND.approvedBoundaryStatement`).

## Uniqueness requirement

Each vertical page must be substantively different from the other three — not a template with the
audience noun swapped. At minimum, the "primary problem," "required sections" content, and
"approved outcome themes" must reflect genuinely different concerns per audience (verified
manually against `docs/seo/SEARCH_INTENT_AND_PAGE_MAP.md`'s per-page problem statements, and
checked by `pnpm content:validate`'s thin-template-similarity warning).

## Review

See `docs/seo/CONTENT_FRESHNESS_AND_REVIEW_POLICY.md` — vertical pages: every 6 months or after a
product/pricing change.
