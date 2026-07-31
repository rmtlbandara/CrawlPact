---
name: "Applebot-Extended"
operator: "Apple"
userAgentToken: "Applebot-Extended"
purpose: "training"
lifecycleStatus: "active"
officialSourceUrl: "https://support.apple.com/en-us/119829"
lastVerified: "2026-07-01"
summary: "Controls use of website content for training Apple Intelligence and other Apple generative AI models."
---

`Applebot-Extended` is documented by Apple as a control token for opting website content out of
use in training Apple's generative AI models, separate from the base `Applebot` crawler used for
Siri and Spotlight indexing.

## Site-owner controls

Disallowing `Applebot-Extended` opts this content out of training Apple Intelligence and other
Apple generative AI models specifically. As with Google's pairing of `Googlebot`/`Google-Extended`,
it leaves standard Apple indexing for Siri and Spotlight Suggestions (`Applebot`) unaffected — the
two tokens are evaluated independently, and `Applebot-Extended` does not itself perform a separate
crawl; it layers a training-use restriction on top of Apple's existing `Applebot` access. See
[/limitations](/limitations) for what a `robots.txt` rule can and cannot guarantee.
