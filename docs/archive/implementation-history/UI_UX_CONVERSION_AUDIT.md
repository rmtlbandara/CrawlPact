# UI/UX and Conversion Audit — Phase 1

> **Historical document.** This file records an earlier CrawlPact implementation state and is
> not authoritative for the current product. See `docs/status/CURRENT_STATE.md` for current
> status. (Note: "Phase 1" in this document's own title refers to an internal workstream
> numbering distinct from this repository's Phase 0–19 governance roadmap — do not conflate the
> two.)
>
> - **Original date**: 2026-07-26
> - **Archive date**: 2026-08-03 (governance Phase 1)
> - **Superseded by**: `docs/status/CURRENT_STATE.md`, `CHANGELOG.md`
> - **Reason archived**: all findings in this audit were fixed the same pass (see `CHANGELOG.md`'s
>   matching entry); preserved as the historical audit record, not edited for currentness.

**Date:** 2026-07-26 · **Branch:** `feat/trust-conversion-ui` · **Scope:** Research and
documentation only — no application code was modified to produce this document.

This audit reviews the current implementation (not the SRS's aspirational description) against
SRS §5 (prohibited/approved claims), §9 (landing page), §10 (design system), §22.3 (Policy Health
Score), and `docs/design/*`. Every finding below was checked against the actual file at the cited
path/line, not inferred from documentation alone. Where the current implementation is already
good, that is stated plainly rather than manufacturing a problem.

Constraints that shaped every recommendation in this document (from CLAUDE.md and the SRS): never
claim CrawlPact blocks crawlers or that crawlers "obey" policy; never call the Policy Health Score
a compliance/legal/security score; no fake testimonials, logos, counts, urgency, or dark patterns;
no external AI APIs/analytics/fonts; preserve WCAG 2.2 AA, SEO, and FAQ/JSON-LD sync.

---

## Resolution status (2026-07-26)

Per the user's explicit choice, the concrete findings below were fixed; no new brand/logo system
or homepage rebuild was attempted. See `CHANGELOG.md`'s "UI/UX Conversion Audit" entry and
`docs/status/IMPLEMENTATION_STATUS.md` for full detail.

- Main weakness #1 (category breakdown discarded before persistence) — **Fixed.**
- Main weakness #2 (domain detail page's blank score label) — **Fixed.**
- Main weakness #3 (`/pricing` CTA parity with the homepage teaser) — **Fixed** (the CTA-
  prominence-vs-honesty-disclaimer trade-off itself, flagged below as a judgement call, was left
  untouched as instructed).
- Main weakness #4 (analytics event granularity) — **Fixed** (`crawler_reference_page_opened`
  added; `source` property added to audit events).
- Main weakness #5 (a11y/visual coverage is public-site-only) — **Partially addressed**: one
  authenticated route added per suite (`/app`, `/admin` for a11y; `/app`, `/admin/settings` for
  visual), not full authenticated-surface coverage. Doing so also surfaced and fixed a real WCAG
  2.2 AA color-contrast violation in the admin sidebar (not part of the original 5 findings).
- Admin mobile navigation gap (found in the route-by-route section, not repeated in the top-level
  summary) — **Fixed.**

## Top-level summary

### Baseline quality-gate result

`pnpm quality` was run in full (format:check → lint → typecheck → test:unit → test:integration →
db:validate → build). **All steps passed, exit code 0**, re-run directly this session (not carried
forward from `IMPLEMENTATION_STATUS.md`):

| Step                                               | Result                                                         |
| -------------------------------------------------- | -------------------------------------------------------------- |
| `format:check`                                     | Pass — "All matched files use Prettier code style!"            |
| `lint` (`eslint . --max-warnings=0`)               | Pass                                                           |
| `typecheck` (`astro check` × 9 workspace packages) | Pass — 292 files, 0 errors, 0 warnings, 31 informational hints |
| `test:unit`                                        | Pass — 189/189, 18 files                                       |
| `test:integration`                                 | Pass — 137/137, 22 files, against real D1                      |
| `db:validate`                                      | Pass — 38 tables verified consistent                           |
| `build`                                            | Pass — server build completed, all static routes prerendered   |

