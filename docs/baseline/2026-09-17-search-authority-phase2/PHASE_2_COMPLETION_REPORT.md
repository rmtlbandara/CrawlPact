---
Document owner: Engineering owner
Status: current-authoritative
---

# Phase 2 Completion Report — Search Authority, Content Moat & Organic Acquisition

## 1. Final Verdict

**`FAIL — PHASE 2 NOT COMPLETE`**

This is not an ambiguous or hedged result: every piece of work in this phase that was within
legitimate autonomous scope has been completed, independently verified, merged, and validated on
Preview. But per this phase's own §56-57 criteria, PASS requires three specific things that
remain outstanding, all owner-gated by design, none of them defects:

1. Registry release `2026.09.1` (adding Applebot) has not been published.
2. The first research publication has not been generated or published.
3. Production has not been redeployed with this phase's runtime-visible changes.

All three require either a live authenticated Super Admin session (registry/research) or the
owner's fresh, in-the-moment deployment authorization (Production) — the same governance
boundary already established and accepted earlier in this project for exactly these action
types. None can be completed by direct database writes or an unauthorized deploy without
defeating the audit-trail/authorization guarantees those workflows exist to provide.

## 2. Repository State

- Final `main`: `b10ffc8c86a2307747478b11c8a430ec68117f06`.
- 6 PRs merged this phase: #204, #205, #206, #207, #208, #209 (all squash-merged, all branches
  auto-deleted).
- CI: green on `main` at this SHA (three transient infrastructure flakes during the process — see
  §17 below — each resolved by rerun, none a real regression).
- Working tree: clean.

## 3. Production State

- Deployed SHA: still `9a3f950` (Phase 1's final deploy) — Worker version
  `a0847529-571a-4294-997c-634d41b6aac0`, deployed `2026-09-17T10:05:45Z`, 100% traffic.
  Independently re-confirmed via `wrangler deployments list` at the end of this phase.
  **Unchanged since Phase 1**; none of this phase's 6 merged PRs have reached Production.
- Rollback target: `ba8000c7-f3d2-4914-ad85-2969c1433ca3` (unchanged from Phase 1).
- This is a genuine, listed Phase 2 blocker (§57), not an oversight: Production deployment
  requires the owner's guarded `deploy-production.yml` workflow with a typed `DEPLOY PRODUCTION`
  confirmation, triggered fresh each time — this session's tooling is hard-blocked from
  triggering it directly (confirmed earlier in this project), and CLAUDE.md's own standing rule
  requires the user's explicit, in-the-moment permission for this specific action regardless of
  any broader authorization language in a directive document.

## 4. Search Data Baseline

- `growth_collection` has run twice (`2026-09-18T03:01 UTC` and `2026-09-19T03:01 UTC`; latest
  covers GSC through `2026-09-16` and GA4 for `2026-09-18`), re-confirmed live on 2026-09-19.
- GSC: 27 total impressions across 4 settled days (3, 2, 10, 12), 0 clicks. GA4: 1 session, 1
  active user in total (0 rows for 2026-09-18).
- CrUX: `no_data` (expected at this traffic level).
- Concrete, evidence-based maturity criteria for when opportunity analysis becomes responsible
  are now defined in `SEARCH_DATA_MATURITY_CRITERIA.md` (14+ settled days, 5+ occurrence
  recurrence for a query/page, a concentration cap, at least one click) — none are met yet.

## 5. Search Opportunity Work

**None performed** — current volume (27 impressions over 4 days, 0 clicks, 1 GA4 session) fails
every criterion in `SEARCH_DATA_MATURITY_CRITERIA.md` (best query recurs on 3 of the required 5
days; 4 of the required 14 settled days; no click yet — see `EXISTING_PAGE_PERFORMANCE.md`). Computing "high-impression/low-CTR" or similar
classifications from this sample would be statistically meaningless. This is a data-maturity
condition per §58, not a blocker — non-GSC-dependent work continued in parallel instead (§6-9
below).

## 6. Registry Authority

- Active release: still `2026.07.3`, 23 crawlers, 9 operators (re-confirmed live at the end of
  this phase).
- `crw_applebot` exists in master data (`last_verified_at: 2026-09-17`) but in zero published
  releases. `REGISTRY_RELEASE_DECISION.md` documents the recommendation (publish `2026.09.1`,
  24 crawlers/9 operators) and the exact governed steps required.
- Bytespider decision preserved unchanged — no new authoritative vendor evidence has appeared;
  re-confirmed this phase's own research didn't surface any (§10 of the directive).
- Integrity: `registry:validate`, `registry:integrity:verify`, `registry:public:validate` all
  passed in this phase's final CI run (22 content pages checked against 24 registry records —
  the 24th being `crw_applebot`, correctly present in master data, correctly absent from the
  live 23-crawler release).

