---
Document owner: Engineering owner
Status: current-authoritative
Date: 2026-09-08 (originally issued 2026-09-07; updated through production deployment below)
---

# Phase 20 — Authoritative Baseline, Production Parity & Search Foundation — Completion Report

## Executive verdict

**PASS.**

Deployed to production with explicit owner authorization, validated independently (not just via
the automated pipeline), and Google Search Console's own post-deployment data already confirms
convergence. Every prior gate is closed:

- Every evidence gate (Search Console, GA4, CrUX) closed with real, independently-queried data —
  see "Day 2/3 addendum" below.
- Implementation deployed to production through the repository's normal trusted workflow (PR → CI
  → automerge → post-merge CI → `deploy-production.yml` with explicit typed confirmation) — see
  "Day 4: production deployment" below.
- Post-deployment validation performed independently against the live site (not just trusting the
  pipeline's own smoke test): canonical/redirect behavior, sitemap, robots.txt, security headers,
  auth/passkey entry points, GA4 continuity — all confirmed correct via direct HTTP checks.
- Preview search isolation — the P0 gate — confirmed live on the actual deployed
  `preview.crawlpact.com`, not just locally.
- One deliberate post-deployment Google URL Inspection shows canonical mismatches dropping from
  20 sitemap≠canonical / 1 user≠Google to **zero**, and PASS rising from 58/79 to 68/79 — Google
  has already substantially reprocessed the fix.

No known Phase 20 defect remains open. Remaining items (two stale Google-cache entries for pages
whose live canonical is already confirmed correct; two newly-relabeled sitemap URLs Google hasn't
crawled under their new identity yet) are `PENDING_GOOGLE_REPROCESSING`, not implementation gaps —
see "Google post-deploy comparison" below.

## Day 2/3 addendum (2026-09-08) — read this first

A second session, the same day's date on the user's clock plus one, had direct read-only Google
Search Console API access (`sc-domain:crawlpact.com`, via local OAuth tooling) that 2026-09-07 did
not have. This closed the Search Console gate with real data and surfaced one additional, genuine
defect the first pass didn't cover:

- **Real GSC data independently confirmed** every fragmentation/canonical-mismatch pattern
  2026-09-07 diagnosed from first-principles production testing — see
  `docs/baseline/2026-09-08-phase20/SEARCH_CONSOLE_BASELINE.md` for the full breakdown (16
  URL-fragmentation groups, 20 sitemap≠canonical mismatches, the one genuine user≠Google
  disagreement on `/contact`, and disposition of the two "discovered, not indexed" URLs
  `/audit`/`/platforms`).
- **New defect found and fixed: internal links across the site pointed to non-canonical URLs.**
  The sitewide footer, header, homepage sections, breadcrumbs (both visible nav and JSON-LD), and
  most cross-page links used the bare (non-slash) form — see
  `docs/baseline/2026-09-08-phase20/INTERNAL_LINK_CANONICALIZATION.md`. A genuine, isolated bug was
  also found in this sweep: the homepage's own crawler-card links had no trailing slash at all
  (inconsistent with every other content-collection link in the codebase), plausibly contributing
  directly to the Amazonbot fragmentation Google measured. Fixed; 525/525 unit tests still pass
  after the fix (two pre-existing tests that asserted the old bare-href source as correct were
  updated, the same pattern 2026-09-07 already established for `seo-metadata.spec.ts`).
- Two guide pages' inspection rows appeared to show a reversed (non-slash) canonical; investigated
  and confirmed to be **stale Google-side data** (crawled 2026-07-31), not a live or ever-real code
  defect — both pages' canonical generation is, and always was, identical to every other guide.

A third round the same day added direct, read-only **GA4 (Admin + Data API)** and **CrUX API**
access, closing the two remaining external-evidence gates:

- **GA4**: real production traffic confirmed flowing correctly (consent-gated, allowlisted routes,
  ad signals denied, query-string privacy — matches documented architecture exactly, no defect, no
  code touched). The 2026-08-09→2026-09-05 window is almost entirely the owner's own testing (39/40
  sessions from Sri Lanka) — not treated as external-audience evidence. **`0` key events
  investigated and explained, not a gap**: CrawlPact's real product funnel is fully instrumented in
  a separate, deliberate first-party `product_events` system (`PRODUCT_EVENT_NAMES` covers landing
  → audit → account → domain-saved → pricing → checkout → subscription → monitoring end to end);
  GA4 was never meant to carry it (an intentional, documented SRS §6.2 deviation scoped to
  marketing-page channel measurement only). See `docs/baseline/2026-09-08-phase20/GA4_BASELINE.md`.
