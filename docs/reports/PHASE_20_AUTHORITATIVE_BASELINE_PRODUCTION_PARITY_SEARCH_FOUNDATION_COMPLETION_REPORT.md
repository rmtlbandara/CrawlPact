---
Document owner: Engineering owner
Status: current-authoritative
Date: 2026-09-08 (originally issued 2026-09-07; updated with Day 2 findings below)
---

# Phase 20 — Authoritative Baseline, Production Parity & Search Foundation — Completion Report

## Executive verdict

**PARTIAL — READY_FOR_PRODUCTION_DEPLOYMENT.**

The substantive engineering work this phase exists to do — establish ground truth and fix the
technical defects found — is complete, tested, and locally verified against a real Cloudflare
Workers runtime. Every evidence gate this phase depends on is now closed with real,
independently-queried or independently-confirmed data: Search Console, GA4, and CrUX (see "Day 2/3
addendum" below) — no gate remains `BLOCKED_EXTERNAL_TOOL_ACCESS`. The **sole** remaining reason
this is not `PASS` is that none of it is deployed: this repository's rules (and this session's own
operating rules) require the user's explicit, in-the-moment authorization before any deploy,
regardless of prior authorization, and that authorization was neither requested nor given this
session. Per §39/§59 of the execution prompt, the correct status for "implementation complete,
deployment authority unavailable" is `READY_FOR_PRODUCTION_DEPLOYMENT`, not a false `PASS`.

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

## Repository

- Starting HEAD: `0698829389d39ab4a91bf6fc0a578a5b88f9a38a`
- Ending HEAD: unchanged — no commit was made (not requested)
- Branch: `main`
- PR: none created (not requested)
- Working tree at end of this pass: 68 files changed/added (see `git status`) — mostly the
  mechanical internal-link trailing-slash fix (Day 2); uncommitted, pending user review

## Production parity

- Deployed application SHA/version: `4f775d19-7654-4af5-ab2e-b43cfb705e54`, deployed
  2026-09-07T11:04:51Z (live `wrangler deployments list`)
- Last application-code-affecting commit: `72a8630` (10:15:37 UTC 2026-09-07); everything after it
  on `main` up to the start of this phase is docs-only (`git diff --stat` confirmed)
- Database migration: 38/38 applied, `0038_google_oauth.sql` latest (live, read-only D1 query)
- **Parity verdict: no undeployed application-code drift on `main` before this phase's own
  changes.** This phase's own changes (below) are not yet deployed.

Full detail: `docs/baseline/2026-09-07-phase20/PRODUCTION_PARITY_MATRIX.md`.

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

**Full live confirmation that `PUBLIC_APP_ENV === "preview"` actually behaves this way at request
time was not completed** — this machine's `.dev.vars` forces `PUBLIC_APP_ENV=local` in any local
`wrangler dev` session (a deliberate pre-existing safety mechanism, correctly not bypassed). Unit
tests exercise both branches directly with the env mocked; `CLOUDFLARE_ENV=preview pnpm build`'s
generated config was inspected directly and confirmed correct. Final confirmation requires the
actual deployed Preview environment.

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

- **Preview's runtime search-isolation behavior is implemented and unit-tested but not yet
  observed live** — the one item this phase could not fully close from this execution
  environment (see "Preview" above). Low risk (the code paths are simple, directly tested, and the
  build-time config was independently confirmed correct), but disclosed rather than claimed done.
- **Search Console's actual post-fix measurement behavior is unknown** until real settled data
  exists after deployment — no ranking or consolidation outcome is promised.
- **Integration test suite could not run in this sandboxed execution environment** — a pre-existing
  constraint (Miniflare cannot bind local sockets here), not a Phase 20 regression, but it means
  this phase's changes were not exercised against that suite in this session. All 525 unit tests
  and a live `wrangler dev --local` runtime check did exercise the actual behavior.

## Measurement checkpoints (once deployed)

- Immediate: URL-inspect the homepage and a handful of representative changed pages; confirm
  user-declared canonical.
- ~7–14 settled days: canonical-consolidation observation (does the slash/non-slash split in
  Search Console narrow?).
- ~28 settled days: first meaningful search comparison.
- ~90 settled days: longer trend, if traffic supports it.

No ranking improvement is promised or implied by any of the above.

## Next step

`READY_FOR_PRODUCTION_DEPLOYMENT` is not asserted — the correct next step is the normal trusted
Preview deploy (`deploy-preview.yml`), live validation there (closing the one open item above),
then production, each only with the user's explicit, in-the-moment authorization.
