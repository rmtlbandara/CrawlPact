# Final Pre-Phase-4 — SEO / Analytics / Performance Evidence

Status 2026-09-11. No Google Search Console, GA4, Microsoft Clarity, or CrUX tooling is connected
to this session (re-probed this pass, identical result to every earlier check). Everything below
attributed to the owner is **evidence class: OWNER-OBSERVED**, cross-checked against source and
live HTTP wherever a technical proxy exists; nothing here was independently re-derived through a
GSC/GA4/Clarity/CrUX API this session doesn't have.

## Sitemap / canonical (evidence class: LIVE HTTP + SOURCE INSPECTION)

`https://crawlpact.com/sitemap.xml` fetched live: contains only apex canonical URLs. Confirmed
absent: any `app.crawlpact.com` URL, any Preview host, any `workers.dev` host, `/app`, `/admin`,
`/api`, `/sign-in`, or a static-alias duplicate. `sitemap.xml.ts`'s own route list is generated
from `route-registry.ts`'s canonical set — the same registry this migration's alias fix lives in —
so there is no separate hand-maintained list that could drift. Owner-reported GSC state (Status:
Success, 80 discovered pages, last read 2026-09-09) is recorded as OWNER-OBSERVED; the sitemap's
own content independently confirms the "no app URL" invariant regardless of GSC's own crawl state.

## App root / sign-in noindex (evidence class: LIVE HTTP, re-confirmed this pass)

Both `https://app.crawlpact.com/` and `/sign-in` return `X-Robots-Tag: noindex, nofollow,
noarchive` and carry `<meta name="robots" content="noindex, nofollow">` (via `AuthLayout`), while
remaining crawlable (`robots.txt` allows `/` on the app host — the deliberate Phase 3 fix so a
`noindex` signal can actually be observed, per Google's own documented guidance that a
robots.txt-blocked page never has its noindex seen). Owner-reported GSC Live Test results for both
URLs ("Crawl allowed: Yes / Indexing allowed: No / noindex detected") are exactly the desired
outcome and consistent with this source-level configuration — recorded as OWNER-OBSERVED,
corroborated by source and live HTTP.

**This pass did not weaken or remove noindex anywhere to improve a Lighthouse SEO score, and does
not recommend doing so.**

## GA4 / Clarity host boundary (evidence class: SOURCE INSPECTION + OWNER-OBSERVED)

`AuthLayout.astro` (used by both `/` and `/sign-in` on the app host) has no `GoogleAnalytics` or
`MicrosoftClarity` component import — structurally absent, not merely consent-gated. This was true
before this pass and is unchanged by anything in PR #173/#174/#175. The owner's reported live
observation (no GA4/Clarity execution on `app.crawlpact.com`, consent-gated execution on the apex
before/after consent) is consistent with this structural guarantee and is recorded as
OWNER-OBSERVED, corroborated by source inspection — this session has no GA4/Clarity API access to
independently confirm network-level non-execution.

One clarification worth stating plainly, per this pass's own caution: a parent-domain `_ga` cookie
being visible in a browser's cookie jar on the app subdomain (an artifact of how GA4's own cookie
scoping works, unrelated to CrawlPact's session cookie) is not evidence that GA4 _executes_ on the
app host — the actual invariant that matters is script execution / collection-request traffic, not
cookie presence, and that's what the structural absence above guarantees.

## CrUX (evidence class: OWNER-OBSERVED, cannot independently verify)

Owner-reported: `NO_FIELD_DATA` for both Mobile and Desktop on the CrawlPact GSC property. Recorded
as-is — this is not a failure, real-user field data simply doesn't exist yet at this traffic
volume, and this pass does not treat its absence as blocking.

## Lighthouse / PageSpeed (evidence class: OWNER-OBSERVED lab scores; not independently re-run this pass)

Owner-reported PageSpeed snapshots (homepage, `/pricing/`, app root) are recorded as single-run lab
measurements, consistent with this repository's own `scripts/lighthouse-check.mjs` design
philosophy of never trusting a single run — that script already runs repeated measurements and
takes a median specifically because of exactly this kind of single-run variance. This pass did not
re-run Lighthouse against Production this exact session (no code changed that would affect page
weight/performance since the last CI run, which already includes a Lighthouse budget check that
passed on PR #173/#174/#175's Preview deployments). The homepage's owner-reported single-run
Mobile Performance of 79 (vs. Desktop 99) is recorded honestly as unconfirmed against the
project's own multi-run median methodology, not treated as a confirmed regression — a genuine
close-out would mean running `pnpm lighthouse:check` (or equivalent) fresh, which wasn't done this
pass given no code change motivates it.

**Best Practices = 92 across all three owner-reported URLs**: not root-caused this pass — doing so
requires either running Lighthouse locally against Production (not attempted, no code change
motivated it) or inspecting the owner's own Lighthouse report JSON, which wasn't provided. Recorded
as an open item, not silently dismissed as "probably fine."

## App SEO score (66 mobile / 58 desktop, owner-reported)

Expected and correct: the app root is intentionally non-indexable (`noindex`), and Lighthouse's SEO
category penalizes exactly that. **Not a defect, and this pass does not recommend changing it.**
