---
title: "How to block only AI training crawlers, without blocking AI search"
description: "A step-by-step implementation guide for writing robots.txt groups that restrict training-purpose crawlers while leaving search-purpose crawlers untouched."
category: "implementation"
publishedDate: "2026-07-24"
---

This is the practical, step-by-step version of the decision covered in
[Blocking AI training while staying visible in AI search](/guides/blocking-ai-training-while-staying-visible-in-ai-search) —
how to actually write the `robots.txt` groups.

## Step 1: List the training-purpose tokens you want to restrict

Using CrawlPact's [crawler directory](/crawlers), identify which documented crawlers are
categorised `training` for the operators relevant to you. As of this registry version, that
includes at minimum `GPTBot`, `ClaudeBot`, `Google-Extended`, `Applebot-Extended`, and
`Meta-ExternalAgent`.

## Step 2: Give each token its own group

```
User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: Meta-ExternalAgent
Disallow: /
```

Each `User-agent` line starts a new group. A crawler token that isn't named in any group falls
back to a wildcard (`User-agent: *`) group if one exists, and only to that — never to another
named group.

## Step 3: Confirm your wildcard group doesn't already block search crawlers

If you have an existing `User-agent: *` group with a broad `Disallow: /`, it will block every
crawler not explicitly named above too — including search-purpose crawlers like `Googlebot` and
`OAI-SearchBot`. Add an explicit `Allow: /` group for any search-purpose crawler you want to keep
visible, since an exact-token match always takes precedence over the wildcard group.

## Step 4: Verify

Run CrawlPact's [AI crawler checker](/tools/ai-crawler-checker) against your domain. It shows the
declared result for every crawler in the registry — training-purpose tokens should show
"Blocked," and search/user-triggered tokens should show "Allowed" or "No explicit rule."

## What this doesn't do

This is a declared instruction, not enforcement — see [/limitations](/limitations) for what a
`robots.txt` rule can and cannot guarantee.
