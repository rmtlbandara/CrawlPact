# Claims and Messaging Guide

**Level 1 document (Current authoritative).** Governs every product claim made in current
CrawlPact copy. Established Phase 2, 2026-08-03. Enforced by `pnpm brand:validate`
(`scripts/brand-validate.mjs`).

## Evidence precedence for deciding whether a claim is allowed

1. Current production observation
2. Current production configuration
3. Current default-branch code
4. Current tests
5. `docs/status/CURRENT_STATE.md`
6. Current product-scope and requirements documentation
7. Historical reports

## Claim categories

- **verified-capability** — a capability confirmed live/working per
  `docs/status/CURRENT_STATE.md` or `docs/baseline/2026-08-03/CAPABILITY_MATRIX.md`. May be
  presented as a current fact.
- **verified-boundary** — a documented, confirmed limitation of the product (what it does not
  do). May be presented as a current fact.
- **supported-inference** — a reasonable claim not directly observed but supported by code/tests.
  Must be clearly qualified (see "Qualified claims" below) — never presented as an unqualified
  current fact.
- **planned-capability** — not yet live. Must be labelled planned, preview, beta, upcoming, or not
  yet available. Never described as currently available.
- **prohibited-claim** — listed below. Never used or implied anywhere.
- **verification-blocked** — cannot currently be confirmed either way. Do not make the claim until
  it can be classified into one of the categories above.

Only `verified-capability` and `verified-boundary` claims may be presented as unqualified current
facts.

## Approved claims (verified, with evidence)

| Claim                                                                                      | Evidence                                                                                         |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| CrawlPact runs real anonymous audits                                                       | `verified-live` — `docs/baseline/2026-08-03/CAPABILITY_MATRIX.md` #1                             |
| CrawlPact supports passkey/WebAuthn authentication                                         | `verified-live` — real production register/sign-in round trip, 2026-07-28                        |
| CrawlPact processes real Paddle billing webhooks                                           | `verified-live` — 8 real signed events processed in production, 2026-07-28                       |
| CrawlPact's crawler registry distinguishes search, training, retrieval, and agent purposes | `verified-capability` — `docs/registry/CRAWLER_REGISTRY_GOVERNANCE.md`, 23 crawlers, 9 operators |
| CrawlPact detects conflicts between public policy signals                                  | `verified-capability` — `packages/policy/src/conflicts.ts`, tested                               |
| CrawlPact monitors saved domains for policy and registry changes                           | `code-present-not-production-verified` — `docs/status/CURRENT_STATE.md`                          |
| CrawlPact supports agency client groups, batch import, and branded shares                  | `code-present-not-production-verified`                                                           |
| CrawlPact does not require installation                                                    | `verified-boundary` — SaaS, browser-based, no agent/plugin exists                                |
| CrawlPact does not require server/traffic-log access for policy auditing                   | `verified-boundary` — scanner only performs public HTTP requests, `packages/scanner`             |

## Qualified claims — required wording

Use qualifying language for any claim not fully verified as a current fact:

- "may"
- "can indicate"
- "appears"
- "based on the current public response"
- "according to registry version [X]"
- "where publicly accessible"
- "when supported by the website configuration"

Example: "This may indicate the crawler is unable to reach the resource" rather than "The crawler
cannot access this resource."

## Prohibited claims

Never use or imply:

- CrawlPact stops all AI scraping
- CrawlPact makes crawlers obey
- CrawlPact guarantees AI visibility
- CrawlPact guarantees search inclusion
- CrawlPact guarantees training exclusion
- CrawlPact protects all website content
- CrawlPact proves what every crawler accessed
- CrawlPact is a legal compliance certification
- CrawlPact provides complete AI compliance
- CrawlPact replaces a WAF, CDN, or bot-management product
- CrawlPact monitors actual traffic without log access
- CrawlPact supports every crawler
- CrawlPact supports every hosting provider perfectly
- CrawlPact's score is a universal measure of good or bad policy
- Every website should block training crawlers
- Every website should allow search crawlers
- llms.txt is universally adopted or required
- robots.txt guarantees crawler compliance

## Approved boundary statement

Use this concise standard statement wherever a boundary needs stating:

> CrawlPact audits the public policy signals a website publishes. It does not control external
> crawlers or guarantee that they will comply.

## Required disclaimers

- **Anonymous audits**: results reflect a single point-in-time scan; no account or ongoing
  monitoring is implied.
- **Reports**: "CrawlPact evaluates publicly accessible policy signals against its current
  verified crawler registry. Results describe the website's published policy and do not guarantee
  external crawler behaviour or legal compliance." (adapt wording to fit the interface; preserve
  meaning)
- **Scores**: explain what the score measures, what it does not measure, that different policy
  objectives may produce different desired outcomes, and that a score is not legal compliance or
  a measure of actual crawler obedience.
- **Recommendations**: must explain the user's selected objective, the detected mismatch, and
  implementation guidance; must avoid presenting one universal policy as correct or implying legal
  certainty; must identify uncertainty; must preserve the underlying deterministic logic
  unchanged.
- **Crawler registry**: every entry must cite its official source and verification date; entries
  without a confirmed purpose are labelled `unknown`/`unspecified`, not guessed.
- **Optional signals** (llms.txt, RSL, Content Signals): never described as universally supported
  or required.
- **Shared reports**: agency-branded shares never remove CrawlPact's disclosed technical/legal
  limitations, even when branded.
- **Platform guides**: content must cite official crawler-operator sources and show a
  last-reviewed date; never present unsourced classifications.
- **Competitor comparisons**: see "Competitive claims" below.
- **Legal/compliance references**: never imply legal certification — see prohibited claims.

## Evidence requirements for any new public claim

A new claim must identify: source, verification date, the specific product capability it
describes, code or production evidence, an owner (role, per
`docs/governance/DOCUMENTATION_GOVERNANCE.md`), and a review trigger (what event should prompt
re-checking it).

## Competitive claims

Do not name or compare competitors unless the comparison is: necessary, factual, current,
supported by first-party official sources, dated, free of implied endorsement, and clear that it
distinguishes policy auditing from enforcement and traffic analytics.

## Emerging standards

Treat llms.txt, RSL, Content Signals, and other optional/emerging signals conservatively — never
describe any of them as universally supported or required unless current evidence proves that
specific claim for that specific standard.

## Customer proof

Do not publish: testimonials without permission; customer logos without permission; usage counts
without production evidence; uptime values without real measurement; conversion or performance
results without methodology; "trusted by" language without genuine, evidenced customer
permission.

## False-positive handling (for `pnpm brand:validate`)

A small, reviewed allowlist may exempt specific file/phrase combinations from automated
detection — each entry must record: file, phrase, reason, owner, and an expiry/review date. See
`scripts/brand-validate.mjs`'s allowlist. Do not broadly disable validation for an entire
directory except `docs/archive/`, generated build output, or third-party code.