## 7. Original Research

**Not published.** Infrastructure is ready and was previewed in detail in
`RESEARCH_PUBLICATION_EVIDENCE.md` using real registry data (purpose distribution, 23/23
verified, 0 review-due, 9 operators). Per that document's own recommendation, generating the
draft should happen **after** the registry release publishes (so headline numbers read 24/9, not
23/9) — meaning this is sequenced behind item #6, not independently blocked.

## 8. Crawler Authority

Full 22-page audit performed (`CRAWLER_AUTHORITY_AUDIT.md`). One real gap found and fixed:
`claudebot.md` was the thinnest page in the directory and, uniquely among training-purpose
crawler pages, didn't disambiguate itself from its own operator's sibling crawlers — fixed to
match the established pattern every other training-purpose page already followed. Amazon, Meta,
OpenAI, and Google crawler families checked and confirmed clean for sibling disambiguation. All
22 pages have now been read in full.

**Follow-up (2026-09-19) — 3 factual defects found and fixed, a class of claim never previously
verified.** Phase 1 and Phase 15 verified each crawler's _token and purpose_ against vendor docs,
but never what vendors say about _robots.txt compliance_. Checking that against primary sources
found `chatgpt-user.md` asserting "standard robots.txt rules apply" where OpenAI says they "may
not apply"; `meta-externalfetcher.md` saying a `Disallow` "prevents" fetches where Meta says the
crawler "may bypass robots.txt"; and `oai-adsbot.md` asserting robots.txt support that OpenAI's
page never states. All three pages and the two guides that discuss them were corrected to quote
the vendor (details and method caveats in `CRAWLER_AUTHORITY_AUDIT.md`). An open product question
is recorded there: result screens show `Blocked` for such crawlers without a per-crawler caveat.

## 9. Content Quality

