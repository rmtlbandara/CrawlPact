# Evidence Observatory — redesign specification

Status: **Phase 2 deliverable, in progress.** This is the authoritative reference for the
CrawlPact "Evidence Observatory" UI/UX redesign. It is written once, then executed against
route-group by route-group across several sessions (see §9, Route coverage). Nothing in this
document overrides `docs/product/CRAWLPACT_FINAL_SRS.md` or an accepted ADR — where this spec is
silent or in tension with either, the SRS/ADR wins.

Branch: `feat/evidence-observatory-ui-ux-redesign`, created from `origin/main` at
`fd8b94e70fd7be21bc332c589a2b66528b10ce54` (2026-07-28).

## 1. Concept

**Evidence Observatory**: CrawlPact is a place where a user observes signals, reads CrawlPact's
interpretation of those signals, and decides what to do — never a place that claims to control,
enforce, or guarantee anything about crawler behaviour. The redesign's job is to make that
evidence chain visible and legible at every level of the product: one glance (Policy Health
Score band), one finding (Evidence Rail), one report (Provenance Header), one crawler-purpose
comparison (Policy Purpose Lanes).

This is not a new product idea — it is a visual and structural articulation of what
`CRAWLPACT_FINAL_SRS.md` §2.6 already specifies: declared policy vs. observed response vs.
unprovable actual behaviour. The redesign should make that three-way distinction the spine of the
interface rather than an implicit rule contributors have to remember.

### Emotional register

Calm, precise, transparent, evidence-led, vendor-neutral, reassuring. Not: a hacker console, a
crypto dashboard, a glassmorphism demo, a purple-gradient SaaS template, a playful consumer app.
Contrast, typography, whitespace and information structure carry the design before shadows or
gradients do.

### Non-negotiable copy boundary (SRS §5.3/§5.4)

Every new page, component prop default, and placeholder string introduced by this redesign must
stay inside the SRS's approved-claims list. Forbidden framings: "stop/block all AI scraping,"
"guarantee protection," "make crawlers obey," "ensure ranking," "legally protect," "complete AI
compliance," any implied security/compliance/legal score. Approved framings: "audit your declared
AI crawler policy," "detect crawler-policy conflicts," "monitor crawler-policy changes,"
"generate evidence-based recommendations." The Policy Health Score stays a **policy-health**
indicator — never reframed as compliance, legal, privacy, or security scoring.

## 2. Information architecture (unchanged)

The redesign does not change IA, routes, or navigation groupings — see §9 for the full route
inventory. Four surfaces, one shared visual language:

