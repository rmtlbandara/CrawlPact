# Phase 17 Participant Qualification

Status: current-authoritative.

## Qualification (§23)

A qualified pilot participant should:

- be external to the CrawlPact product team
- own/manage or advise on at least one real public website
- have a genuine reason to care about AI crawler policy
- be able to evaluate the audit report meaningfully
- be willing to use CrawlPact independently (not merely be walked through it)
- be willing to provide structured feedback

For Agency-segment validation specifically, prefer participants actually managing multiple
domains for multiple clients/sites.

## Segments (§22, §35)

| Segment enum   | Description                                           | Maps to plan interest                         |
| -------------- | ----------------------------------------------------- | --------------------------------------------- |
| `individual`   | Individual website operators                          | Potential Solo users                          |
| `professional` | SEO professionals / developers / SaaS operators       | Potential Pro users                           |
| `agency`       | Agencies / consultants managing multiple client sites | Primary Agency/Pro commercial audience        |
| `multi_site`   | Non-agency operators of several of their own sites    | Also primary commercial audience              |
| `other`        | Doesn't cleanly fit the above                         | Recorded honestly, not forced into a category |

Segment is recorded from the participant's **actual stated role**, never inferred automatically
from domain count (§35) — a Super Admin sets it manually when adding the participant.
Recruitment should be weighted toward `agency`/`multi_site` (§22, §121), since CrawlPact's
primary commercial audience is agencies and multi-site teams.

## Exclusions from commercial metrics (§24)

The following are excluded from paid-conversion / willingness-to-pay / revenue-validation counts,
even if they otherwise behave like a pilot participant:

- the product owner
- employees or contractors
- close internal testers acting on instruction
- synthetic/QA test accounts
- reimbursed purchases
- complimentary (`comped_usability`) paid access

They may still contribute **usability** evidence (e.g. "did the onboarding flow work") when
clearly labelled as internal, but never commercial evidence.

**Already-identified exclusion**: the two existing production subscriptions (Solo, Agency) belong
to the product owner's own Super Admin account — see
`docs/pilot/REAL_PAID_CHECKOUT_VALIDATION_PROTOCOL.md`. If this account is ever added to a pilot
cohort for technical-dry-run purposes, it must be labelled internal/owner and excluded from every
commercial metric.

## Recruitment responsibility (§26, §194)

Recruitment is a manual, one-to-one owner action. This repository/session adds no email
provider, CRM, outbound-automation, SMS, or lead-scraping infrastructure, and never pretends to
have recruited anyone. Until the product owner records real participants, cohort/participant
counts are honestly `0`.
