# Phase 23 Earned Link & Mention Policy

## Policy (restating the phase prompt's non-negotiable link-spam boundary, Sections 7-10)

CrawlPact will not: buy or sell followed links, trade product/services for links, use automated
backlink software, mass-submit directories, spam comments/forums/social networks, use PBNs or fake
sites, require customers to link back, or treat any third-party authority score (DA/DR/Authority
Score) as ground truth. Paid promotion (advertising, sponsorship) is legitimate but must not be
disguised as, or bundled with, a ranking-credit link request; where a paid link exists, it is
qualified (`rel="sponsored"`/nofollow) per current Google guidance.

This is a restatement, not a new policy — nothing in Phase 23 changes it, and no code or content
change was needed to establish it, since CrawlPact has never engaged in any of the above tactics
(there is no backlink program, no directory-submission history, no PBN, no paid-link relationship
to audit or unwind).

## Verified Authority Register

The phase prompt (Section 120) asks for a register classifying every external reference as
`EDITORIAL_LINK`, `UNLINKED_MENTION`, `DIRECTORY_LISTING`, `COMMUNITY_REFERENCE`,
`PARTNER_REFERENCE`, `RESEARCH_CITATION`, `PAID_PLACEMENT`, or `OTHER`.

**Current state: empty.** No verified external link, mention, citation, or reference to CrawlPact
was found or reported this phase. Evidence sources checked:

- GA4 referral traffic (`AUTHORITY_AND_DISTRIBUTION_BASELINE.md`): no identifiable external
  referrer beyond `search.google.com` (a Google-internal referral classification, not a third-party
  site).
- Google Search Console: the Search Analytics API this tooling uses does not expose the Links
  report (confirmed structurally — same API surface investigated in Phase 22 for the Generative AI
  report, and the Links report is a documented separate Search Console feature this read-only
  `webmasters.readonly` scope and tooling was never built to reach). No owner-provided Search
  Console Links export exists this session.
- No manual web discovery of a mention was performed this phase — Section 69 explicitly forbids
  using Google `site:` search-result counts as "an authoritative backlink database," and no other
  approved discovery mechanism was available or used.

This register will gain real rows only when a real external mention is found through an approved
method (an owner-provided Search Console Links export, a publisher's own notification, or a
credible manual discovery) — not before. An empty register here is the honest state, not a gap in
this phase's execution.

## Distinguishing referral traffic from a link (Section 68)

No referral traffic with an identifiable external source domain exists in the current GA4 data to
even test this distinction against. The concepts (`REFERRAL_TRAFFIC` ≠ `VERIFIED_EXTERNAL_LINK` ≠
`UNLINKED_MENTION` ≠ `EDITORIAL_CITATION`) are recorded here for the register's future use, not
populated with data that doesn't exist.