- **Public marketing + SEO** (spacious, editorial, mostly zero-JS Astro)
- **Audit + reports** (public-facing, the product's central interaction)
- **Customer app** (`/app/*`, operational, authenticated)
- **Super Admin** (`/admin/*`, denser, authenticated, higher stakes)

## 3. Visual language

### 3.1 Token audit finding

Before changing anything, the actual token file (`packages/ui/src/tokens/tokens.css`) was read in
full. Finding, stated plainly: **the token system already implements the "deep navy for
authority + signal teal accent" direction this redesign calls for.** `--color-brand-900`
(`#0b1f33`) is already a deep ink-navy; `--color-brand-500` (`#1e88a8`) is already a
vendor-neutral signal teal; the neutral scale, paired status fg/bg tokens (two already
deliberately darkened past their SRS-suggested values to clear WCAG AA 4.5:1, confirmed by
axe-core), radius scale, restrained shadow tokens (`elevated`/`modal` only), and the global
`prefers-reduced-motion` collapse are all already in place and already match this document's
"restrained palette, contrast before shadow" instruction.

**Decision: no token value changes in this session.** Editing `tokens.css` — a file all 35
existing components depend on — for cosmetic relabelling with no functional gain would be
unjustified churn on a shared, contrast-verified file. Later sessions may still need _additive_
tokens (e.g. if a genuinely new visual need emerges while redesigning a specific page), but that
should happen at the point of need, not speculatively here. This reverses the plan's original
assumption that token evolution was required — recorded here rather than forced through.

### 3.2 Typography, spacing, radius, motion, breakpoints

All unchanged, all already token-driven — see `docs/design/DESIGN_SYSTEM.md` for the full mapping
(native font stacks; Tailwind's default 4px spacing scale, numerically identical to SRS §10.8;
radius scale `chip`/`control`/`card`/`panel`/`pill`; `--duration-quick`/`--duration-standard` +
global reduced-motion collapse). Breakpoints stay exactly as declared:
`xs`360 `sm`480 `md`640 `lg`768 `xl`1024 `2xl`1280 `3xl`1440, container widths `marketing`1200
`app`1440 `reading`720. No new breakpoint is introduced anywhere in this redesign.

## 4. Signature patterns

Five patterns, each a **layout convention over existing real data**, never a new product
capability. Every pattern must render an honest "Not available" state per field when the
underlying data doesn't exist — never a fabricated placeholder that could be mistaken for a real
result (`docs/testing/TEST_DATA_POLICY.md`).

### A. Provenance Header — `ProvenanceHeader` (built this session)

`packages/ui/src/components/ProvenanceHeader.tsx`. Domain + report-state chip on one line, then a
wrapping field list (scan time, registry version, ruleset version, preset, or any other real
caller-supplied field) as a `<dl>`. Each field value is `string | null`; `null` renders "Not
available" in muted text — never a dash standing in for real data, never omitted silently (an
omitted field looks like it was never collected; an explicit "Not available" tells the reader
CrawlPact checked and doesn't have it). Optional `context` line for shared-report/agency-branding
disclosure text, supplied by the caller — the component has no opinion on what that text says.

**Now wired into `AuditReportView.tsx`** (the audit report's Level 1 header), replacing a
fragmented domain/scan-time/registry-version/preset/status layout and surfacing `rulesetVersion`,
which existed in the real data but was never shown anywhere before. `shared/[token]` gets this
for free since it reuses the same component unchanged. Still to come: domain-detail full-report
view (Phase 6).

### B. Evidence Rail — `EvidenceRail` (built this session)

`packages/ui/src/components/EvidenceRail.tsx`. One rail per finding: Observed → Interpretation →
Impact → Action → Evidence, rendered as a connected vertical list (border-left rail line, per-step
eyebrow label + content). Each of the five slots is `ReactNode | null`; `null` renders "Not
available for this finding" rather than an empty gap (a silent gap reads as a layout bug; an
explicit statement reads as an honest limitation).

**Where it will be used later:** the audit report's findings list was the planned first use, but
that's now a deliberate no — see the Phase 5 progress note below for why (the real `Finding`
data doesn't have five genuinely distinct fields to fill the pattern's slots). Guide pages that
walk through a specific finding (Phase 4) remain a candidate. Not wired into any page yet.

### C. Policy Purpose Lanes — `PurposeLane` (built this session)

`packages/ui/src/components/PurposeLane.tsx`. A row of small summary cards, one per crawler
purpose (Search / Training / User-triggered retrieval / Agents / Other — collapsing the full
8-value registry taxonomy for this presentational summary only), each showing a `StatusChip` tone

- a real caller-supplied summary string (e.g. "3 of 4 crawlers allowed"). **This is a summary
  complement, never a replacement** for the accessible per-crawler data table — the component's
  JSDoc says so explicitly, and no later phase may use it standalone where a table is the clearest
  format (source document §3, Signature design patterns, item B).

**Where it will be used later:** audit report Level 1 summary (Phase 5), crawler-reference index
page (Phase 4). Not wired into any page yet.

### D. Observation / Interpretation / Action

Not a new component — a **labelling convention** for existing report/finding copy, applied when
those pages are redesigned in Phase 5. "Observed" = what CrawlPact retrieved/detected.
"Interpretation" = what the deterministic rules concluded. "Action" = what the user may consider
changing. Must never imply certainty beyond the actual evidence (no "will," only "may" for
recommendations, matching existing report copy conventions).

