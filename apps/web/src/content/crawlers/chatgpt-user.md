---
name: "ChatGPT-User"
operator: "OpenAI"
userAgentToken: "ChatGPT-User"
purpose: "user_triggered"
lifecycleStatus: "active"
officialSourceUrl: "https://developers.openai.com/api/docs/bots"
lastVerified: "2026-07-24"
summary: "Fetches a web page in direct response to a user's question inside ChatGPT or a Custom GPT."
---

OpenAI documents `ChatGPT-User` as the crawler used "when users ask ChatGPT or a CustomGPT a
question" and it "may visit a web page" to help answer it, including when a Custom GPT takes an
action against an external site through GPT Actions.

## Why this is different from GPTBot

`ChatGPT-User` requests are triggered by a specific person's question, not a bulk crawl. It is
tracked separately in CrawlPact's registry from the training-purpose `GPTBot` and the
search-purpose `OAI-SearchBot` — a website can restrict one without restricting the others.

## A `robots.txt` limitation worth knowing

OpenAI's own documentation states: "Because these actions are initiated by a user, robots.txt
rules may not apply." A `Disallow` rule aimed at `ChatGPT-User` is therefore not a reliable way to
prevent a specific page from being fetched on a person's behalf — this is OpenAI's documented
position (wording checked against its bots page on 2026-09-19), not a CrawlPact-observed
workaround. See [/limitations](/limitations/) for what a `robots.txt` rule can and cannot
guarantee more generally.

## Site-owner controls

A `robots.txt` rule for `ChatGPT-User` may not be honoured, per OpenAI's own documentation above —
unlike the search- and training-purpose tokens, where OpenAI's page makes no such statement. It
does not affect `GPTBot` (training) or `OAI-SearchBot` (search), each governed by its own token.

## Note on this page's source

OpenAI's crawler documentation moved from `platform.openai.com/docs/bots` to
`developers.openai.com/api/docs/bots` since this record was first added — the citation above
reflects the current location as of the last-verified date.
