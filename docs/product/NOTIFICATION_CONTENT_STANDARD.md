# Notification Content Standard

Every notification produced by CrawlPact answers five questions, in this order:

1. **What happened?** — the title.
2. **Which domain or account is affected?** — the domain display name, always in the title/body.
3. **Why does it matter?** — one sentence of context in the body.
4. **What should the user do, if anything?** — implicit for informational events, explicit for
   `monitoring_paused` ("Review the domain before resuming monitoring").
5. **Where can they inspect evidence?** — the deep link (`action_path`).

## Tone

Calm, precise, evidence-led, non-alarmist, technically accurate — matching the approved CrawlPact
voice used throughout the product (see `docs/product/DOMAIN_CHANGE_ATTRIBUTION_MODEL.md`'s own
design rules, which Phase 10's copy inherits directly).

Never: emergency language for ordinary changes, "your website is unsafe," "AI is stealing your
content," "act immediately," "your site is broken," "you are exposed," legal-compliance statements,
or any claim of certainty about future crawler behaviour.

## Real copy, by source

Policy-change notifications reuse `domain_change_events.summary` directly
(`notification-intents.ts`) rather than deriving separate wording — this guarantees the
notification can never contradict the timeline's own, already-reviewed attribution language:

- **Website-policy**: "The website's published crawler-policy signals changed since the previous
  comparable scan."
- **Registry-driven**: "The website's published signals remained unchanged, but CrawlPact's
  verified crawler registry changed."
- **Mixed**: "Both the website's published policy and the verified crawler registry changed." —
  never labelled purely one or the other.
- **Uncertain**: not currently notification-worthy (`attentionLevel` for `uncertain` origin is
  always `informational` under the existing Phase 8 model — see
  `NOTIFICATION_FATIGUE_AND_GROUPING_POLICY.md`), but the underlying copy
  ("CrawlPact detected a material change but could not isolate a single cause...") already exists
  in `change-attribution.ts`/`domain-timeline.ts` for timeline display, ready to reuse unchanged if
  that threshold is ever revisited.

Failure/pause notifications use CrawlPact's own operational language, never diagnosing the target:

- **Repeated failure**: "CrawlPact could not complete the scheduled audit for {domain}. This is
  attempt N of {threshold} before monitoring pauses automatically; it will retry on the usual
  schedule."
- **Paused**: "CrawlPact could not complete {threshold} scheduled audits in a row for {domain}, so
  automatic monitoring has been paused. Review the domain before resuming monitoring." — never
  "website is offline" (not an established fact from a failed fetch, per §22's target/platform/
  security distinction).

## Safety bounds

- No raw target error messages, stack traces, DNS details, or SSRF-blocklist internals ever appear
  in a title/body (matches `packages/scanner/AGENTS.md`'s own boundary).
- Titles/bodies containing a domain display name are always escaped by the same XML-escaping path
  the Atom feed uses (`escapeXml`) and rendered as text (never `dangerouslySetInnerHTML`) in the
  React notification centre — see `PHASE_10_NOTIFICATION_MONITORING_THREAT_REVIEW.md`.