One environmental note (not a failure): pnpm was not on this shell's `PATH` and had to be invoked
via `npx pnpm@9.15.0`; a benign `Unsupported engine` warning appears throughout because the local
Node version (v26.4.0) exceeds the `package.json`-declared range (`>=22.12.0 <23.0.0`) — cosmetic,
did not affect any step's outcome. `test:a11y`/`test:e2e`/`test:visual` were **not** run this
session (not required for a documentation-only change per the quality-gate skill's own guidance,
and this task explicitly asked only for the baseline `pnpm quality` result) — their last-recorded
results are in `docs/status/IMPLEMENTATION_STATUS.md` (25/25 a11y, 15/15 e2e, 91-snapshot visual
baseline not wired into CI).

### Main weaknesses found

1. **Policy Health Score category breakdown is computed but never reaches any real report.**
   `packages/policy/src/scoring.ts` computes a full `categoryBreakdown` (resource availability,
   syntax, objective alignment, cross-signal consistency, etc.), but the API contract
   (`packages/core/src/api/contracts/audit.ts:126`) only defines `{state, value, label}` — no
   breakdown field. `apps/web/src/lib/get-scan-report.ts:172-174` and
   `apps/web/src/lib/run-audit.ts` → `persist-scan.ts` never persist it past the in-memory scoring
   call. The result: `AuditReportView.tsx:374` renders `<ScoreComponent score={report.score}
methodologyHref="/scoring" />` with **no `categoryBreakdown` prop** — every real audit report
   (anonymous, saved-domain, and shared-link) shows a bare number with no category detail, even
   though the homepage's synthetic demo (`ReportPreview.tsx:56-61`) shows exactly that breakdown
   and SRS §10.24 explicitly requires it ("Category breakdown" is listed as a required element).
   This is a real product gap, not a display bug — the data is discarded before it can be shown.
2. **The domain detail page's score has no label.** `apps/web/src/pages/app/domains/[domainId].astro:53-59`
   passes `label: ""` to `ScoreComponent` because `lib/domains.ts`'s `currentScore` is a bare
   number with no accompanying label computed anywhere in that file. Every other real score
   display in the app (the full report view) correctly shows "Strong"/"Good"/"Needs attention"/etc.;
   this one page silently drops it, leaving a blank space next to the score.
3. **Pricing page (`/pricing`) has materially weaker calls-to-action than the homepage's own
   pricing teaser.** `apps/web/src/pages/pricing.astro` renders a plain comparison table with a
   single generic "Create an account" link at the bottom (line 151) and no recommended-plan
   highlight — whereas `index.astro`'s pricing section (lines 390-443) has per-plan cards, a
   "Recommended" badge on Pro, and per-plan CTAs ("Choose Solo", "Choose Pro", etc.) exactly
   matching SRS §9.16's recommended CTA labels. A visitor who clicks through from the homepage to
   the full pricing page for more detail lands on a _less_ actionable page — the opposite of
   expected funnel behaviour.
4. **First-party analytics does not distinguish the SRS's own listed conversion events.** SRS
   §9.20 lists "Hero audit started", "Final CTA audit started", and "Crawler-reference page
   opened" as distinct events to record. In the actual implementation,
   `apps/web/src/pages/api/audit/index.ts:141` fires one undifferentiated `audit_started` event
   regardless of which `AuditForm` instance submitted (hero, audit page, or final CTA all collapse
   to the same event with no `idPrefix`/source recorded), and `lib/analytics.ts`'s
   `PRODUCT_EVENT_NAMES` list (lines 13-27) has **no `crawler_reference_page_opened` event at
   all** — crawler-reference pages fire no tracked event on view. This means the funnel data
   needed to know whether the hero form or the final CTA converts better, or whether crawler pages
   drive signups, cannot currently be reconstructed from `product_events`.
5. **Automated accessibility and visual-regression coverage is public-site-only.** Both
   `apps/web/tests/a11y/home.spec.ts` (22 routes) and `apps/web/tests/visual/core-pages.spec.ts`
   (13 routes) exclude every `/app/*`, `/admin/*`, and `/shared/[token]` route entirely. The
   customer dashboard, billing, domains, groups, notifications, account pages, and the entire
   Super Admin surface have zero automated a11y or visual-regression coverage today. This is
   broader than the already-disclosed "no manual screen-reader walkthrough" risk in
   `KNOWN_RISKS.md` — it is a gap in the _automated_ net, not just the manual one.