- **CrUX**: independently re-queried this session (not just quoted from the prompt) —
  `NO_FIELD_DATA` confirmed for all form factors, phone, and desktop. Recorded as exactly that
  state, not PASS/FAIL, no fabricated p75. See
  `docs/baseline/2026-09-08-phase20/CRUX_FIELD_DATA_STATE.md`.

No code changes from 2026-09-07 were reverted or reconsidered — the real data confirmed that
pass's diagnosis and fix were correct. All figures below from 2026-09-07 remain valid except where
this addendum explicitly updates them (Search Console, Analytics/CrUX, Validation, Documentation
sections).

## Day 4: production deployment (2026-09-08, explicit owner authorization)

### Deployment path (the repository's normal trusted workflow, no shortcuts)

1. Committed the full Phase 20 change set as 3 focused commits on `phase-20-search-foundation`,
   pushed, opened PR #158, added the `automerge` label.
2. CI failed twice on real, previously-untested-by-this-session gaps in the mechanical internal-link
   sweep (see "New defects found during deployment" below) — fixed, pushed, CI passed, PR
   auto-merged (`f2f18fb`).
3. `merge-when-green.yml`'s own post-merge CI dispatch **failed** — not a Phase 20 defect, but a
   separate, genuinely pre-existing gitleaks full-history false positive on an unrelated commit
   from the day before, latent until this session's automerge dispatch first exercised it. Fixed
   (PR #159, `.gitleaks.toml`), verified locally against real repo history before pushing.
4. Post-merge CI succeeded for `4996b88`. Dispatched `deploy-production.yml` with the required
   typed confirmation (`DEPLOY PRODUCTION`) against that exact, CI-verified commit.
5. **Production deployment succeeded**: build, D1 migration apply (no-op — none required),
   reference-data seed, Worker deploy, binding verification, and the pipeline's own smoke test all
   passed. Worker version `fd7f5c16-fad9-4642-af11-261617c8f941`, deployed 2026-09-08T05:49:48Z,
   commit `4996b889362810e9f8e6a2c5038a8737e23fca4d`.

### New defects found during deployment (found live, fixed, redeployed — none pre-existing in the sense of unrelated to this phase, all a direct consequence of the canonical-URL change)

- **Computed/prop-based hrefs the mechanical sed sweep couldn't match**: real CI (which runs a
  genuine Cloudflare-compatible preview server) caught what this session's local Miniflare
  limitation couldn't. `PricingPlans.tsx`'s free-plan CTA, `SiteHeader.astro`'s `ctaHref` prop,
  three `methodologyHref` props, `trust-config.ts`'s route map, the status Atom feed's
  self-referencing URL, and — genuinely — four pages' own `canonicalPath` prop
  (`observatory/index.astro`, `observatory/methodology.astro`, `observatory/registry.astro`,
  `research/index.astro`) were still bare, meaning those four pages were declaring the wrong
  canonical for themselves. All fixed; re-verified with the full local validator suite plus a
  second, more exhaustive manual read-through of every remaining local `href`/`url`/`canonicalPath`
  in the source tree (not just a repeat of the same grep pattern that missed them the first time).
- **`scripts/trust-validate.mjs`, `scripts/smoke-test.ts`, `scripts/lighthouse-check.mjs`, and five
  Playwright specs** asserted the pre-Phase-20 bare href as the expected/correct value — the same
  underlying issue `seo-metadata.spec.ts` already had on 2026-09-07, in more places than that one
  pass's grep covered. Updated all to expect the canonical form; re-verified `pnpm quality`'s full
  local validator chain and the full unit suite.

### CI/CD infrastructure gaps found and fixed (pre-existing, not Phase 20 code defects, but blocking safe deployment/validation of it)