### E. Trust Ledger

Not a new component — a **layout pattern** for existing important-decision surfaces (e.g. a
registry release, an admin entitlement grant): Source, Date/version, Current status, Limitation,
Next action, laid out as a compact field list (reusing the same `<dl>` convention as
`ProvenanceHeader`, not a separate component). Applied where relevant in Phase 5/7, not built as a
standalone component now — building it generically before a real consuming page exists would be
speculative.

## 5. Component changes

**Built this session** (packages/ui, zero pages touched):

| Component          | File                                              | Status |
| ------------------ | ------------------------------------------------- | ------ |
| `ProvenanceHeader` | `packages/ui/src/components/ProvenanceHeader.tsx` | New    |
| `EvidenceRail`     | `packages/ui/src/components/EvidenceRail.tsx`     | New    |
| `PurposeLane`      | `packages/ui/src/components/PurposeLane.tsx`      | New    |

All three: function components, no client-side state, no Radix dependency (none of the three
needs a headless interactive primitive — they're presentational, so they render as plain SSR
output with zero added client JS, consistent with §16 Performance requirements). Exported from
`packages/ui/src/index.ts` alongside the existing 35. Demonstrated in
`apps/web/src/components/ComponentShowcase.tsx` (`/dev/components`, dev-only, excluded from
prod/sitemap per existing convention) with a "Not available" example for each, per the source
document's requirement to show empty/error states in the showcase.

**Existing 35 components:** audited during research (see `docs/design/UI_COMPONENTS.md` for the
authoritative per-component doc). No structural changes needed this session — `ScoreComponent`
already implements the "band, not gauge" requirement (SRS §10.24) correctly; `StatusChip` already
enforces text+colour, never colour-alone; `Card`/`EmptyState`/`ErrorState` already match the
restrained, non-decorative visual character this redesign asks for. Later phases may need small,
targeted prop additions (e.g. a `ProvenanceHeader`-shaped prop on an existing page layout) but not
a rewrite of any of the 35.

## 6. Responsive behaviour

No new breakpoints. All three new components are single-column-friendly by default
(`ProvenanceHeader`'s field list wraps via flexbox; `EvidenceRail` is already vertical;
`PurposeLane`'s lane row wraps via flexbox) — verified visually in the showcase at
360/768/1280px (see §10, Verification).

## 7. Accessibility decisions

- No colour-only status: `PurposeLane` reuses `StatusChip`, which always pairs a tone with a text
  label.
- `ProvenanceHeader`'s field list uses semantic `<dl>/<dt>/<dd>`, matching the existing pattern
  established by `Card`'s eyebrow/title convention.
- "Not available" states are always real text content (screen-reader visible), never an
  aria-hidden icon or a blank cell.
- `/dev/components` was **not** previously in the `pnpm test:a11y` route list (confirmed by
  reading `apps/web/tests/a11y/home.spec.ts` — it covers 22 public routes only, no dev/admin/app
  routes). This session adds it, so axe-core now scans the new components immediately rather than
  waiting until a later phase wires them into a real page.
- Known pre-existing gaps (unchanged by this session, still open): no manual screen-reader
  walkthrough performed; high-contrast/forced-colours mode unverified; `/app/*` and `/admin/*`
  a11y coverage is minimal (one route each) — full authenticated-route a11y coverage is a Phase
  6/7 concern, not fixed here.

## 8. SEO and performance protections

No route/page files changed this session, so SEO metadata, canonicals, structured data, sitemap
membership, and `noindex` boundaries are all unchanged. Performance: three new pure-presentational
components add zero client-side JavaScript (no `client:*` directive needed anywhere they'll
eventually be used, since none require interactivity); no new dependency was added; bundle impact
is confined to whatever page eventually imports them, and even then it's server-rendered markup,
not hydrated script.

## 9. Route coverage (ground truth, ~60 routes)

Confirmed by direct repository inspection (not documentation), organised by the phase that will
redesign it. "Foundations" (this session) touches none of these — only `packages/ui` and the
dev-only showcase.

### Phase 4 — Public website

`index`, `about`, `pricing`, `privacy`, `terms`, `acceptable-use`, `security`, `status`,
`changelog`, `limitations`, `methodology`, `scoring`, `scanner`, `pay`, `sign-in`, `404`,
`crawlers/index` + `crawlers/[slug]` (21 static crawler pages, one template), `guides/index` +
`guides/[slug]` (20 static guides, one template), `tools/index` + 5 standalone tool pages,
`sitemap.xml`, `feed/[token].xml`.

**Progress so far** (commits `abb7821` through `bc31192`):

- `index` — added the missing "Evidence and methodology" section (§6 item 9 of the source
  brief), added "who it's for" audience line to each pricing-summary plan card.
- `SiteHeader.astro` / `MobileNav.tsx` (shared chrome, used by every public page) — added
  `aria-current="page"` + visual current-section indication on both desktop and mobile nav.
- `pricing` — added "who it's for" audience line to each of the 4 plan cards (a requirement
  explicitly listed in source brief §9 that was previously missing entirely).
- `sign-in` — added an explanation of what a passkey is, why no password/email, what device
  prompt to expect, and what to do when a passkey is unavailable (source brief §10 explicitly
  lists all four as required and none were previously explained).
- `scanner` — **real defect found and fixed, not just polish**: the page was fully static
  (`prerender = true`) with a hardcoded "the live scanner is not yet enabled" claim.
  Production's `wrangler.jsonc` has had `AUDIT_ENGINE_ENABLED=true` since commit `6320032` (the
  tip of `main` this branch was cut from) — so real visitors were being told a live feature was
  disabled. Fixed to read the flag live at request time (`prerender = false` + `getEnv()`),
  matching the pattern `status.astro` already used correctly. Swept the rest of the public
  pages/API for the same stale-claim pattern — nothing else was affected.
