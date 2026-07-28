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

**Where it will be used later:** audit report Level 1 header (Phase 5), shared-report view
(Phase 5), domain-detail full-report view (Phase 6). Not wired into any page yet — this session
only adds it to `packages/ui` and the dev showcase.

### B. Evidence Rail — `EvidenceRail` (built this session)

`packages/ui/src/components/EvidenceRail.tsx`. One rail per finding: Observed → Interpretation →
Impact → Action → Evidence, rendered as a connected vertical list (border-left rail line, per-step
eyebrow label + content). Each of the five slots is `ReactNode | null`; `null` renders "Not
available for this finding" rather than an empty gap (a silent gap reads as a layout bug; an
explicit statement reads as an honest limitation).

**Where it will be used later:** audit report Level 2 findings list (Phase 5), guide pages that
walk through a specific finding (Phase 4). Not wired into any page yet.

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

**Progress so far** (commits `abb7821`, `147d82c`, `8e633d3`):
- `index` — added the missing "Evidence and methodology" section (§6 item 9 of the source
  brief), migrated one isolated `max-w-[720px]` to the `max-w-reading` token, added "who it's
  for" audience line to each pricing-summary plan card.
- `SiteHeader.astro` / `MobileNav.tsx` (shared chrome, used by every public page) — added
  `aria-current="page"` + visual current-section indication on both desktop and mobile nav.
- `pricing` — added "who it's for" audience line to each of the 4 plan cards (a requirement
  explicitly listed in source brief §9 that was previously missing entirely).
- `crawlers/[slug]` — reviewed against source brief §8's required field list (Operator,
  User-agent token, Purpose, Documented behaviour, Official source, Registry version, CrawlPact
  interpretation, Limitations). All covered except "Registry version," which has no real data
  source at this layer (these are static SEO markdown files, not tied to a live registry
  release) — deliberately not added rather than fabricated. No changes made; already compliant.
- Everything else in this phase's route list: **not started**.

### Phase 5 — Audit and reports

`audit/index` (entry form), `audit/[auditId]` (report view — must keep reflecting
`AUDIT_ENGINE_ENABLED=false` honestly), `shared/[token]` (shared report view: valid / revoked /
expired / invalid / agency-branded states).

### Phase 6 — Authentication and customer app

Sign-in flow copy/UX polish (route itself is Phase 4, but WebAuthn-ceremony UX detail belongs
here), `app/index` (dashboard), `app/domains/index`, `app/domains/[domainId]`, `app/groups/index`,
`app/notifications/index`, `app/billing/index`, `app/account/index` (profile/passkeys/recovery
codes/sessions/deletion, all as sub-sections of one route).

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
