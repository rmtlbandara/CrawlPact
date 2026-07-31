---
name: "GoogleOther"
operator: "Google"
userAgentToken: "GoogleOther"
purpose: "unknown"
lifecycleStatus: "active"
officialSourceUrl: "https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers"
lastVerified: "2026-07-24"
summary: "A generic Google crawler various internal product teams may use — Google's own documentation does not specify which teams or purposes."
---

Google documents `GoogleOther` as a "generic crawler that may be used by various product teams
for fetching publicly accessible content." Google also documents `GoogleOther-Image` and
`GoogleOther-Video` as variants optimised for image and video URLs respectively, both matched by
the same `GoogleOther` token.

## Why this is categorised as "unknown"

Google's own documentation deliberately does not say which product team or purpose any given
`GoogleOther` request serves — CrawlPact's registry marks this "unknown" rather than guessing,
consistent with FR-REG-005's rule against presenting an unverified classification as certain.

## Site-owner controls

Because Google's own documentation doesn't specify which product team or purpose a `GoogleOther`
request serves, what disallowing it affects is correspondingly unspecific — it may affect an
internal Google research or development use, but it does not affect Google Search indexing
(`Googlebot`) or the generative-AI-training opt-out (`Google-Extended`), which are governed by
their own separate, purpose-specific tokens. See [/limitations](/limitations) for what a
`robots.txt` rule can and cannot guarantee.
