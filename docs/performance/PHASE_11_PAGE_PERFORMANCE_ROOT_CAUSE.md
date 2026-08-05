# Phase 11 page performance root-cause analysis

Stage 11G. RISK-033 (the production LCP gap first measured in Phase 7,
`docs/seo/PHASE_07_SEARCH_PERFORMANCE_BASELINE.md`, 2026-08-04) investigated with real production
Lighthouse runs — via a real headless Chrome instance against `https://crawlpact.com`, not a local
build or synthetic proxy — using the same five representative pages `scripts/lighthouse-check.mjs`
already tracks. See `PHASE_11_PAGE_PERFORMANCE_RESULTS.md` for the full before/after numbers this
analysis is based on.

## Headline finding: the gap already closed before this phase touched any frontend code

Re-measuring today produced dramatically better scores than the Phase 7 baseline across every
page that previously failed the phase's own threshold — most sharply on the two worst offenders:

| Path                    | Phase 7 baseline (2026-08-04) | This phase's measurement (2026-08-05)                  |
| ----------------------- | ----------------------------- | ------------------------------------------------------ |
| `/`                     | Performance 79, LCP 4,653 ms  | Performance 94–95, LCP 2,770–2,940 ms                  |
| `/crawlers/amazonbot`   | Performance 71, LCP 5,070 ms  | Performance 96, LCP 2,230 ms                           |
| `/for/agencies`         | Performance 73, LCP 4,788 ms  | Performance 99, LCP 1,579 ms                           |
| `/platforms/cloudflare` | Performance 90, LCP 3,300 ms  | Performance 99, LCP 1,690 ms                           |
| `/pricing`              | Performance 99, LCP 1,787 ms  | Performance 98, LCP 1,826 ms (unchanged, already good) |

**Honesty about what this analysis can and can't claim**: this phase did not identify and fix a
single root cause that explains the improvement — the gap had already closed, measured against
real production, before any Stage 11G code change was made. Several commits landed between the two
measurement dates (`666f185`, `ca6c3c1`, `e245793`, `fd8eae5`, `0d23f5a` — see `git log`), none of
which this phase's own investigation isolated as _the_ specific fix; re-deriving that historical
attribution with confidence would require re-running Lighthouse against each intermediate commit,
which this phase's "no uncontrolled load testing" instruction weighs against doing purely to
satisfy curiosity about already-resolved history. What this document _does_ claim, with direct
evidence: the **current** production state, its **current** LCP composition, and the **current**
optimization opportunities — all measured today, not inferred from the old gap.

## Current LCP composition (real, from Lighthouse's `lcp-breakdown-insight`)

For every page measured, the LCP element's timing breaks into exactly two subparts —
`timeToFirstByte` and `elementRenderDelay` — with **no `resourceLoadDelay` or
`resourceLoadDuration` subpart present**. In Lighthouse's own insight-audit model, a 4-subpart
breakdown means the LCP element is an image/resource that must itself be fetched after First
Contentful Paint; a 2-subpart breakdown means the LCP element is text, painted directly from the
already-downloaded HTML/CSS with no additional resource fetch in the critical path.

This directly confirms, for the homepage specifically: the LCP element is
`<p class="mt-4 text-body-lg ...">` — the hero section's subheading paragraph
(`#hero-audit-form > ... > p.mt-4`) — **not** the hero artwork image added in commit `0d23f5a`
("feat(homepage): add hero artwork — audited website mark"). A newly-added hero image was the
first, most obvious suspect for a homepage LCP regression; this measurement directly rules it out
rather than assuming it either way.

| Path                  |   TTFB | Element render delay | LCP element                  |
| --------------------- | -----: | -------------------: | ---------------------------- |
| `/`                   | 577 ms |               425 ms | Hero subheading `<p>` (text) |
| `/crawlers/amazonbot` | 679 ms |               332 ms | Text (same 2-subpart shape)  |
| `/for/agencies`       | 433 ms |               267 ms | Text (same 2-subpart shape)  |

TTFB is the larger of the two subparts on every page measured, including the two _prerendered,
static_ pages (`/` and `/crawlers/amazonbot`, both `export const prerender = true` — served
directly off the Workers Assets binding, no D1 read in their request path at all). TTFB in the
430–680 ms range on both static and SSR pages, with no consistent static-vs-SSR gap in this
sample, points at connection-setup/network-round-trip cost (DNS, TLS handshake, real geographic
latency from the test machine to Cloudflare's edge) as the dominant TTFB factor here, not
server-side compute — a single lab run per page cannot fully separate these causes with certainty,
which is exactly why `PHASE_11_PAGE_PERFORMANCE_RESULTS.md` records this as an observation, not a
proven mechanism.

## The one real, fixable finding: render-blocking shared CSS (considered, not applied)

Every page measured flags the same render-blocking resource:
`_astro/MarketingLayout.[hash].css` (or its `src.[hash].css` alias — same file, same content hash,
confirmed via a real production build: exactly 2 CSS files exist in the entire built site, both
35,309 bytes uncompressed / ~8.7–8.8 KB transferred, byte-identical). Lighthouse's
`render-blocking-insight` estimates 140–433 ms of savings per page from eliminating this
render-blocking `<link>`.

**Why this phase does not apply the obvious fix.** Astro's `build.inlineStylesheets` option
(`'auto'` by default — inlines stylesheets under Vite's `assetsInlineLimit`, 4 KB by default; this
file is 8.7–8.8 KB, over that threshold) offers a one-line change (`inlineStylesheets: 'always'`)
that would eliminate the render-blocking request entirely. It was seriously considered and
declined for a real, evidenced reason: **this is the one shared stylesheet for the entire
site** — every marketing page uses it. `'always'` would inline it into every page's HTML instead
of loading it once as an external, browser-cached file. For a single cold page load (what
Lighthouse's lab test measures), that is a clear win. For a real visitor browsing multiple pages
in one session — exactly this site's actual usage pattern, given its guide/crawler-directory/
platform-page content depth — it would mean re-transferring the same ~8.8 KB on every subsequent
page view instead of serving it once from cache, a real cost Lighthouse's single-page lab
methodology cannot see and this phase should not pretend to have measured. With every page already
scoring 94+ against an 85 threshold, the modest, single-page-only gain does not justify a change
with a real, unmeasured multi-page-session cost. Recorded here, not applied, so a future author
doesn't have to re-derive this tradeoff from nothing if it's revisited once real field data (not
lab data) is available to settle it properly.

## RISK-033 disposition

Every page in the tracked set now measures performance 94–99 (threshold: 85) and LCP 1,579–2,940 ms
(threshold: 3,000 ms), a real, current, directly-measured state — not the stale Phase 7 baseline.
Recommend closing RISK-033 on this evidence; see the completion report and `ACTIVE_RISKS.md` for
the formal closure entry, including the caveat above about not having isolated the specific
historical fix.