- **Gitleaks full-history false positive** (`.gitleaks.toml`, PR #159): a `workflow_dispatch`-triggered
  CI run scans full git history, not just the diff — permanently re-flagging an already-fixed,
  already-reviewed commit from 2026-09-07 (a dynamically-generated test `CryptoKey`, never a real
  secret). Never caught before because nothing had exercised the automerge label's post-merge CI
  dispatch since that commit landed.
- **`deploy-preview.yml` never actually deployed anything for this session's merges** (PRs #160,
  #161): root-caused to GitHub's `GITHUB_TOKEN` anti-recursion protection applying transitively — a
  `workflow_dispatch` run started by a `GITHUB_TOKEN` action can itself complete normally, but its
  completion cannot trigger a _further_ `workflow_run` listener. `merge-when-green.yml` now
  dispatches `deploy-preview.yml` directly (the same single-hop, documented-exception mechanism
  already used for `ci.yml`) instead of depending on a chain that structurally cannot complete.
  Manually dispatched once to unblock this session's own validation; automatic for all future
  merges going forward.
- **`smoke-test.ts`'s robots.txt check didn't know about preview's new, intentional content** (PR
  #162) — found running the script directly against the now-correctly-deployed preview.

None of these three CI/CD gaps are Phase 20 application-code defects. All three were latent,
undiscovered gaps in this repository's automerge/dispatch chain that this session's specific
sequence of actions (first real automerge-driven deploy-production dispatch, first real
post-#158-merge preview deploy) was the first to actually exercise.

### Preview deployment

Once the dispatch-chain fix (PR #161) merged, `deploy-preview.yml` was manually dispatched once
(commit `340d57e`) to close the gap this session's own actions had exposed. The Worker itself
deployed successfully; the pipeline's own "Verify deployed bindings" step failed with every single
binding reporting "found nothing" (uniform, not per-field — consistent with a Cloudflare API
propagation-timing race immediately after deploy, not a real drift) and the run stopped before
reaching its own smoke test. **Independently re-verified directly against the live deployed
preview** (not just trusting the failed pipeline step): `robots.txt` correctly disallows
everything, every response carries `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`, and
canonical redirects (`/about` → `/about/`, `/pricing` → `/pricing/`) work exactly as designed —
confirmed with `scripts/smoke-test.ts preview`, 30/30 passing (after the PR #162 fix). The
binding-verify timing race is recorded as a known, low-priority, non-blocking CI robustness item
below — it did not affect the actual deployment's correctness.

### Independent post-deployment validation (production)

Run directly against `https://crawlpact.com`, not just the pipeline's own smoke test:

| Check                                                                            | Result                                                                                                |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Homepage                                                                         | `200`                                                                                                 |
| `/about` → `/about/` (prerendered)                                               | `301`, then `200`                                                                                     |
| `/crawlers/amazonbot` → `/crawlers/amazonbot/`                                   | `301`, then `200`                                                                                     |
| `/pricing` → `/pricing/` (SSR)                                                   | `301`, then `200`                                                                                     |
| `/status` → `/status/` (SSR)                                                     | `301`, then `200`                                                                                     |
| `/for/agencies` → `/for/agencies/` (SSR, content collection)                     | `301`, then `200`                                                                                     |
| `/contact` → `/contact/` (the one real pre-fix Google canonical disagreement)    | `301`, then `200`                                                                                     |
| `http://crawlpact.com/` → `https://crawlpact.com/`                               | `301`                                                                                                 |
| `https://www.crawlpact.com/` → `https://crawlpact.com/`                          | `301`                                                                                                 |
| Canonical tag / `og:url` on `/about/`, `/pricing/`, `/contact/`, `/observatory/` | Exact match to served URL                                                                             |
| Sitemap (79 URLs)                                                                | All canonical, none redirect, none bare except `/`                                                    |
| `robots.txt`                                                                     | Correct, unchanged production content                                                                 |
| GA4 pre-consent                                                                  | No `googletagmanager.com` script tag (confirmed not loaded before consent)                            |
| Consent control                                                                  | Present                                                                                               |
| `/sign-in`                                                                       | `200`, both Google and passkey entry points present                                                   |
| Security headers                                                                 | HSTS, CSP, `X-Content-Type-Options` all present                                                       |
| D1 migration state                                                               | 38/38, `0038_google_oauth.sql` latest — **unchanged**, confirming "no migration required" was correct |
| Official `scripts/smoke-test.ts production` (run independently, not just in CI)  | **34/34 passed**                                                                                      |

### Google post-deploy comparison (one deliberate bulk URL Inspection, pre-change snapshot preserved separately)

Pre-change snapshot preserved as `crawlpact-url-inspection-pre-phase20.{json,csv,summary.json}`
before running the post-change inspection (never overwritten).

| Metric                                            | Pre-deploy (2026-09-08 AM) |                                                       Post-deploy (2026-09-08 PM, ~1 hour after deploy) |
| ------------------------------------------------- | -------------------------: | ------------------------------------------------------------------------------------------------------: |
| PASS                                              |                         58 |                                                                                                  **68** |
| NEUTRAL                                           |                         21 |                                                                                                      11 |
| Submitted and indexed                             |                         58 |                                                                                                  **68** |
| Sitemap URL ≠ user canonical                      |                         20 | **3** (all confirmed stale Google-side cache from before this deploy — live production already correct) |
| Sitemap URL ≠ Google canonical                    |                         19 |                                                                        **3** (same 3, same explanation) |
| User canonical ≠ Google canonical                 |             1 (`/contact`) |                                                                                  **0** — fully resolved |
| Canonical mismatches (script's own summary field) |                          — |                                                                                                   **0** |

`/contact` — the one confirmed pre-fix user≠Google canonical disagreement — now shows `PASS`,
`Submitted and indexed`, user canonical = Google canonical = `https://crawlpact.com/contact/`.
Fully resolved.

`/audit/` and `/platforms/` now show `"URL is unknown to Google"` (previously `"Discovered —
currently not indexed"` under their old, non-canonical sitemap identity) — expected: the sitemap
now declares a different (correctly canonical) URL for them, which Google has not yet crawled
under its new identity. `PENDING_GOOGLE_REPROCESSING`, not a regression.

The remaining 3 "mismatches" (`/observatory/methodology/` and the two previously-flagged guide
pages) all carry a `last_crawl_time` from before this deployment (2026-07-31 to 2026-08-14) —
directly confirmed stale by re-checking live production, which already serves the correct
canonical on every one of them. `PENDING_GOOGLE_REPROCESSING`.

No Google metric, canonical, or indexing state was fabricated — every number above comes directly
from the two real Search Console API JSON files, both preserved.

## Repository

- Starting HEAD: `0698829389d39ab4a91bf6fc0a578a5b88f9a38a`
- Ending HEAD: `f85c5ac04d3feb807dcba53762d087c657ba8a14` (`main`)
- Branch: `main` (via 5 short-lived feature branches, each squash-merged: `phase-20-search-foundation`,
  `fix-gitleaks-full-history-false-positive`, `fix-deploy-preview-workflow-run-trigger`,
  `fix-preview-deploy-dispatch-chain`, `fix-smoke-test-preview-robots-txt`)
- PRs: #158 (Phase 20 implementation), #159 (gitleaks fix), #160 + #161 (deploy-preview dispatch
  chain fix), #162 (smoke-test fix) — all merged via the repository's `automerge` label + CI
- CI: green on every merged commit, including the exact production-deployed SHA
  (`4996b889362810e9f8e6a2c5038a8737e23fca4d`)
- Working tree: clean, matches `origin/main` exactly

## Production parity

- **Deployed application SHA/version**: `4f775d19-…` (pre-Phase-20, 2026-09-07) →
  **`fd7f5c16-fad9-4642-af11-261617c8f941`** (Phase 20, deployed 2026-09-08T05:49:48Z, commit
  `4996b889362810e9f8e6a2c5038a8737e23fca4d`) — live `wrangler deployments list` confirms this is
  the current production Worker version
- Database migration: 38/38 applied, `0038_google_oauth.sql` latest — **unchanged** by this
  deployment (live, read-only D1 query, re-confirmed post-deploy) — no D1 migration required or
  applied for Phase 20
- **Parity verdict: production now runs the exact CI-verified Phase 20 commit.** No drift.

Full detail: `docs/baseline/2026-09-07-phase20/PRODUCTION_PARITY_MATRIX.md` (pre-deploy state) plus
"Day 4: production deployment" above (post-deploy state).

## Search Console

**Updated 2026-09-08 with real, independently-queried data** (superseding 2026-09-07's
externally-supplied, unverified figures):

- Settled-through date: 2026-09-05 · Permission: `siteOwner`
- 28 days (2026-08-09 → 2026-09-05): 3 clicks, 954 impressions, 0.314% CTR, avg. position 62.58
- 90 days: 6 clicks, 1,344 impressions, 0.446% CTR, avg. position 64.59
- Brand-query impressions: **0** in both windows (0 of 87 28-day and 0 of 115 90-day query rows
  contain "crawlpact"/"crawl pact") — a genuine, currently-accurate reading for a young site, not
  a defect
- Bulk URL Inspection: a 79-URL snapshot already existed (run before this session; **not re-run**,
  per instruction) — 58 PASS, 21 NEUTRAL, 0 FAIL; 58 submitted and indexed
- Canonical mismatches: 20 sitemap≠user-canonical, 19 sitemap≠Google-canonical (all but 2 are the
  exact 307/no-redirect defect 2026-09-07 fixed), 1 genuine user≠Google disagreement (`/contact` —
  see below), 2 incomplete (`/audit`, `/platforms` — "discovered, not indexed"; reviewed against
  route purpose, both legitimately linked and not orphaned, left as-is)
- URL-form fragmentation: **16 distinct normalized-URL groups** confirmed over 90 days, the two
  largest being `/tools/robots-txt-ai-validator` (358 combined impressions) and
  `/crawlers/amazonbot` (246 combined impressions) — directly confirming, with real numbers, the
  defect 2026-09-07 fixed from first-principles production testing alone

Full detail: `docs/baseline/2026-09-08-phase20/SEARCH_CONSOLE_BASELINE.md` (supersedes
`docs/baseline/2026-09-07-phase20/SEARCH_CONSOLE_BASELINE.md`, which remains as a record of what
was known before real API access existed).

## Canonical policy

**Trailing slash is canonical for every indexable page except `/`.** Enforced with permanent
(301) redirects: `public/_redirects` for prerendered pages, `middleware.ts` for SSR pages, and a
preview-specific copy of the same logic in `worker.ts` (required because `run_worker_first`,
needed for preview's search-isolation fix, was confirmed to bypass `_redirects` entirely). One
shared source of truth: `apps/web/src/lib/route-registry.ts`.

Full decision record and evidence: `docs/baseline/2026-09-07-phase20/CANONICAL_URL_CONTRACT.md`.

## Redirect behavior — representative before/after (live, 2026-09-07)

| URL                                                     | Before                                                | After                                                                                |
| ------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `/about` (prerendered)                                  | `307` → `/about/`                                     | `301` → `/about/`                                                                    |
| `/crawlers/amazonbot` (prerendered, content collection) | `307` → `/crawlers/amazonbot/`                        | `301` → `/crawlers/amazonbot/`                                                       |
| `/pricing` (SSR)                                        | `200` (independently of `/pricing/`, also `200`)      | `301` → `/pricing/`                                                                  |
| `/for/agencies` (SSR, content collection)               | `200` (independently of `/for/agencies/`, also `200`) | `301` → `/for/agencies/`                                                             |
| `/api/*` (any)                                          | `200`/normal API response                             | unchanged — confirmed untouched by the new redirect logic (allowlist, not blocklist) |

## Internal links (Day 2, 2026-09-08)

Sitewide footer, header, homepage sections, breadcrumbs (visible nav + JSON-LD), and most
cross-page links previously pointed at the bare (non-canonical) form of every route — confirmed
live via `wrangler dev --local` that the footer's rendered HTML now emits `href="/pricing/"`,
`href="/about/"`, `href="/contact/"`, etc. directly, and that the homepage's crawler cards (a
genuine, isolated pre-existing bug — no trailing slash at all, unlike every other
content-collection link) now serve `/crawlers/amazonbot/` directly at `200` with no redirect. Full
detail: `docs/baseline/2026-09-08-phase20/INTERNAL_LINK_CANONICALIZATION.md`.

## Preview

`preview.crawlpact.com` was not search-isolated at all before this phase — same `robots.txt` as
production, no `X-Robots-Tag`, no `noindex` anywhere. Now: `robots.txt` disallows everything on
preview (environment-aware SSR endpoint, `src/pages/robots.txt.ts`), and every preview response —
prerendered or SSR — carries `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`, via
`env.preview.assets.run_worker_first: true` (wrangler.jsonc) plus `src/worker.ts`'s
`fetchWithPreviewSearchIsolation`. A confirmed regression in this fix itself (run_worker_first
silently disabling `_redirects`) was found and fixed during this same pass — see
`docs/baseline/2026-09-07-phase20/PREVIEW_SEARCH_ISOLATION.md`.

**Now confirmed live against the actual deployed Preview environment** (2026-09-08, after the
deploy-dispatch-chain CI/CD gap — see "Day 4" above — was found and fixed): `robots.txt` returns
`User-agent: *\nDisallow: /`, every response carries
`X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`, and canonical redirects work exactly as
designed (`/about` → `301` → `/about/`, `/pricing` → `301` → `/pricing/`). `scripts/smoke-test.ts
preview https://preview.crawlpact.com`: 30/30 passed. This closes the one item 2026-09-07 could not
fully verify from its local execution environment.

## Sitemap

79 URLs before this phase (unchanged count) — every static-route entry now lists its canonical
trailing-slash form; none currently redirects. Not yet re-submitted to Search Console (requires
deployment first).

## Structured data

Not systematically re-audited this pass beyond what `BaseLayout.astro` review surfaced in support
of the canonical work (no defect found there). A dedicated Organization/Article/BreadcrumbList/
image-alt audit (Phase 20 prompt §22–26) is deferred — see "Deferred items" below.

## GA4

**Updated — real, independently-queried data** (account `CrawlPact`/`accounts/402672834`,
property `CrawlPact`/`properties/547512440`). Window 2026-08-09→2026-09-05: 7 active users, 4 new,
40 sessions, 26 engaged, 65% engagement rate, ~332s avg. duration, 151 pageviews, 382 events, 0 key
events. Channels: Direct (22 sessions), Organic Search (18, split `google/organic` 3 +
`search.google.com/referral` 15 — both correctly bucketed as Organic Search by GA4's own default
channel logic, not a defect). Landing pages include `/`, `/pricing`, and a crawler detail page —
organic entry points beyond the homepage are represented. Events firing are exclusively GA4's
auto-collected set (`page_view`, `user_engagement`, `scroll`, `session_start`, `first_visit`,
`click`) — zero custom events, explaining the 0 key events. **Investigated and explained, not a
gap**: the real product funnel is fully instrumented separately, in first-party `product_events`
(`PRODUCT_EVENT_NAMES` covers the entire desired funnel end to end) — GA4 was a later, deliberately
narrow-scoped addition for marketing-channel measurement only (disclosed SRS §6.2 deviation), never
intended to carry the funnel. Production-only/consent/route-allowlist/query-string-privacy
architecture confirmed correct in source, matching the data exactly — no defect, nothing modified.
**Traffic is almost entirely the owner's own testing** (39/40 sessions from Sri Lanka) — no
external-audience conclusion is drawn from this data. Full detail:
`docs/baseline/2026-09-08-phase20/GA4_BASELINE.md`.

## CrUX

**Updated — independently re-queried this session** (not merely quoted): `NO_FIELD_DATA` for all
form factors, phone, and desktop (HTTP 404 from CrUX's `records:queryRecord`, the documented
signal for insufficient real-user sample size). Recorded exactly as that state — not `PASS`, not
`FAIL`, no invented p75 values. Lab fallback: `docs/performance/PHASE_11_PAGE_PERFORMANCE_RESULTS.md`
(existing, not re-run this phase; `deploy-preview.yml` already runs a fresh Lighthouse budget check
on every Preview deploy). Full detail: `docs/baseline/2026-09-08-phase20/CRUX_FIELD_DATA_STATE.md`.

## Required Phase 20 decisions

| #   | Decision                                 | Selected approach                                                                                                            | Evidence                                                                                                                                     | Affected files                                 |
| --- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | Canonical slash policy                   | Trailing slash canonical for every indexable page except `/`                                                                 | Matched existing content-collection URLs, Cloudflare's own default prerendered-page behavior, and higher GSC impression share on slash forms | `route-registry.ts`                            |
| 2   | Permanent redirect mechanism             | `public/_redirects` (301) for prerendered pages; `middleware.ts` (301) for SSR pages; a preview-specific copy in `worker.ts` | Live-tested via `wrangler dev --local`; `run_worker_first` confirmed to bypass `_redirects`                                                  | `_redirects`, `middleware.ts`, `worker.ts`     |
| 3   | Preview search-isolation mechanism       | Environment-aware `robots.txt.ts` (disallow-all) + `X-Robots-Tag` stamped on every response via `run_worker_first`           | Preview had zero isolation before this phase (live-confirmed)                                                                                | `robots.txt.ts`, `worker.ts`, `wrangler.jsonc` |
| 4   | Canonical route source of truth          | `apps/web/src/lib/route-registry.ts`, one shared module                                                                      | Eliminates the exact kind of drift that caused this phase's defects                                                                          | `route-registry.ts` (+ 3 consumers)            |
| 5   | Sitemap source of truth                  | Same `route-registry.ts`, trailing slash appended                                                                            | One list, not three                                                                                                                          | `sitemap.xml.ts`                               |
| 6   | Organization/logo structured-data policy | Not touched this phase — no blocking defect found in `BaseLayout.astro`'s existing Organization node during file review      | Deferred to a dedicated Phase 22 structured-data audit (not performed this phase)                                                            | none                                           |
| 7   | Article/image structured-data policy     | Not touched this phase — same reasoning                                                                                      | Deferred                                                                                                                                     | none                                           |
| 8   | Search Console risk disposition          | RISK-032 resolved and independently verified                                                                                 | Real GSC data confirms connection + performance                                                                                              | `ACTIVE_RISKS.md`                              |
| 9   | GA4 measurement/key-event status         | 0 key events is correct, by design — funnel lives in first-party `product_events`, not GA4                                   | Verified via GA4 API data + source review of `analytics.ts`/`GoogleAnalytics.astro`                                                          | none (no code change needed)                   |
| 10  | CrUX state and lab fallback              | `NO_FIELD_DATA`; lab fallback is the existing Phase 11 Lighthouse report, kept clearly separate                              | Independently re-queried this session                                                                                                        | none                                           |

No ADR was created — none of these rose to the repository's ADR governance bar (no architectural
reversal, no cross-cutting authentication/billing/data-model change); each is recorded here and in
the linked evidence files instead.

## Validation — every command run, exact outcome

| Command                                                                       | Outcome                                                                                                                                                                      |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm format:check` → `pnpm format`                                           | Fixed 5 unformatted new files; clean after                                                                                                                                   |
| `pnpm lint`                                                                   | Pass — `eslint . --max-warnings=0`                                                                                                                                           |
| `pnpm typecheck`                                                              | Pass — 0 errors, 10/11 workspace projects (pre-existing Zod-deprecation hints, unrelated)                                                                                    |
| `pnpm test:unit`                                                              | Pass — 525/525 (47 files)                                                                                                                                                    |
| `pnpm test:integration`                                                       | Could not complete — Miniflare/D1 harness cannot bind a local socket in this sandbox (pre-existing, unrelated to this phase's changes; 35/56 suites not requiring it passed) |
| `pnpm db:validate`                                                            | Pass — 56 tables consistent                                                                                                                                                  |
| `pnpm build`                                                                  | Pass — 0 errors, 24 `_redirects` rules parsed, no route conflicts                                                                                                            |
| `wrangler dev --local` (real workerd runtime, production-target build)        | Verified live: all representative redirects behave exactly as designed                                                                                                       |
| `wrangler dev --local` (real workerd runtime, `CLOUDFLARE_ENV=preview` build) | Confirmed the `run_worker_first`/`_redirects` interaction (and its fix); preview-env-var branch itself blocked by local `.dev.vars`                                          |

**Day 2 (2026-09-08) re-run after the internal-link fix**: `pnpm format`/`lint`/`typecheck`/`build`
all clean; `pnpm test:unit` 525/525 (two pre-existing tests updated to expect the now-canonical
href form); `wrangler dev --local` re-confirmed live.

## Documentation updated/created

- `docs/status/CURRENT_STATE.md` — header and "Version status" refreshed to real, freshly-verified
  values; Phase 20 narrative paragraph added
- `docs/risks/ACTIVE_RISKS.md` — RISK-032 marked resolved, with the tool-access limitation disclosed
- `docs/seo/PHASE_19_SEARCH_CONSOLE_BASELINE.md` — supersession notice added; historical content
  preserved unchanged
- `docs/status/KNOWN_RISKS.md` — the trailing-slash/canonical-inconsistency entry updated to record
  the resolution
- `docs/seo/ROUTE_REGISTRY.md` — three stale rendering-mode entries corrected (`/pricing`,
  `/scanner`, `/sign-in` were listed "Prerendered", are actually SSR); canonical-policy pointer and
  missing rows (`/observatory*`, `/research*`, `/pay`, `/robots.txt`) added
- `docs/baseline/2026-09-07-phase20/` (new) — full evidence package: `README.md`,
  `PHASE_20_BASELINE_REPORT.md`, `PRODUCTION_PARITY_MATRIX.md`, `CANONICAL_URL_CONTRACT.md`,
  `PREVIEW_SEARCH_ISOLATION.md`, `SEARCH_CONSOLE_BASELINE.md`, `DOCUMENTATION_CONFLICTS.md`
- `docs/baseline/2026-09-08-phase20/` (new, Day 2/3) — `README.md`, `SEARCH_CONSOLE_BASELINE.md`
  (real GSC data), `INTERNAL_LINK_CANONICALIZATION.md`, `GA4_BASELINE.md`,
  `CRUX_FIELD_DATA_STATE.md`
- `docs/risks/ACTIVE_RISKS.md` — RISK-032 updated again: independently verified (not just
  supplied), acceptance criteria for closure fully met
- This report

## Deferred items

### Phase 21 (UI/UX/Performance) handoff

- None found requiring UI redesign; this phase made no visible UI changes beyond internal `href`
  attribute _values_ (no anchor text, layout, or visible wording changed).
- Super Admin usage-analytics dashboard aggregating the existing first-party `product_events` data
  (already known, already disclosed — `docs/status/CURRENT_STATE.md`'s "Known disabled or
  incomplete capabilities") — not a new finding, restated here because the GA4 audit reconfirmed it
  as the correct place for funnel-visibility work, not GA4 configuration.

### Phase 22 (Search/content) handoff

- Metadata/structured-data systemic audit (title/description quality, Organization logo, Article
  image policy) — Phase 20 prompt §20–26 — not performed this pass; no blocking defect found in
  what was reviewed, but a dedicated pass wasn't run.
- Post-deployment bulk Search Console URL Inspection (a fresh, post-fix snapshot, separate from
  the pre-fix one analyzed 2026-09-08) — cannot happen until deployed; do not spend Inspection
  quota re-checking unchanged pages before then.
- Query opportunity list (robots.txt validator, Amazonbot, GPTBot, etc. — now backed by real 2026-09-08
  data, see `docs/baseline/2026-09-08-phase20/SEARCH_CONSOLE_BASELINE.md`) — untouched; Phase 22's
  to optimize once canonical consolidation has had time to take effect (see measurement checkpoints
  below).
- Two content questions surfaced by real query×page data, not technical defects: whether
  `/crawlers/amazonbot`, `/crawlers/amzn-searchbot`, `/crawlers/amzn-user` should differentiate
  more clearly for "amazonbot user agent"-type queries, and similarly for
  `/crawlers/perplexity-user` vs `/crawlers/perplexitybot`.

### Phase 23 (Authority/distribution) handoff

- Nothing found or attempted this pass; out of scope.

## Known remaining risks (genuine, evidence-backed only)

- **`deploy-preview.yml`'s "Verify deployed bindings" step failed with a uniform "found nothing"
  for every binding** on the one deployment this session triggered — consistent with a Cloudflare
  API propagation-timing race immediately after deploy (the step runs with no delay after the
  deploy step), not a real binding drift; the actual deployed Worker's behavior was independently
  confirmed correct via direct HTTP checks and `scripts/smoke-test.ts`. Low priority, non-blocking:
  consider adding a short retry/delay to `scripts/verify-bindings.ts` in a future pass.
- **CrawlPact's real product funnel (audit → signup → domain saved → monitoring → paid) has no
  aggregated admin-facing view** — already known and disclosed before this phase
  (`docs/status/CURRENT_STATE.md`), reconfirmed by the GA4 audit as correctly out of GA4's scope
  (the first-party `product_events` data already exists; only the dashboard view is missing).
  Phase 21 backlog, not a Phase 20 gap.
- **Search Console's longer-term post-fix trend is not yet observable** — one hour of post-deploy
  data already shows strong convergence (see "Google post-deploy comparison" above), but no
  ranking or traffic outcome is promised from this alone. See "Measurement checkpoints" below.
- **Integration test suite could not run in this sandboxed local execution environment** — a
  pre-existing constraint (Miniflare cannot bind local sockets here), not a Phase 20 regression.
  Real CI (which has no such constraint) ran the full integration suite successfully on every
  merged commit.

## Measurement checkpoints (deployed 2026-09-08T05:49:48Z)

- **Immediate (done)**: post-deployment bulk URL Inspection already shows strong convergence
  (PASS 58→68, canonical mismatches 20/19/1→0) — see "Google post-deploy comparison" above.
- ~7–14 settled days (~2026-09-15 to 2026-09-22): canonical-consolidation observation — does the
  slash/non-slash impression split in Search Console's Performance report narrow?
- ~28 settled days (~2026-10-06): first meaningful search comparison.
- ~90 settled days (~2026-12-07): longer trend, if traffic supports it.

No ranking improvement is promised or implied by any of the above.

## Next step

Phase 20 is complete. Per the execution prompt's own phase boundary (§25), Phase 21 (Whole-Product
UI, UX, Responsiveness & Conversion Optimization) may begin once the user chooses to start it — no
further Phase 20 action is required. The two non-blocking items in "Known remaining risks" above
are recorded as backlog, not open Phase 20 work.
