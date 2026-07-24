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

## Related crawler

As with Google's pairing of `Googlebot`/`Google-Extended`, disallowing `Applebot-Extended` alone
leaves standard Apple indexing (`Applebot`) unaffected.
