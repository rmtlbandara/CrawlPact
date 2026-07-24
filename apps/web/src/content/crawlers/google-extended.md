---
name: "Google-Extended"
operator: "Google"
userAgentToken: "Google-Extended"
purpose: "training"
lifecycleStatus: "active"
officialSourceUrl: "https://developers.google.com/search/docs/crawling-indexing/google-extended"
lastVerified: "2026-07-01"
summary: "Controls use of website content for training Gemini and Vertex AI generative models, independent of Search indexing."
---

`Google-Extended` is a control token, documented by Google, that lets a website opt out of
having its content used to train Gemini and Vertex AI generative APIs — without affecting
Google Search indexing, which is governed separately by `Googlebot`.

## Why this one is easy to get wrong

Disallowing `Googlebot` blocks Search indexing entirely. Disallowing only `Google-Extended`
leaves Search indexing intact while opting out of generative-model training use. Confusing the
two is one of the most common policy conflicts CrawlPact's conflict detector looks for.
