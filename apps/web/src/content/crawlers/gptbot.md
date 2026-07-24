---
name: "GPTBot"
operator: "OpenAI"
userAgentToken: "GPTBot"
purpose: "training"
lifecycleStatus: "active"
officialSourceUrl: "https://developers.openai.com/api/docs/bots"
lastVerified: "2026-07-24"
summary: "Used by OpenAI to crawl publicly accessible web content that may be used to train future models."
---

GPTBot identifies itself with the user-agent token `GPTBot` and is documented by OpenAI as a
crawler used to collect content that may inform the training of future OpenAI models.

## What blocking GPTBot does

Disallowing `GPTBot` in `robots.txt` signals that a website does not want its content used for
this specific training purpose. It does not affect OpenAI's other documented crawlers, such as
`OAI-SearchBot` (search) or `ChatGPT-User` (user-triggered retrieval), which are evaluated and
reported separately by CrawlPact.

## Verifying this record

Always cross-check the current token and behaviour against OpenAI's own crawler documentation
before relying on this page for a production decision — crawler documentation can change
between CrawlPact's registry releases. OpenAI's crawler documentation moved from
`platform.openai.com/docs/bots` to `developers.openai.com/api/docs/bots` since this record was
first added; the citation above reflects the current location as of the last-verified date.