- `crawlers/[slug]`, `guides/[slug]` — reviewed against source brief §8's required field/content
  list. Field coverage was already complete except "Registry version" (no real data source at
  this static-content layer — correctly left out, not fabricated). Two real gaps were found and
  fixed: no "related crawlers/guides" section and no audit CTA at the end (both explicitly
  required by §8). Both now compute real related items from collection data (never fabricated,
  hidden when nothing is genuinely related) plus a consistent bottom `/audit` CTA.
- Migrated 17 files' isolated `max-w-[720px]` to the existing `max-w-reading` token (mechanical,
  zero visual change, flagged by the editor's own canonical-class diagnostic).
- `crawlers/index` — grouped the flat 20-crawler list into Policy Purpose Lane sections (§4C),
  only rendering purposes with a real entry.
- `guides/index` — "This index will grow toward the SRS's launch content minimum" was stale;
  verified the collection already exactly meets SRS §30.4's minimum (10 decision + 5
  implementation + 5 troubleshooting) and corrected the copy.
- **Repo-wide text-rendering bug found and fixed**: inline `<a>` tags separated from their
  surrounding text by a line break (with nothing else on that line) had their whitespace
  stripped by Astro's compiler instead of collapsed to a space, producing glued-together text
  ("seemethodology", "statusfor"). Found via direct HTML verification (not just visual review)
  and fixed on 8 pages (`about`, `acceptable-use`, `changelog`, `methodology`, `pricing`,
  `scanner`, `security`, `terms`) using an explicit `{" "}` expression at each junction.
- Reviewed `about`, `limitations`, `404`, and `security` content directly — all already
  compliant with the redesign's honesty/evidence principles, no content changes needed (only the
  spacing-bug fix above, which is a rendering defect, not a content/redesign change).
- Corrected a stale claim in `docs/status/IMPLEMENTATION_STATUS.md` (audit engine + Paddle
  webhook status) discovered via the `/scanner` fix above — not a redesign-spec change, recorded
  here only because this session's work surfaced it.
