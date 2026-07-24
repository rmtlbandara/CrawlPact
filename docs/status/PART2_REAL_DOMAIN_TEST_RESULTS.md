# Part 2 Real-Domain Test Results

Raw results of the Step 20 requirement to test the live scanner against at least 50 real public
domains, respectfully. Run 2026-07-23 against a local dev server
(`AUDIT_ENGINE_ENABLED=true`, local D1, local `anonymous_audit_daily_limit` temporarily raised
for this local testing session only — see `docs/status/IMPLEMENTATION_STATUS.md`).

## Method

- 51 real, well-known public domains, chosen for diversity: general tech, news publishers,
  developer tooling, government/international bodies, education, open-source projects, and
  SaaS — see the full list below.
- One audit per domain via `POST /api/audit`, **sequential, not parallel**, with a 3-second gap
  between requests.
- No repeated hits on any single target beyond the one audit.
- The scanner's own limits (bounded resource set, ~12-request cap, size caps, a fixed
  non-impersonating user agent, no cookie jar/script execution) applied identically to every
  target — the same limits any real customer's audit would be subject to.
- This is a respectful **single bounded fetch of a handful of public policy files per domain**
  (`robots.txt`, `sitemap.xml`, `llms.txt`, the homepage, `/.well-known/rsl.xml`) — comparable in
  impact to a single `curl` of each file, not a crawl.

## Results summary

| Outcome                   | Count | Domains                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `completed`               | 42    | example.com, wikipedia.org, github.com, mozilla.org, cloudflare.com, wordpress.org, shopify.com, stripe.com, paddle.com, openai.com, anthropic.com, google.com, bing.com, duckduckgo.com, mit.edu, stanford.edu, python.org, nodejs.org, rust-lang.org, golang.org, npmjs.com, pypi.org, docker.com, kubernetes.io, vuejs.org, developer.mozilla.org, w3.org, ietf.org, usa.gov, gov.uk, un.org, who.int, archive.org, medium.com, substack.com, squarespace.com, wix.com, hubspot.com, salesforce.com, atlassian.com, gitlab.com, digitalocean.com |
| `completed_with_warnings` | 8     | stackoverflow.com, nytimes.com, bbc.com, reuters.com, theguardian.com, harvard.edu, react.dev, vercel.com                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `incomplete`              | 1     | npr.org                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `target_unavailable`      | 0     | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| API-level error (non-2xx) | 0     | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

**51/51 requests were handled honestly** — every scan either completed, completed with clearly
labelled warnings, or was marked incomplete with evidence. No scan silently failed, hung
indefinitely (after the fix below), or returned a fabricated result.

## What the outcomes mean (evidence, not guesswork)

- **`completed_with_warnings` (8 domains)** were inspected directly via `GET
/api/audit/[id]/report`. Example: `stackoverflow.com` scored 45/100 ("Weak") with 8 findings,
  several `critical`-severity "a search crawler is blocked" findings — this is the scanner
  correctly detecting that the site's real `robots.txt` blocks AI search crawlers, not a parser
  bug. This is exactly the kind of real-world signal the product exists to surface.
- **`incomplete` (npr.org)** — its `robots.txt` (and, sequentially, other resources) did not
  respond within the scanner's timeout budget from this test environment. The report correctly
  shows every crawler as `resource_unavailable` rather than fabricating an "allowed"/"blocked"
  result from no data — the honest-degradation path worked as designed. This is recorded as
  target-side (or network-path) slowness, not a product defect, per the explicit instruction not
  to conflate the two without evidence.

## A real bug this test found and fixed

`npr.org`'s scan took **104 seconds** — far longer than any other domain (average 6.8s, next
slowest 30s). Investigating why (not just noting the number) found a genuine gap: FR-FET-007
requires a "total-scan timeout" in addition to per-resource timeouts, and
`docs/security/SSRF_SECURITY_MODEL.md`/ADR-0005 already documented one as implemented — but the
orchestrator (`packages/scanner/src/orchestrator.ts`) only enforced a **per-resource** timeout
(20s default). Its 5 resource fetches run sequentially with no overall deadline, so a target slow
on multiple resources could compound close to 5× the per-resource timeout.

**Fixed in this session**: `runScan` now accepts a `totalTimeoutMs` budget (default 30s, also
exposed as the tunable `scan_total_timeout_seconds` runtime-configuration key, wired through
`/api/audit`, manual re-scan, and scheduled monitoring). Each resource attempt checks the
remaining budget before starting and caps its own timeout to whatever remains; once the budget is
exhausted, remaining resources are skipped (the same honest `attempted: false` path already used
for the external-request-count budget) rather than fabricating data. Added a unit test proving
timeout-budget enforcement (`orchestrator.test.ts`, "stops attempting further resources once the
total-scan timeout budget is exhausted"). Verified against the real domain that exposed it:
re-scanning `npr.org` after the fix completed in 30.5 seconds (bounded, predictable) instead of
104 seconds, still honestly reporting `incomplete` since the target genuinely didn't respond in
time — the fix bounds worst-case latency, it doesn't (and shouldn't) fabricate a result for a
target that's actually unreachable within budget.

## Domains tested (all 51)

example.com, wikipedia.org, github.com, stackoverflow.com, mozilla.org, cloudflare.com,
nytimes.com, bbc.com, reuters.com, theguardian.com, npr.org, wordpress.org, shopify.com,
stripe.com, paddle.com, openai.com, anthropic.com, google.com, bing.com, duckduckgo.com, mit.edu,
stanford.edu, harvard.edu, python.org, nodejs.org, rust-lang.org, golang.org, npmjs.com,
pypi.org, docker.com, kubernetes.io, react.dev, vuejs.org, developer.mozilla.org, w3.org,
ietf.org, usa.gov, gov.uk, un.org, who.int, archive.org, medium.com, substack.com,
squarespace.com, wix.com, hubspot.com, salesforce.com, atlassian.com, gitlab.com,
digitalocean.com, vercel.com

## Not covered by this pass

- Domains with unusual/malformed robots.txt syntax edge cases (covered instead by
  `packages/robots`'s 22+13 unit tests using synthetic fixtures, which can safely exercise cases
  real sites are unlikely to have in this exact form).
- Domains actively blocking the scanner's user agent — none of the 51 chosen domains did this,
  but the "blocklist"/`unsafe_target`/`connection_failed` paths are covered by
  `audit-abuse-prevention.integration.test.ts` and `safe-fetch.test.ts` against synthetic
  fixtures instead, since deliberately finding real sites that block probing tools wasn't this
  pass's goal.
