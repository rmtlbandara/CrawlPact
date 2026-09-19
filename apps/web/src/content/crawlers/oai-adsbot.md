---
name: "OAI-AdsBot"
operator: "OpenAI"
userAgentToken: "OAI-AdsBot"
purpose: "advertising_validation"
lifecycleStatus: "active"
officialSourceUrl: "https://developers.openai.com/api/docs/bots"
lastVerified: "2026-07-24"
summary: "Validates the safety and relevance of web pages submitted as ads on ChatGPT — not used for AI training."
---

OpenAI documents `OAI-AdsBot` as the crawler used "to validate the safety of web pages submitted
as ads on ChatGPT. When you submit an ad, OpenAI may visit the landing page to ensure it complies
with our policies." OpenAI's documentation states the data it collects "is not used to train
generative AI foundation models."

## Why this is different from GPTBot

`OAI-AdsBot` only visits pages that have been submitted as ChatGPT ads, for compliance and
relevance checks — it is unrelated to `GPTBot`'s training-data collection or `OAI-SearchBot`'s
search indexing.

## Published IP ranges

OpenAI publishes `OAI-AdsBot`'s IP ranges at `https://openai.com/adsbot.json`, which is the
documented way to recognise its requests.

## Site-owner controls

OpenAI's bots page does not say whether `OAI-AdsBot` honours `robots.txt` — its `robots.txt`
guidance names only `OAI-SearchBot` and `GPTBot` (wording checked 2026-09-19). Because the
crawler "only visits pages submitted as ads," the practical control is whether an ad is submitted
for that landing page, not a `robots.txt` rule; treat a `Disallow` for this token as a declared
preference of unconfirmed effect. See [/limitations](/limitations/) for what a `robots.txt` rule
can and cannot guarantee.