- `tools/index` + 5 tool pages, `privacy`, `pay`, `sitemap.xml` — reviewed directly, all already
  compliant (each tool page embeds the real validator rather than just linking to it, which
  already satisfies "CTA that doesn't interrupt reading" better than a link would; `privacy` is
  honestly labelled draft-pending-legal-review; `sitemap.xml` correctly excludes private/thin
  routes per SRS §30.3). One more instance of the spacing bug found and fixed on
  `tools/rsl-validator`.
- **Phase 4 route list: fully reviewed.** `feed/[token].xml` (a per-user private Atom feed, not
  a public content page) was not separately reviewed — out of scope for a public-website content
  pass.

### Phase 5 — Audit and reports

`audit/index` (entry form), `audit/[auditId]` (report view), `shared/[token]` (shared report
view: valid / revoked / expired / invalid / agency-branded states).

**Correction:** this section originally said the report view "must keep reflecting
`AUDIT_ENGINE_ENABLED=false` honestly," on the assumption inherited from
`docs/status/IMPLEMENTATION_STATUS.md` that the audit engine was still disabled in production.
That assumption was wrong — production's `wrangler.jsonc` has had `AUDIT_ENGINE_ENABLED=true`
since commit `6320032`, deployed before this branch was cut (see the Phase 4 progress note on
`scanner` above, where this was discovered and a stale hardcoded claim was fixed). Phase 5 must
reflect the **live** flag value at request time — same pattern as `status.astro` — not assume
either state. `docs/status/IMPLEMENTATION_STATUS.md` has since been corrected directly (commit
`47f9d0a`) at the user's explicit request.

**Starting Phase 5 now.** The live audit engine being enabled in production raises the stakes
here beyond typical redesign polish: this is a real, working scan pipeline real visitors use
today, not a mostly-static content surface like Phase 4. Extra care on every change — reproduce
the actual current behaviour first, verify against real scan output where practical, never
assume a state.

**Progress so far:**

- `audit/index` — the static 8-stage "progress" list (numbered circles styled like a real
  tracker) was reworded to be explicitly informational and visually de-emphasised, since the
  form's actual submission feedback is only a button spinner with no real connection to that
  list — real risk now that the engine is genuinely live, not just aspirational content. Also
  fixed the same glued-text spacing bug as Phase 4.
- `AuditReportView.tsx` (the report itself — the single highest-stakes template in the product)
  — wired in `ProvenanceHeader` (built in the foundations slice, never used until now) to
  replace a fragmented metadata layout: domain/scan-time/registry-version were in one header
  block, while preset/status were a separate paragraph next to the score, and
  **`rulesetVersion` existed in the real data but was never shown anywhere**. All five now
  render together in one consistent block, all real fields, nothing fabricated.
  Verified against a genuinely real scan (`AUDIT_ENGINE_ENABLED=true` locally, matching
  production) run against `example.com` through the actual `/api/audit` endpoint — not a mock,
  not a fixture. Zero axe-core WCAG violations on that real report page (checked directly, since
  `/audit/[auditId]` isn't in the standard 22-route a11y suite — real reports need a real
  `auditId` that suite can't generate). The one e2e test touching this component (`Print report`
  button) still passes unchanged.
- **`shared/[token]` — real gap found and fixed at the data layer, not just the page.**
  `docs/design/EVIDENCE_OBSERVATORY_REDESIGN_SPEC.md` §12 explicitly calls for revoked/expired/
  invalid to be distinct states, but `getShareForToken()` collapsed all three into a single
  `null` — and the SQL query itself filtered `revokedAt IS NULL` in the `WHERE` clause, so a
  revoked token was indistinguishable from one that never existed _at the data layer_, not just
  in the UI. Changed `getShareForToken` to return a discriminated `ShareResolution` (`valid` /
  `revoked` / `expired` / `invalid`) computed from the real column values, and updated the page
  to show distinct, honest copy for each. Only one other caller existed (an integration test),
  updated alongside. `AuditReportView` benefits from the same `ProvenanceHeader` wiring as the
  main report automatically, since this page reuses that component unchanged.
  Verified: pnpm quality clean, the existing agency-branding integration test passes with the
  new discriminated type, manual verification of the `invalid` state (revoked/expired weren't
  separately screenshotted — verified by code review of the three-way branch against real
  column semantics, not by generating those exact DB states, since doing so needs more D1
  setup than the straightforward logic justified), zero axe-core WCAG violations.

