# Phase 23 External Pilot Recruitment Plan

Reuses the existing `pilot_cohorts`/`pilot_participants`/`pilot_feedback` infrastructure and
`/admin/pilots` workspace (Phase 17/19) — no second pilot system is created. Current state:
0 cohorts, 0 participants (`AUTHORITY_AND_DISTRIBUTION_BASELINE.md`).

## Target segments (Section 57)

Prioritized to ensure the frozen `>= 4` agency/multi-site threshold
(`docs/pilot/PHASE_17_SUCCESS_CRITERIA.md`) is actually reachable, not filled with convenient
contacts who don't match real usage:

1. **Agencies / multi-site operators** — the segment the frozen criteria specifically require
   coverage of. Look for agencies already managing multiple client domains who would use domain
   groups and portfolio monitoring as designed.
2. **Publishers** — search-vs-training crawler access is a live, real decision for this segment.
3. **SaaS/documentation teams** — the `/for/saas-and-documentation/` vertical's own target
   audience; developer-docs discoverability is a concrete, relatable problem.
4. **Web developers/DevOps** — the `/for/web-developers/` vertical's target audience;
   deployment-drift verification is their natural entry point.

## Draft invitation (Section 58) — **not sent**

> Subject: A quick technical look at how [company]'s site talks to AI crawlers
>
> Hi [name],
>
> I'm building CrawlPact, a tool that audits and monitors what a website's `robots.txt`,
> `llms.txt`, and related signals actually tell AI crawlers (like GPTBot, ClaudeBot, PerplexityBot)
> — and flags when that changes.
>
> I think [company] would be a genuinely useful test case because [specific, real reason tied to
> their actual site/portfolio — not filled in generically].
>
> What participation involves: running a free audit on your own domain(s), optionally saving one
> or a few for ongoing monitoring, and telling me honestly what was confusing, wrong, or missing.
> Takes about 10-15 minutes to try; monitoring runs in the background after that.
>
> This is a free pilot account — no payment involved unless you later decide the paid monitoring
> tiers are worth it for you. I'm not asking for a testimonial or a link, just honest feedback.
> CrawlPact only reads publicly accessible policy files on the domains you choose to add — it
> doesn't need server access.
>
> If you'd rather not, no worries at all — happy to just hear what you think of the audit itself.
>
> [name]

Deliberately does not promise ranking improvement, crawler compliance, or revenue growth (Section
58's explicit prohibition), and the `[specific, real reason]` placeholder is left unfilled — a
real invitation requires a real, specific reason tied to the actual recipient, which this
planning document cannot manufacture.

## What this plan does not do

- Does not identify actual candidate people/companies — Section 43 requires manual, owner-led
  identification; this phase does not build or run a scraper, and no specific person has been
  named as an outreach target.
- Does not send anything — sending requires the specific human authorization Section 110 requires
  for each external communication.
- Does not fabricate any recruitment having occurred.

## Owner action required

See `OUTREACH_OWNER_ACTION_QUEUE.md` — pilot outreach is listed there as a human-only action.
