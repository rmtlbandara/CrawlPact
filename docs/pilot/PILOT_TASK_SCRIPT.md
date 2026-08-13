# Pilot Task Script

Status: current-authoritative. For the owner to use when observing (in person, on a call, or
asynchronously) a pilot participant using CrawlPact. Participants perform realistic tasks; they
are not coached through every click (§47) — comprehension is measured by what they do and say
_before_ being helped, not after.

## Core pilot journey (§48)

1. Visit CrawlPact normally (`https://crawlpact.com`).
2. Ask: "What do you think this product does?" — record their answer before explaining anything.
3. Have them audit one real website they manage or care about.
4. Have them review the audit result on their own.
5. Ask: "What do you believe the main policy issue is here, if any?"
6. Ask: "Is this result useful to you? Why or why not?"
7. If they choose to continue: let them create an account (do not push this).
8. Let them save a domain.
9. Let them establish a baseline scan.
10. Let them review the domain's history/timeline.
11. Let them review monitoring options.
12. Let them review `/pricing`.
13. Ask: "Would a paid plan be worth it for you? Which one, if any?"
14. (Later, separately) invite them to return and review monitoring/change history.

Do not force any action a participant would not naturally choose (§48) — a participant who
declines to create an account, or who doesn't reach pricing, is itself real evidence, not a
failed session.

## Agency-specific tasks (§54), only for `agency`/`multi_site` participants where relevant

- Add multiple domains.
- Try a domain group.
- Try CSV import and export.
- Review the portfolio overview.
- Create/review a private, shareable report — including what the recipient sees and how to
  revoke the link (§55). Never use a real client's data for this unless the participant is
  demonstrating with their own real client relationship and consents to it.
- Review Agency branding.
- Review the monitoring overview across their domains.

Do not require an Agency participant to use a feature irrelevant to their situation.

## Recording evidence

For each session, log (in the admin pilot workspace or as an internal admin note, never as a
public artifact):

- Time to first value (audit start → viewing a completed, useful result) — internal metric only,
  never a public claim (§50).
- Whether they understood the audit unaided (see the Audit Understanding Test below).
- Whether/how much human help was required, and why (`docs/pilot/PILOT_SUPPORT_BURDEN_MEASUREMENT.md`).
- Their stated plan interest and reasoning.

## Audit Understanding Test (§49)

Before explaining anything, ask the participant to describe, in their own words:

1. What the website currently tells crawlers.
2. The difference between a Search purpose crawler and a Training purpose crawler, as shown in
   the result.
3. What evidence backs one of the findings shown.
4. What the report does _not_ tell them (its limitations).
5. What they'd do next, based on the report.

Record their unaided answers before coaching. A participant who cannot answer several of these
is real evidence of a comprehension gap (H2/H3), not something to paper over.