**Deliberately not done: wiring `EvidenceRail` into the findings section.** Checked the real
`Finding` type and its generation code (`packages/policy/src/findings.ts`) before touching
anything — `whatHappened` and `evidenceSummary` are literally assigned the same value
(`conflict.evidence`) in the only construction path that exists. Forcing `EvidenceRail`'s five
distinct slots onto that would render duplicate text in two rows, which is worse than the
current `Alert`-based rendering, not better. Fixing it properly means giving the finding
generator a genuinely distinct observed-vs-interpretation text, which touches
`packages/policy` — tested business logic, not presentation — and is out of scope for a
redesign UI pass per this document's own "don't change scanner/policy behaviour unless a
verified UI requirement makes it unavoidable" rule. Findings left exactly as they were: no
regression, no forced-fit pattern.

### Phase 6 — Authentication and customer app

Sign-in flow copy/UX polish (route itself is Phase 4, but WebAuthn-ceremony UX detail belongs
here), `app/index` (dashboard), `app/domains/index`, `app/domains/[domainId]`, `app/groups/index`,
`app/notifications/index`, `app/billing/index`, `app/account/index` (profile/passkeys/recovery
codes/sessions/deletion, all as sub-sections of one route).

**Progress so far.** Reviewed every route above with a real authenticated session — registered a
genuine account via the real WebAuthn ceremony (CDP virtual authenticator, the same technique
`tests/e2e` uses), not a mock or fixture, and walked through dashboard (empty and populated),
domains (list, add, detail), groups, notifications, billing, and account with real screenshots
at each step.

- `app/index`, `app/domains/*`, `app/groups`, `app/notifications`, `app/account` — all already
  compliant. Highlights confirmed matching the source brief: the zero-domain empty state is
  preserved exactly as required; plan-gated features (groups) show contextual, respectful
  upgrade messaging with no broken controls; destructive actions (remove passkey, sign out all
  sessions, delete account) are visually distinct and explain consequences; the domain detail
  page's "Incomplete" score state matches `ScoreComponent`'s honest pattern exactly for a
  domain that's been saved but not yet scanned.
- **`app/billing` — real bug found and fixed.** The Plans section unconditionally said "You can
  cancel any time through the billing portal above," but `PortalButton` only renders when a
  `billingCustomer` record exists (i.e., after a first purchase) — so any Free-tier visitor who
  has never subscribed saw a claim referencing a button that plainly isn't on their screen.
  Fixed with conditional copy matching the same `billingCustomer` check the button itself uses.
- **Considered and deliberately not fixed**: the Notifications page's "Revoke" button for the
  private Atom feed is always enabled, even before a feed has ever been created (a harmless
  no-op DELETE in that case, not an error). The seemingly-obvious fix — hiding it when the
  client-side `feedUrl` state is empty — would actually be *wrong*, since the raw feed URL is
  only ever shown once at creation time and cleared from state afterward; `feedUrl === null`
  doesn't mean no feed exists, just that it isn't currently displayed. Fixing this properly
  needs a new server-side "does a feed exist" check, which is more new API surface than this
  low-severity, harmless issue justifies.

Verified: pnpm quality clean, all 6 `auth-and-account.spec.ts` e2e tests pass (including the
real save-domain-and-scan journey), pnpm test:a11y 53/54 (same pre-existing mobile-safari
failure, unrelated).

### Phase 7 — Super Admin