6. **The honest "still in active development" disclaimer on `/pricing` sits directly under the
   only conversion path on the page**, which is the right call under the project's honesty rules
   but is presented with no softening context (e.g., what specifically is verified vs. pending) —
   worth a copy pass, not a removal (see Pricing section below; this is flagged as a judgement
   call for the user, not assumed).

### Main opportunities

- Wire the already-computed `categoryBreakdown` through the API contract and persistence layer —
  this is the single highest-leverage fix, since it closes a real SRS §10.24 gap and would let the
  real report match the (already well-designed) homepage demo.
- Bring `/pricing`'s CTA structure up to parity with the homepage's teaser (per-plan action, a
  recommended-plan highlight) — a low-effort, high-payoff conversion-consistency fix.
- Extend `test:a11y`/`test:visual` coverage to at least one representative authenticated route
  (e.g. `/app`, `/app/domains/[id]`, `/admin`) so the automated net matches the platform's actual
  surface area, not just the public site.
- Fill the three missing/merged analytics events so hero-vs-final-CTA and crawler-page-driven
  conversion can actually be measured — currently invisible in the data model itself.

### Highest-priority conversion problems

1. Pricing page CTA/consistency gap (#3 above) — directly sits between "convinced by homepage" and
   "creates an account."
2. Missing category breakdown on the real report (#1) — the single most persuasive, trust-building
   piece of the report (showing _why_ a score is what it is) is present in the demo but absent from
   every real result a prospect or customer actually sees.
3. Analytics blind spot on hero/final-CTA/crawler-page events (#4) — without this, no future
   conversion decision in this space can be made from real data.

---

## Route-by-route / area-by-area findings

### Homepage (`apps/web/src/pages/index.astro`)

- **Purpose:** Primary conversion surface — explain product, run an audit immediately, establish
  trust, convert (SRS §9.1).
- **Strengths:** Very faithful to the SRS. Hero form is in the first viewport with no forced
  signup (`AuditForm.tsx`); trust strip (lines 104-116) uses only factual, verifiable statements
  with an explicit rule comment against fabricated metrics; the report preview
  (`ReportPreview.tsx`) is clearly labelled "Illustrative example... not a real scan result" (line
  191 of `index.astro`) and the synthetic component itself carries a code comment reinforcing this;
  FAQ content and its JSON-LD (lines 464-477) are generated from the same `faqItems` array, so
  they cannot drift out of sync; pricing teaser correctly marks Pro as "Recommended" and uses the
  SRS's exact CTA labels (§9.16).
- **Weaknesses / friction:** The features/audience/signals sections (lines 211-325) are long,
  undifferentiated static blocks with no internal navigation (no in-page anchor nav beyond the one
  `#product` anchor used by the header). A returning visitor scanning for "what's different" has
  to scroll the full page; this is a minor information-hierarchy issue, not a defect.
- **Trust:** Strong. No dark patterns, no fake urgency, no invented counts — matches SRS §9.21 and
  §5.3 exactly on every point checked.
- **Value communication:** Good — "How CrawlPact works" (4 steps), core features, and audience
  sections all describe concrete tasks rather than generic marketing language, matching §9.11/§9.12.
- **Conversion friction:** Two audit forms exist (hero + final CTA) but fire the same undifferentiated
  analytics event (see main weakness #4) — not a UX friction for the visitor, but a measurement gap.
- **Information hierarchy:** Reasonable; one clear H1, logical section order matching the SRS's own
  §9.4–§9.19 ordering.
- **Mobile:** Not independently re-verified this pass (would require `test:visual`/manual device
  check, out of scope for a documentation-only pass); the page uses relative Tailwind utilities and
  `sm:`/`lg:` responsive grids throughout, consistent with `docs/design/RESPONSIVE_BEHAVIOUR.md`.
- **Accessibility:** Covered by `tests/a11y/home.spec.ts`'s `/` route — last recorded clean
  (0 WCAG 2.2 AA violations, see IMPLEMENTATION_STATUS.md).
- **Visual consistency:** Consistent with the design token system throughout; no hard-coded colour/
  spacing literals observed in the file.
- **Recommendation:** Fix the analytics event granularity (main weakness #4). Consider a lightweight
  in-page section nav for returning visitors (Low priority, cosmetic).
- **Priority:** Medium (the page itself is strong; the analytics gap is the real item).
- **Expected benefit:** Ability to measure hero-vs-final-CTA conversion; marginal scanability
  improvement for long-scroll visitors.

### `SiteHeader.astro` / `SiteFooter.astro`

- **Purpose:** Persistent navigation and trust/legal surface across every marketing page.
- **Strengths:** Header nav matches SRS §9.6 exactly (Product/Free tools/AI crawlers/Guides/
  Pricing/Methodology/Sign in + "Audit a domain" CTA). Footer's three columns (Product/Resources/
  Company and legal) match §9.19 verbatim, including all legal/status links. Both are zero-JS
  static Astro markup — only `MobileNav` is a client island, matching ADR-0003/§9.22's
  "minimise JavaScript" intent.
- **Weaknesses:** None found relative to spec. `MobileNav.tsx` correctly uses a Radix `Dialog`
  (`Drawer`) with focus trap/Escape, matching `docs/design/ACCESSIBILITY_REQUIREMENTS.md`.
- **Trust / value / conversion:** N/A (navigation chrome) — no issues found.
- **Mobile:** `MobileNav` is `xl:hidden`/desktop nav is `hidden xl:block`. **Historical note**:
  this row previously said `md:`/768px was "correct" — it wasn't; the desktop nav didn't fit at
  either this project's remapped `md:` (640px) or `lg:` (768px), a real overflow bug found via
  Playwright and fixed by moving the split to `xl:` (1024px, this project's remapped scale — see
  `packages/ui/src/tokens/tokens.css`). See `docs/status/KNOWN_RISKS.md`. A previously-fixed
  Playwright race (mobile Safari hydration) is documented there as resolved.
- **Accessibility:** `aria-label="Primary"` on nav, `aria-hidden` on decorative logo glyph,
  `IconButton` requires a `label` prop (enforced by the component's own type).
- **Recommendation:** None required.
- **Priority:** N/A.

### Audit-related components (`AuditForm.tsx`, `ReportPreview.tsx`, `AuditReportView.tsx`)

- **Purpose:** The core product interaction (domain entry → honest result) and its report display.
- **Strengths:** `AuditForm.tsx` does client-side normalisation before any network call (line 40),
  prevents duplicate submission (line 38), preserves entered value on error, and honestly surfaces
  `AUDIT_ENGINE_DISABLED` as a distinct, non-alarming state (lines 66-68) rather than a generic
  error — exactly matching the project's anti-fabrication rule. `AuditReportView.tsx`'s `focus`
  reordering mechanism (lines 38-45) is a genuinely honest implementation of the SEO free-tools
  requirement: it reorders real sections, never hides or duplicates data.
- **Weaknesses:** The category-breakdown gap (main weakness #1) lives here — `AuditReportView.tsx:374`
  is the exact line missing the prop. Additionally, the report's Score section (lines 353-383)
  does not surface "Registry version" and "Preset" with equal visual weight to the score itself
  (they're in a smaller supporting-text line, line 376-381) — a minor information-hierarchy note,
  not a defect, since SRS §23 lists them as required report _contents_, not requiring equal visual
  prominence.
- **Trust:** Strong — the "Recommended configuration" section (lines 176-197) explicitly states
  "CrawlPact never modifies your website directly" inline, and RSL/Content Signals sections
  correctly caveat that these are declarations, not enforcement (lines 253-259).
- **Conversion friction:** None specific to this component; the "Print report" button (line
  364-370) and copy-to-clipboard (lines 185-195) are real, working features, not placeholders.
- **Accessibility:** Uses semantic `<table>` for the crawler matrix (SRS §10.25), `Alert` role
  wiring inherited from `packages/ui`.
- **Recommendation:** Fix category breakdown propagation end-to-end (contract → persistence →
  component prop). This requires touching `packages/core`'s zod contract, the `scans` table/
  migration, `persist-scan.ts`, and `get-scan-report.ts` — a real (if contained) schema change,
  flagged here for scoping, not attempted in this documentation-only pass.
- **Priority:** High.
- **Expected benefit:** Every real report becomes as informative and trust-building as the
  homepage's own demo already is — directly supports "establish technical trust" (SRS §9.1).

### `MarketingLayout.astro` / `AppLayout.astro` / `AdminLayout.astro` / `BaseLayout.astro`

- **Purpose:** Shared chrome, SEO metadata, and environment indicator across all three shells.
- **Strengths:** `BaseLayout.astro` centralises canonical URL, OG/Twitter tags, JSON-LD graph,
  skip-link (with a real `tabindex="-1"` target, a previously-fixed real bug per
  `ACCESSIBILITY_REQUIREMENTS.md`), and the SRS §10.43 environment banner (lines 36-47, 133) driven
  by one shared `PUBLIC_APP_ENV` value — a single source of truth used by all three layouts. This
  is genuinely well-factored: three different shells, one metadata/accessibility/environment
  foundation.
- **Weaknesses:** None found in the layouts themselves.
- **Visual consistency:** `AppLayout` and `AdminLayout` intentionally use different visual
  registers (light neutral-50 background with a top nav vs. a dark neutral-950 sidebar) — this is
  a deliberate, documented distinction (SRS §10.15–§10.17 describe separate customer/Super-Admin
  navigation structures) rather than an inconsistency.
- **Recommendation:** None required.
- **Priority:** N/A.

### `apps/web/src/pages/audit/index.astro` and `[auditId].astro`

- **Purpose:** Dedicated audit entry point and report display route.
- **Strengths:** `index.astro`'s progress-stage list (lines 20-40) sets honest expectations before
  submission ("Validating target" → "Preparing the report") without a fabricated percentage,
  matching SRS §10.32. `[auditId].astro` correctly gates the share dialog behind a real session
  check (lines 33-36) rather than showing it to anonymous visitors who have no ownership to
  authorise a share.
- **Weaknesses:** Same category-breakdown gap as above (inherited from `AuditReportView`). The
  8-step progress list on `/audit` is static (not tied to the actual in-flight scan's real stage)
  — this is disclosed nowhere as a simulation, but it also isn't presented as live progress; it
  reads as general expectation-setting copy rather than a progress bar, so it does not violate
  SRS §10.32's "never a fabricated percentage" rule. Still, a visitor could reasonably read it as
  a step-by-step live tracker.
- **Recommendation:** Either wire this list to real `ProgressSteps` states during the actual scan,
  or add a one-line qualifier ("Typical stages:") to avoid any reasonable misread as live progress.
- **Priority:** Low.
- **Expected benefit:** Removes a small, plausible-but-minor trust ambiguity.

### `apps/web/src/pages/pricing.astro`

- **Purpose:** Full plan comparison and upgrade decision point (SRS §9.16 links here).
- **Strengths:** Full 10-row feature comparison table (correctly using `<th scope="row">` for
  accessible row headers), matches the SRS §8 subscription table exactly plan-for-plan, and states
  "Plan definitions are stored as product data, not hard-coded" (line 74) — an honest, technically
  accurate claim.
- **Weaknesses (main weakness #3, restated with detail):** No per-plan CTA, no "Recommended" plan
  indicator (unlike the homepage teaser), and the single CTA at the bottom is a generic "Create an
  account" link rather than the SRS §9.16-style "Choose Solo/Pro/Agency" pattern already used
  elsewhere in this same codebase. This is an internal consistency gap, not a missing feature —
  the pattern to copy already exists in `index.astro`.
- **Trust problems:** None found — no hidden fees, correct Paddle/tax disclosure (lines 73, 152-153).
- **Value communication:** The comparison table communicates _what_ differs between plans well, but
  not _why_ a given plan fits a given visitor (no "recommended for..." framing per plan).
- **Conversion friction:** High relative to the homepage — a visitor who wants "more detail" before
  committing is rewarded with a page that asks them to do more work (find "Create an account",
  infer which plan to pick) than the page they came from.
- **Information hierarchy:** Reasonable — one clear H1, one table, but the CTA is visually
  subordinate (a plain paragraph link, line 150-154) to the disclaimer immediately below it
  (line 155-160).
- **Mobile:** Table is wrapped in `overflow-x-auto` with `role="region"` and a focusable
  `tabindex="0"` container (line 81) — correctly implements SRS §10.22's horizontal-scroll-as-
  last-resort pattern with an accessible name.
- **Accessibility:** Covered by `tests/a11y/home.spec.ts`'s `/pricing` route.
- **Recommendation:** Add per-plan action buttons (reusing the homepage's card pattern or linking
  each plan directly into `/sign-in` with the target plan pre-selected) and a recommended-plan
  highlight consistent with the homepage. Also reconsider the relative visual weight of the
  "still in active development" disclaimer (line 155-160) versus the CTA immediately above it —
  this is a genuine honesty requirement that should stay, but _how_ prominently it competes with
  the conversion action is a legitimate design/business judgement call: **flagged for the user**,
  since softening its visual weight could be read either as good UX polish or as under-selling a
  real, disclosed limitation, and that trade-off isn't a call a UI audit should make unilaterally.
- **Priority:** High.
- **Expected benefit:** Closes the single largest measured drop-off point implied by the funnel
  structure (homepage teaser → full pricing → account creation).

### `apps/web/src/pages/app/index.astro` (customer dashboard)

- **Purpose:** Post-login overview: portfolio health, what needs attention, next scheduled scan.
- **Strengths:** Correctly handles the zero-domain case with a real, working empty state (lines
  90-105) — this is the exact page that had a real SSR crash for empty accounts, now fixed and
  covered by e2e per `IMPLEMENTATION_STATUS.md`. "Needs attention" sorting (open findings first,
  low score second, lines 23-26) is a genuinely useful triage default, not just a list dump.
- **Weaknesses:** None found relative to spec; this page is a good example of matching SRS §10.30's
  "top summary / priority actions / domain health / recent activity" structure (missing only a
  distinct "recent activity" feed, which is arguably covered by "Needs attention" for this stage
  of the product).
- **Mobile:** `grid-cols-1 sm:grid-cols-3` metric cards — standard responsive stacking.
- **Recommendation:** None required beyond the shared category-breakdown fix (this page shows a
  bare average score number with no breakdown, same root cause as the report view).
- **Priority:** Low.

### `apps/web/src/pages/app/domains/index.astro` and `[domainId].astro`

- **Purpose:** Domain list/management and per-domain detail/history.
- **Strengths:** `index.astro` correctly gates CSV export behind `plan.csvExportEnabled` (line 27)
  rather than showing a disabled button with no explanation. `[domainId].astro` correctly handles
  the not-found/not-owned case (`ErrorState`, lines 24-27) and links back to the full report.
- **Weaknesses:** The score-label bug (main weakness #2): `[domainId].astro:53-59` passes
  `label: ""` — every other score display in the app has a label; this one doesn't. Root cause is
  in `lib/domains.ts` (`currentScore` is a bare `number | null`, no label computed alongside it).
- **Recommendation:** Compute the label (reuse the `scoreLabel()` helper already present in
  `apps/web/src/lib/get-scan-report.ts:219`) in `lib/domains.ts` or at the page level, and pass it
  through. Small, contained fix.
- **Priority:** Medium.
- **Expected benefit:** Removes a visible, easily-noticed blank-label defect on a page every
  paying customer visits regularly.

### `apps/web/src/pages/app/groups/index.astro`, `notifications/index.astro`, `billing/index.astro`, `account/index.astro`

- **Purpose:** Agency organisation, notification centre, subscription management, account/security
  settings.
- **Strengths:** `groups/index.astro` correctly shows a plan-gated upsell (lines 25-37) rather than
  hiding the feature entirely or showing a broken empty page — good "contextual upgrade prompt"
  behaviour per SRS §10.39. `billing/index.astro` is a strong implementation of §10.40: shows
  current plan, subscription status via `StatusChip`, past-due and scheduled-cancellation states as
  distinct `Alert`s (lines 76-96), domain usage, monitoring frequency, renewal date, and correctly
  defers to Paddle's portal (`PortalButton`) rather than reimplementing an invoice UI — exactly
  matching the SRS's explicit instruction not to reproduce Paddle's interface. `account/index.astro`
  cleanly separates profile/passkeys/recovery codes/sessions/delete-account into distinct sections
  with a working `pendingDeletion` acknowledgement state (line 53).
- **Weaknesses:** None significant found in these four pages; they are consistent with each other
  and with the design system.
- **Conversion friction:** `billing/index.astro`'s upgrade cards (lines 136-155) are plain
  bordered boxes with a single button — functionally correct but visually flatter than the
  homepage/­pricing-page plan cards; a minor cross-page visual-consistency note, not a defect.
- **Recommendation:** Low priority — align billing page's upgrade card styling with the
  homepage/pricing card pattern for visual consistency across the three places a plan is shown.
- **Priority:** Low.

### `apps/web/src/pages/shared/[token].astro`

- **Purpose:** Client-safe, agency-brandable public report view via a revocable high-entropy link.
- **Strengths:** Correctly renders `AuditReportView` with `agencyBranding` passed through, and the
  branding block itself (`AuditReportView.tsx:321-350`) explicitly discloses "shown here with
  additional branding added by the sender... unaffected by that branding" — a genuinely honest
  design that prevents agency branding from being able to imply CrawlPact's own findings were
  altered. Handles expired/revoked/nonexistent tokens with a real `ErrorState`, not a crash or a
  generic 404.
- **Weaknesses:** None found; same category-breakdown gap as all other real reports (inherited,
  not page-specific).
- **Priority:** N/A beyond the shared report-view fix.

### Admin pages (`/admin`, `AdminNav.astro`, `/admin/users`, `/admin/security`, sampled)

- **Purpose:** Super Admin operational control center (SRS §28, all 20 subsections).
- **Strengths:** Every sampled page follows one consistent pattern: `getAdminPageSession` guard →
  `AdminPageHeader` → a single React island manager component. The global dashboard
  (`admin/index.astro`) has a genuinely good trust feature not explicitly required by the SRS
  audit scope but directly relevant to it: a visible warning banner (lines 62-69) when revenue
  figures are from Paddle sandbox data, not production — this is exactly the kind of honest
  environment-labelling SRS §10.43 asks for, applied specifically to revenue, which is the
  highest-stakes place to get this wrong. `AdminNav.astro`'s environment badge (lines 8-14, using
  distinct tones for Production/Sandbox/other) reinforces the same discipline in persistent chrome.
- **Weaknesses:** None found in the sampled pages relative to spec.
- **Information hierarchy:** The admin nav (`AdminNav.astro:16-69`) groups 20 links into 6 logical
  sections (Overview/Customers/Product operations/Crawler intelligence/Security/Configuration) —
  appropriately dense for an information-dense admin tool per SRS §10.42, with `aria-current="page"`
  wired for the active link.
- **Accessibility / Mobile:** The admin sidebar is `hidden ... lg:flex` with no documented mobile
  fallback nav pattern (no hamburger/drawer equivalent to `MobileNav` for the admin shell) — on a
  viewport below `lg` (1024px), an admin user has no visible way to navigate between the 20 admin
  sections other than the URL bar. This is a real, concrete gap: SRS §10.47 (tablet) and the
  general responsive requirement apply to the admin shell too, and the Super Admin is a real user
  who may need to act from a phone (e.g., pausing the scheduler, resolving a security event).
- **Recommendation:** Add a mobile/tablet navigation affordance to `AdminLayout`/`AdminNav`
  (reusing the existing `MobileNav`/`Drawer` pattern already built for the public site) rather than
  leaving the admin shell desktop-only.
- **Priority:** Medium (admin is a small, technical user base, but the gap is total, not partial,
  below 1024px).
- **Expected benefit:** Makes emergency admin actions (pause scheduler, block a target, resolve a
  security event) actually possible from a phone/tablet, not just a desktop.

### `apps/web/src/pages/sign-in.astro`

- **Purpose:** Passkey-only authentication entry point.
- **Strengths:** Honest, minimal copy ("no password, no email") matching ADR-0004 exactly; single
  `PasskeyAuth` island, no dead-weight marketing copy on a functional page.
- **Weaknesses:** None found.
- **Priority:** N/A.

### `packages/ui/src` — design tokens and shared components

- **Purpose:** Single source of visual truth (ADR-0003) for ~35 component types.
- **Strengths:** `tokens.css` is a genuine strength worth calling out specifically: two colour
  values (`--color-neutral-500`, `--color-warning`) were deliberately _darkened_ from the SRS's own
  suggested values, with an inline comment explaining the SRS's suggestion measured 3.8-3.9:1
  contrast (failing WCAG AA's 4.5:1 threshold) and citing the axe-core scan that caught it (lines
  42-46, 57-60). This is exactly the right way to handle an SRS value that doesn't hold up in
  practice — documented, justified, tested, and within the SRS's own explicitly-granted latitude to
  adjust exact values. `ScoreComponent.tsx` correctly implements the "never a gauge" rule (SRS
  §10.24) as a horizontal band, and its `role="img"` + descriptive `aria-label` (lines 55-57) gives
  the visual bar a proper accessible name rather than relying on the adjacent text alone.
- **Weaknesses:** None found in the sampled components (`ScoreComponent`, plus the full component
  list cross-referenced against `docs/design/UI_COMPONENTS.md` — all 36 documented components exist
  in `packages/ui/src/components/`, one-to-one).
- **Recommendation:** None required for the design system itself; see component-specific findings
  above (category breakdown, domain-detail label) for where _consumers_ of `ScoreComponent` don't
  pass what it's capable of rendering.
- **Priority:** N/A.

### Analytics / conversion events (`lib/analytics.ts`, `lib/analytics-client.ts`, `AnalyticsBeacon.tsx`, `api/analytics/track.ts`)

- **Purpose:** First-party, no-third-party-vendor conversion tracking (SRS §9.20, §33).
- **Strengths:** Genuinely well-built as far as it goes: one row per event in `product_events`
  (no PII beyond an optional `userId`/`anonymousId`), a shallow, structured `properties` field with
  an explicit code comment against ever storing session/auth tokens there (lines 9-11 of
  `analytics.ts`). No third-party analytics vendor anywhere — verified by absence, matching SRS
  §6.2.
  - **Weaknesses:** See main weakness #4 — `crawler_reference_page_opened` is entirely absent
    from `PRODUCT_EVENT_NAMES` (lines 13-27), and hero/audit-page/final-CTA `AuditForm` instances all
    report the same `audit_started`/`audit_completed` events with no distinguishing property, despite
    `AuditForm` already carrying an `idPrefix` prop that could be forwarded as exactly that
    distinguishing property at near-zero cost.
- **Recommendation:** Add `crawler_reference_page_opened` (fired from the crawler detail page
  template) and extend the `/api/audit` request body to accept and record the calling `idPrefix`
  (or a coarser `source: "hero" | "audit_page" | "final_cta" | "tool"`) as an event property.
- **Priority:** Medium-High (blocks the specific measurement the SRS asks for, cheap to fix).
- **Expected benefit:** Makes the funnel from "saw a crawler page" or "used the final CTA"
  measurable, which is a prerequisite for any future, evidence-based conversion optimisation in
  this exact area.

### Testing infrastructure (visual regression, accessibility)

- **Purpose:** Automated regression nets for WCAG 2.2 AA and pixel-level visual consistency.
- **Strengths:** Both suites are well-constructed and honestly scoped — `core-pages.spec.ts`'s own
  comment explains it deliberately covers "one representative page per remaining distinct
  template," and `home.spec.ts` explicitly documents that automated axe scans are a "fast set," not
  a substitute for manual review, with the gap tracked in `ACCESSIBILITY_REQUIREMENTS.md`.
- **Weaknesses:** As noted in main weakness #5, coverage is 100% public-site routes across both
  suites (22 a11y routes, 13 visual routes) — zero authenticated (`/app/*`), admin (`/admin/*`), or
  shared-report routes in either list. Given the customer dashboard and Super Admin together
  represent a large fraction of the actual UI surface (36+ components, dozens of pages), this is a
  meaningfully larger blind spot than "public site only," even though it's the right place to have
  started.
- **Recommendation:** Add at least one authenticated route per suite (e.g. `/app` with a seeded
  test account, `/admin` with a seeded admin session) — both suites already have the session-setup
  test helpers needed for this from the e2e suite (`tests/e2e/helpers/admin-db.ts`), so this is
  largely wiring existing infrastructure into two more test files rather than new tooling.
- **Priority:** Medium.
- **Expected benefit:** Closes the largest concrete gap between "what SRS §33/§35.5 requires
  (WCAG 2.2 AA platform-wide)" and "what's actually mechanically checked."

---

## Notes on scope and judgement calls

- The `/pricing` disclosure-vs-CTA-prominence trade-off (see Pricing section) is explicitly
  flagged as a product/business decision, not resolved here, per this task's instructions.
- No claim in this document recommends removing or softening any SRS §5.3/§9.21 honesty
  requirement (disabled-state disclosures, limitations content, sandbox-revenue banners) — every
  recommendation either adds missing data to an already-honest display (category breakdown, score
  label) or improves internal consistency (pricing CTAs, analytics events, admin mobile nav), none
  of it trades honesty for polish.
- This audit did not re-run `test:a11y`, `test:e2e`, or `test:visual` (no UI code changed this
  session; per the quality-gate skill's own guidance these are only required when UI routes
  change). Their most recent recorded results are cited from `IMPLEMENTATION_STATUS.md`, not
  re-verified here, and that distinction is preserved above.
