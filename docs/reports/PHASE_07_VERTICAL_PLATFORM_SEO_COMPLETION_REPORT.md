# Phase 7 — Vertical Landing Pages and Platform SEO Architecture — Completion Report

## Executive summary

Phase 7 built and quality-gated 4 audience-specific vertical landing pages (`/for/agencies`,
`/for/publishers`, `/for/saas-and-documentation`, `/for/web-developers`) and a platform-guide hub
(`/platforms`) plus 5 verified, source-cited platform guides (`/platforms/cloudflare`,
`/platforms/wordpress`, `/platforms/shopify`, `/platforms/vercel`, `/platforms/netlify`) — meeting
the phase's required minimum on both content types (4/4, 5/5). The 5 extended platform guides
(nginx, apache, fastly, akamai, GitHub Pages) were deliberately deferred per the phase prompt's own
stated permission, not silently dropped (RISK-031).

**Status: substantially complete.** All required content, infrastructure, tests, and governance
docs are built and passing on the feature branch `phase-07-vertical-platform-seo`. Not yet merged
or deployed to production as of this report — see "Next steps" below for what remains and the
explicit confirmation this document does not itself grant.

## Starting point

`docs/seo/PHASE_07_PRODUCTION_PRECONDITION_RECORD.md` records the pre-flight check: 0 open P0
risks, all required-operational capabilities confirmed live, RISK-001 (real paid checkout) open but
explicitly out of this phase's scope. That same check found and disclosed that
`docs/status/CURRENT_STATE.md` and `docs/status/REQUIREMENTS_TRACEABILITY.md` predated Phases 5–6
— corrected as part of this phase's own governance pass (see "Governance updates" below).

## What was built

### Content architecture

Two new typed content collections (`apps/web/src/content.config.ts`): `verticals` and `platforms`,
each with a zod schema enforcing required fields (title/description/dates, `recommendedPlan` enum
for verticals, `officialSources`/`platformDocsVerifiedDate` for platforms — see
`docs/content/VERTICAL_PAGE_CONTENT_STANDARD.md` and `docs/content/PLATFORM_GUIDE_CONTENT_STANDARD.md`
for the full requirement list each entry must meet).

### Vertical landing pages (`/for/<slug>`)

`apps/web/src/pages/for/[slug].astro` — **SSR** (`prerender = false`), the one deliberate exception
to this codebase's otherwise-universal prerendered content-collection pattern, because its
"plan guidance" section reads live pricing via `getPlanCatalog()` (the same Phase 6
single-source-of-truth call `pricing.astro` itself makes) — a prerendered page has no D1 binding at
build time. See `docs/seo/SITEMAP_AND_INDEXABILITY_POLICY.md` for the full rationale.