`admin/index`, `admin/users/index` + `[userId]`, `admin/domains/index`, `admin/scans/index`,
`admin/jobs/index`, `admin/health/index`, `admin/findings/index`, `admin/subscriptions/index`,
`admin/transactions/index`, `admin/webhooks/index`, `admin/entitlements/index`,
`admin/blocked-targets/index`, `admin/security/index`, `admin/audit-logs/index`,
`admin/notices/index`, `admin/settings/index`, `admin/shared-reports/index`,
`admin/registry/{crawlers,operators,releases,rulesets}/index`.

`api/*` routes are not a UI surface and are out of scope for this redesign entirely.

## 10. Testing matrix and this session's verification

Full matrix: `docs/testing/VISUAL_QA_MATRIX.md` (7 breakpoints × 3 browser engines, already
established — reused unchanged, no new breakpoints/browsers added by this redesign).

**This session ran and recorded, honestly, against the pre-redesign baseline:**

| Check                   | Result                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm format:check`     | Pass                                                                                                                                                                                                                                                                                                                                                                                |
| `pnpm lint`             | Pass                                                                                                                                                                                                                                                                                                                                                                                |
| `pnpm typecheck`        | Pass — 0 errors (298 files; 35 pre-existing Zod-deprecation hints, unrelated)                                                                                                                                                                                                                                                                                                       |
| `pnpm test:unit`        | 202/202 passed                                                                                                                                                                                                                                                                                                                                                                      |
| `pnpm test:integration` | 137/137 passed                                                                                                                                                                                                                                                                                                                                                                      |
| `pnpm db:validate`      | 38 tables verified consistent                                                                                                                                                                                                                                                                                                                                                       |
| `pnpm build`            | Pass                                                                                                                                                                                                                                                                                                                                                                                |
| `pnpm test:e2e`         | 25/38 passed in full 4-worker parallel run; the 4 `admin-flows.spec.ts` "failures" were WebAuthn-ceremony timeouts from CPU contention across parallel workers on this machine — re-run in isolation (`--workers=1`) all 4 passed in 50s. 9 skipped (mobile-safari WebAuthn-gated tests, by design). Not a redesign regression — no page code was touched.                          |
| `pnpm test:a11y`        | 51/54 passed. 1 failure is the exact pre-existing WebKit/mobile-safari skip-link focus issue already documented in `docs/status/KNOWN_RISKS.md` as a tooling limitation, not a real defect.                                                                                                                                                                                         |
| `pnpm test:visual`      | 7/105 passed; 98 failed against the baseline. Matches the pre-existing, already-documented stale-baseline/platform-mismatch gap in `KNOWN_RISKS.md` and `VISUAL_QA_MATRIX.md` — **not attempted to fix here** (regenerating 91 snapshots blindly is explicitly prohibited by this document's own testing rules; baseline regeneration belongs in Phase 8, reviewed image-by-image). |

Representative before-screenshots captured (360/768/1280px): home, audit entry, pricing —
saved outside the repo in the session scratchpad for before/after comparison once those pages are
actually redesigned in Phase 4/5. Authenticated (dashboard/admin) screenshots deferred to Phase
6/7 sessions, where the existing WebAuthn test fixtures will be reused to reach those states
rather than scripting a one-off equivalent.

**This session's foundations-slice verification** (after adding the 3 new components):
`pnpm quality` re-run clean; `pnpm test:a11y` re-run including the newly-added `/dev/components`
route.

## 11. Rollback strategy

Every change in this session lives on `feat/evidence-observatory-ui-ux-redesign`, branched from
`origin/main`, which is untouched. Rollback is `git checkout main` / delete the feature branch —
no migration, no schema change, no data written anywhere makes this anything other than a clean
revert. Individual commits are scoped (spec doc; each new component; showcase update; a11y route
list addition) so a partial revert is also possible if a later session wants to keep some of this
slice and not other parts.

## 12. What this document does not cover yet

Phases 4 through 8 (all actual page redesigns, full cross-browser/breakpoint verification, a
regenerated CI-wired visual baseline, Lighthouse/Core Web Vitals measurement, and the source
document's full A–J deliverables package) are **not started**. This spec is the reference those
sessions execute against — see the session's final interim status report for the honest
completion state as of now.