- **Guides** (21): one real staleness issue found and fixed (`applebot-vs-applebot-extended.md`
  omitted Apple's own newly-discovered statement about base Applebot's AI-adjacent role — a
  material gap given the guide's whole purpose is distinguishing what each token covers).
  Two guides gained real, evidence-backed `relatedCrawlerSlugs` they were missing (PR #204).
  Content consolidation reviewed qualitatively — no overlapping intent found; several guides are
  deliberate decision/implementation companion pairs, not duplicates.
- **Platforms** (5) and **verticals** (4): both audited in full, no gaps found — genuinely
  distinct, evidence-specific content, not templated boilerplate.
- **Tools** (5): audited earlier this phase — consistent What-this-checks/What-this-doesn't-
  check/Related/audit-CTA structure across all 5; free and ungated as intended.
- **Operator pages**: evaluated and deliberately deferred (`OPERATOR_AUTHORITY_DECISION.md`) —
  the function they'd serve is already covered by per-crawler pages, the automatic "related
  crawlers" widget, and existing per-operator comparison guides.
- **Metadata quality**: no duplicate titles or descriptions found anywhere in content
  collections or static pages; no hardcoded crawler/operator counts or registry version strings
  found in any real (non-dev-only) page.

## 10. Internal Architecture

- **Real orphan-page defect found and fixed**: `/observatory/` — a live, data-rich page — was in
  the sitemap but linked from nowhere else on the site. Added to the footer
  (`OBSERVATORY_ORPHAN_FIX.md`); also added to the accessibility smoke suite since it's now a
  real navigable destination for the first time.
- **Hub architecture inconsistency found and fixed**: `guides/index.astro` was a flat 21-item
  list while `crawlers/index.astro` and `platforms/index.astro` both deliberately group
  same-scale collections for scannability — brought into the same pattern
  (`CONTENT_QUALITY_AND_HUB_AUDIT.md`).
- `/research/` correctly remains unlinked and out of the sitemap — a deliberate, already-
  documented decision (Phase 16), not a gap, until a publication exists.
- `/platforms/` and `/for/*` confirmed properly linked (footer/nav config arrays; an earlier
  literal-string grep had wrongly suggested they might be orphaned).

## 11. Search Appearance

- Structured data audited and confirmed already mature (sitewide Organization/WebSite,
  conditional Article/BreadcrumbList, HowTo on relevant guides) — no changes made, none needed.
- Sitemap: `/observatory` present; `/research` correctly absent (Preview-checked, see §12).
- Canonical: correct on Production (Phase 1); on Preview, self-references the Preview host on
  every page (pre-existing, environment-wide behavior predating this phase, not a regression —
  see `PREVIEW_VALIDATION.md`). Preview is double-protected from indexing regardless
  (`robots.txt` blanket disallow + `x-robots-tag: noindex`).
- Robots.txt: unchanged, correct.

## 12. Distribution

**Not executed.** Per this phase's own sequencing (§40), distribution assets should be prepared
_after_ the registry release and first research publication are live, so the package cites real,
current numbers rather than ones that would go stale before publication. Since both remain
outstanding (see §6-7), preparing final distribution copy now would risk drafting content against
numbers that won't survive to publication. Deferred, not skipped.

## 13. Search-to-Product Measurement

No new attribution work performed this phase — GA4/product-event integration is unchanged from
Phase 1's validated baseline. Not revisited since search volume remains too low for any
meaningful search-to-product path analysis.

## 14. Performance / RUM

No Phase 2 change touched JS bundles, images, or hydration — all changes were content
(frontmatter, prose) or static markup restructuring (guides hub grouping, one footer link).

**Measured (2026-09-19), not reused from Phase 1** — full detail in `PREVIEW_VALIDATION.md`:
on the Preview deploy of the merged batch, the standard six-page Lighthouse run scored
performance 99-100, accessibility 100, LCP 1.41-1.80 s, CLS ~0.0001 (39/39 smoke checks passed);
the two pages this phase changed were measured separately (`/observatory/` 99, LCP 1.80 s;
`/guides/` first reading 95 / 2.43 s, re-run 100 / 1.51 s, Production before-state 99 / 1.78 s).
The one apparent regression was investigated rather than assumed — the new HTML is smaller than
the old, and a same-code control plus an untouched-page control both came back at ~1.4-1.5 s — and
is concluded to be measurement noise. The methodology shows roughly ±0.5 s LCP swing between
windows, so a single reading is not a verdict. This is Preview, not the merged code on
Production, which does not run it yet.

**RUM data-integrity defect found (Phase 1 deliverable, surfaced by Phase 2 verification).**
`rum_vitals` is not purely visitor data: headless Chrome under Lighthouse executes the same
`web-vitals` beacon. Of 199 rows to date, 157 (2026-09-17) coincide with Phase 1's Production
lab runs and 24 (2026-09-19, one 61-second burst, `/guides/`, mobile) came from this phase's own
Production Lighthouse baseline — a side effect of this phase's verification, disclosed rather
than hidden. Only ~18 rows are not part of an identifiable lab burst, and even those are unverified
as human traffic. Consequently the `/admin/growth`
RUM section and any p75 from it **must not be cited as a real-visitor baseline**. UA-based
filtering does not work (Lighthouse 13.4.1's emulated UAs carry no marker — checked in source).
Nothing was deleted or changed; options and a review-first cleanup statement are in
`CRUX_AND_RUM_BASELINE.md` for the owner to choose. This is a genuine product-integrity item, not
a Phase 2 blocker per §58 (small RUM sample is explicitly non-blocking), but it should be fixed
before anyone reports RUM figures.

## 15. Accessibility

**113/113** in the final CI run on `main` at `b10ffc8` (up from Phase 1's 112 — the +1 is the new
`/observatory` route added this phase, which is now a real navigable destination for the first
time and needed its own coverage). No regressions.

## 16. Security / Privacy

No new `set:html` usage introduced by any change this phase (checked directly). No new secret in
any diff (`gitleaks` clean on every PR this phase). No authentication, CSRF, host-boundary, or
billing code touched. Registry/research governance boundaries were respected throughout — no
direct D1 writes to governed tables to fabricate a release or publication.

## 17. Quality Gate

Real, current counts extracted from the final green CI run on `main` at `b10ffc8` (not reused
from Phase 1):

- Unit: **856/856** (67 files)
- Integration: **403/403** (58 files)
- Security: **45/45** (8 files)
- E2E: **150/150** (2 flaky — passed on Playwright's built-in retry, not failed)
- Accessibility: **113/113**
- `docs:validate`, `brand:validate`, `trust:validate`, `status:validate`,
  `operations:validate`, `registry:validate`, `registry:integrity:verify`,
  `registry:public:validate`, `research:validate`, `research:integrity:verify`,
  `pilot:validate`, `content:validate`, `internal-link-canonical:check`,
  `repo-privacy:validate`, `analytics:validate`: all **PASSED**.
- Build: succeeded.
- CI infrastructure flakiness occurred three times during this phase (PR #205's first attempt,
  main's first post-merge run, and this report's own PR #210), all resolved cleanly on rerun and
  none touching any file this phase changed — two with the identical `Workers runtime canceled
this request… hung` signature in unrelated authenticated-app tests
  (`notifications-monitoring-reliability.spec.ts`, `saved-domain-timeline.spec.ts`), one with a
  `Hook timed out`/`dispose is not a function` signature in the integration suite (this session's
  already-documented Miniflare/D1-harness resource-contention pattern) on a pure docs-only PR
  adding a single markdown file. The pure-docs case is itself further confirmation this is
  infrastructure noise, not a code regression — there was no code to regress.
- Two Prettier formatting misses occurred early in this phase (checking only the changed file
  instead of the full repo) — both caught before merge; the standing rule going forward is
  `pnpm run format:check` across the whole repo before every commit, which was followed for the
  remainder of the phase without further misses.

## 18. Remaining Non-Blocking Conditions

- Search opportunity analysis: correctly pending sufficient data, per §58 and
  `SEARCH_DATA_MATURITY_CRITERIA.md` — not a blocker.
- A full line-by-line factual re-verification of all 21 guides: genuinely not done, stated
  honestly rather than claimed complete. Two evidence-driven corrections were made (Apple, and the
  robots.txt-semantics fixes that touched two guides), but the robots.txt-semantics check found a
  whole class of claim that had never been verified, which raises the odds that other unverified
  vendor-behaviour claims exist in guides that were not re-read against primary sources.
- Lighthouse on the merged batch is measured on Preview only (§14); Production performance for it
  is confirmable only after the owner deploys. (Avoid ad-hoc Lighthouse runs against Production —
  they write synthetic RUM rows, see §14.)
- RUM figures must not be cited as a real-visitor baseline until the lab-traffic contamination is
  addressed (§14) — an owner decision, not a Phase 2 blocker.
- Distribution package: correctly deferred until the registry release and research publication
  are live (§12).

## 19. Phase 3 Readiness

**Not yet.** Per this phase's own §55, search-ranking lag is never a valid reason to delay Phase
3 — but Phase 2 explicitly is not complete while registry/research/Production items remain
outstanding, and §30 of the original Phase 2 directive prohibits starting Phase 3 early. Once the
three owner-gated actions below are completed, this session (or a continuation of it) should:
independently re-verify all three went live correctly, execute the previously-deferred
distribution prep now that real numbers exist, and only then reassess Phase 2 for a PASS verdict.

---

## What the owner needs to do, in order

1. **Publish registry release `2026.09.1`** via `/admin/registry/releases` — adds Applebot,
   24 crawlers/9 operators. Full pre-publication checklist already in
   `REGISTRY_RELEASE_DECISION.md`.
2. **Generate and publish the first research report** via `/admin/research`, only after step 1,
   so its headline numbers reflect the new release. Full readiness evidence already in
   `RESEARCH_PUBLICATION_EVIDENCE.md`.
3. **Deploy Production** via the guarded `deploy-production.yml` workflow (SHA `b10ffc8`, typed
   `DEPLOY PRODUCTION` confirmation) — brings the 6 merged PRs' runtime-visible changes
   (Observatory footer link, ClaudeBot page fix, guides hub grouping, Applebot guide accuracy
   fix, 2 crawler-guide cross-links) live. This requires your fresh, in-the-moment authorization
   each time, per this project's standing rule — I cannot trigger it myself.

Once all three are live, ask for a Phase 2 re-verification pass to independently confirm each
went correctly and to close out the remaining distribution and Phase 3 readiness sections.