4 content files (`apps/web/src/content/verticals/*.md`), each ~700–900 words, grounded in the real
entitlement matrix (`docs/billing/APPROVED_PRICING_AND_ENTITLEMENT_MATRIX.md`: Solo $9/mo–$89/yr 5
domains monthly monitoring, Pro $19/mo–$189/yr 25 domains weekly, Agency $39/mo–$389/yr 100 domains
weekly), each with an explicit "what this does not include" section (no client portal, no
per-seat roles, no real-time monitoring, no ownership verification — matching this codebase's
"claim not copy" discipline), a genuinely distinct primary problem per audience (see
`docs/seo/SEARCH_INTENT_AND_PAGE_MAP.md`'s per-page intent table), and real internal links to
existing guide/crawler/platform pages.

### Platform guides (`/platforms`, `/platforms/<slug>`)

`apps/web/src/pages/platforms/index.astro` (hub, prerendered, groups guides by
`platformCategory`) and `apps/web/src/pages/platforms/[slug].astro` (prerendered via
`getStaticPaths()`). 5 content files (`apps/web/src/content/platforms/*.md`), each researched via
real `WebSearch`/`WebFetch` retrieval of official vendor documentation this session — every
technical claim traces to `docs/seo/PLATFORM_CLAIM_SOURCE_REGISTER.md` (24 claims: CF-1–8, WP-1–5,
SH-1–6, VC-1–6, NF-1–5, each with exact claim text, source URL, access date `2026-08-04`, and
`Verified` status). The "Official references" section is rendered directly from the
`officialSources` frontmatter array by `[slug].astro` — never hand-duplicated in the Markdown body
(`scripts/content-validate.mjs` now permanently guards against this exact regression — see below).

### Deferred: Stage 7D (extended platform guides)

nginx, apache, fastly, akamai, and GitHub Pages guides were not built this session. The phase
prompt explicitly permits deferring Stage 7D when the research/evidence/uniqueness bar isn't met,
and explicitly prohibits publishing to hit a page count. Tracked as `docs/risks/ACTIVE_RISKS.md`
RISK-031 and routed to a follow-up GitHub issue (not a numbered phase).

### Navigation and internal linking

One new flat header nav link ("Platforms", `SiteHeader.astro`) — a deliberate simplification from
an earlier draft that considered a dropdown/menu component, self-corrected to avoid adding new
keyboard-nav/accessibility surface this late in an already-large phase (see
`docs/seo/INTERNAL_LINK_ARCHITECTURE.md`). A new homepage `VerticalsSection.astro` (4-card teaser
between `CrawlerPurposeSection` and `AgencySection`) and a new footer "Solutions" column (5 links:
4 verticals + platform hub) ensure every new page is reachable from at least two paths, never
orphaned.

### Analytics

9 new first-party product events (`apps/web/src/lib/analytics.ts`) — see
`docs/analytics/PHASE_07_CONTENT_CONVERSION_EVENT_MODEL.md` for the full firing table. Verified
live against the local dev server: all 9 names accepted by `POST /api/analytics/track` (`HTTP 200`),
an unrecognised name rejected (`HTTP 400 VALIDATION_FAILED`) — see that doc's "Consistency check".

### Sitemap and indexability

`apps/web/src/pages/sitemap.xml.ts` extended with `getCollection("verticals")`/`getCollection("platforms")`
and `/platforms` added to `STATIC_ROUTES`. A deferred/unbuilt platform guide cannot leak into the
sitemap or become indexable because its content file simply doesn't exist yet — no draft flag to
forget (`docs/seo/SITEMAP_AND_INDEXABILITY_POLICY.md`).

## Quality gates — real evidence

| Gate                                                                                                                | Result                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run content:validate` (new, wired into `pnpm quality`)                                                        | **PASSED** — 4 verticals, 5 platforms checked (0 errors, 0 warnings)                                                                                                                                                                                                                                                                                |
| `pnpm run content:links:check` (new, manual/scheduled)                                                              | **PASSED** — 11 official source links checked; 1 known bot-blocked host (`help.shopify.com`, manually re-verified reachable via a full browser-rendered fetch) explicitly allowlisted with a dated comment                                                                                                                                          |
| `pnpm run quality` (format, lint, typecheck, unit, integration, db:validate, content:validate, build)               | **PASSED**, exit 0                                                                                                                                                                                                                                                                                                                                  |
| `pnpm run trust:validate`                                                                                           | **PASSED** — 395 files scanned (covers the new `/for/*`/`/platforms/*` content automatically — no country/address/registration/tax/negative-support-wording found)                                                                                                                                                                                  |
| `pnpm run verify:push` (full local CI reproduction)                                                                 | **PASSED**, exit 0 — 315 unit tests, 173 integration tests, 103 Chromium e2e tests, 97 Chromium a11y tests, secret scan clean                                                                                                                                                                                                                       |
| `apps/web/tests/e2e/seo-metadata.spec.ts` (sitemap-driven + new Phase 7 JSON-LD/breadcrumb block)                   | **10/10 passed** (2 initially failed — see "Bug found and fixed" below)                                                                                                                                                                                                                                                                             |
| `apps/web/tests/a11y/home.spec.ts` (10 new Phase 7 routes)                                                          | **10/10 passed**, zero automatically-detectable WCAG 2.2 AA violations                                                                                                                                                                                                                                                                              |
| `apps/web/tests/e2e/responsive-smoke.spec.ts` (2 new Phase 7 tests × 5 viewports: 360/768/1280/1440/1920px)         | **12/12 passed**, zero horizontal overflow                                                                                                                                                                                                                                                                                                          |
| Visual verification (390/768/1440px screenshots, all 5 `/platforms/*` guides + `/platforms` hub + 4 `/for/*` pages) | Manually reviewed — clean rendering, correct header/footer/breadcrumb/CTA placement at all three widths (screenshots kept local per `ADR-0008`, never committed as visual-regression baselines)                                                                                                                                                     |
| `scripts/lighthouse-check.mjs` (extended with `/for/agencies`, `/platforms/cloudflare`)                             | Run against local dev server only this session (script is designed for the real preview Worker post-deploy — see `docs/seo/PHASE_07_SEARCH_PERFORMANCE_BASELINE.md`); Accessibility 100/100, CLS 0/0, SEO 92/92 — identical to pre-existing pages, no template-specific regression. True production numbers require the next preview-Worker CI run. |

### Bug found and fixed: breadcrumb-regex false positive

The first Phase 7 JSON-LD test run found 2/5 failures: `/platforms/cloudflare` and
`/platforms/wordpress` resolved the visible breadcrumb text as `"Platforms"` instead of
`"Cloudflare"`/`"WordPress"`. Root cause: `SiteHeader.astro`'s own "Platforms" nav link also
carries `aria-current="page"` for any path starting with `/platforms` (including
`/platforms/cloudflare`), and it appears earlier in the HTML than the page's own breadcrumb nav —
the original page-wide regex matched the header link, not the breadcrumb. Fixed by scoping the
match to inside the `<nav aria-label="Breadcrumb">` element specifically
(`apps/web/tests/e2e/seo-metadata.spec.ts`). Re-ran: 10/10 passed.

### Astro `<script>`-in-JSX-ternary parse failure

Both `/for/[slug].astro` and `/platforms/[slug].astro`'s click-delegation `<script>` (containing
`closest<HTMLElement>(...)`) originally sat nested inside a JSX conditional. Prettier/the Astro
compiler failed to parse the TypeScript generic in that position. Fixed by moving both `<script>`
tags to the template's top level, as a sibling after the conditional — matching `index.astro`'s
own pre-existing, unmodified pattern at the same nesting depth.

### Self-caught documentation/implementation inconsistency

`docs/content/PLATFORM_GUIDE_CONTENT_STANDARD.md` states "Official references" must be
template-generated, never hand-maintained — but all 5 platform `.md` files were initially written
with a hand-authored `## Official references` section anyway. Caught and fixed before this report:
removed the hand-written sections from all 5 files, confirmed the template-generated version
renders correctly, and added a permanent regression guard to `scripts/content-validate.mjs` (fails
the build if any platform guide's body ever contains a hand-written `## Official references`
heading again).

## Governance updates

- `docs/status/CURRENT_STATE.md` and `docs/status/REQUIREMENTS_TRACEABILITY.md`: corrected for the
  Phase 5–6 staleness this phase's own precondition check found (commit reference, migration count
  21/21, DB-backed monthly/annual billing catalog replacing the stale annual-only claim) — promised
  in the precondition record, delivered here.
- `docs/risks/ACTIVE_RISKS.md`: added RISK-031 (Stage 7D deferral) and RISK-032 (no Search Console
  property connected).
- `docs/governance/DOCUMENTATION_INVENTORY.md`: added the "Phase 7 update" section (14 new files).
- `docs/roadmap/CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md`: Phase 6 marked complete, Phase 7
  marked substantially complete (pending deploy), Gate B marked complete, Phase 8's objective
  extended to carry forward the tagline/`package.json`-description backlog items that neither Phase
  6 nor Phase 7 addressed (each correctly out of scope for its own execution prompt).
- `docs/governance/GITHUB_GOVERNANCE_SETUP_MANIFEST.md`: added the "Phase 7 update" section listing
  follow-up issues to create (Stage 7D, Search Console gap, header-dropdown revisit trigger, plus
  the 6 Phase-6-originated items re-routed from `phase-07` to `phase-08` since this phase correctly
  didn't touch billing/checkout).
- `CHANGELOG.md`: Phase 7 entry added under `## Unreleased` (not yet a dated release — matches this
  file's own stated convention that a dated heading means "actually deployed to production").

## Scope discipline

Confirmed no crawler-evaluation logic, scanner/safe-fetch code, pricing/Paddle/checkout code,
monitoring-frequency logic, authentication, or admin surface was touched — verified via `git status`
(file list below) and the threat review's explicit file-by-file read of the two new dynamic-input
surfaces (`docs/security/PHASE_07_CONTENT_AND_SEO_THREAT_REVIEW.md`).

## Files changed

**New**: `apps/web/src/content/verticals/*.md` (4), `apps/web/src/content/platforms/*.md` (5),
`apps/web/src/pages/for/[slug].astro`, `apps/web/src/pages/platforms/{index,[slug]}.astro`,
`apps/web/src/components/homepage/VerticalsSection.astro`, `scripts/content-validate.mjs`,
`scripts/content-links-check.mjs`, 14 governance/content docs (see
`docs/governance/DOCUMENTATION_INVENTORY.md`'s "Phase 7 update").

**Modified**: `apps/web/src/content.config.ts`, `apps/web/src/lib/analytics.ts`,
`apps/web/src/pages/{index,sitemap.xml}.ts/.astro`, `apps/web/src/components/{SiteHeader,SiteFooter}.astro`,
`apps/web/tests/{a11y/home.spec.ts,e2e/seo-metadata.spec.ts,e2e/responsive-smoke.spec.ts}`,
`scripts/lighthouse-check.mjs`, `package.json` + `pnpm-lock.yaml` (added `yaml` devDependency for
the two new content-validation scripts), `docs/seo/{EDITORIAL_SOURCE_AND_CONTENT_POLICY,ROUTE_REGISTRY,SEO_CONTENT_GOVERNANCE}.md`,
`docs/status/{CURRENT_STATE,REQUIREMENTS_TRACEABILITY}.md`, `docs/risks/ACTIVE_RISKS.md`,
`docs/governance/{DOCUMENTATION_INVENTORY,GITHUB_GOVERNANCE_SETUP_MANIFEST}.md`,
`docs/roadmap/CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md`, `CHANGELOG.md`.

## Next steps

1. Create the follow-up GitHub issues listed in `docs/governance/GITHUB_GOVERNANCE_SETUP_MANIFEST.md`'s
   "Phase 7 update" section.
2. Commit, push, open a PR (title: `feat(seo): add vertical landing pages and verified platform
guides`), wait for CI to go green, merge.
3. Request a fresh, separate, explicit, in-the-moment confirmation before deploying to production —
   this report does not itself grant that authorization, consistent with every prior phase's
   established pattern.
4. Once deployed: re-run `scripts/lighthouse-check.mjs` against the real preview/production Worker
   for true (not dev-server) performance numbers on the two new templates; complete the manual
   Search Console checklist once a property exists; move this changelog entry from `## Unreleased`
   to a dated production-deployment entry, matching every prior phase's pattern.
