# Phase 2 — Brand Positioning and Messaging System — Completion Report

Branch `phase-02-brand-positioning-messaging`, based on `main` at `21fd62e` (Phase 0 + Phase 1
merged). Established 2026-08-03.

## Executive summary

Phase 2's objective was to establish one coherent, evidence-governed brand and messaging system
across every public, authenticated, admin, and technical surface — informed by Phase 0's finding
that the product is already faithful to the SRS with no fake trust signals — while strictly
preserving current homepage layout, pricing, product logic, scoring, crawler classifications,
registry contents, monitoring behaviour, billing/Paddle configuration, auth, Cloudflare
configuration, and analytics implementation unchanged.

Three independent, parallel, read-only research passes inspected every public marketing surface,
every authenticated product and admin surface, and every technical/metadata/structured-data
surface plus a repository-wide grep for prohibited claims and the stale tagline. **All three
passes independently confirmed zero prohibited claims, zero fabricated proof, and zero live
occurrences of the stale tagline anywhere in current product copy.** Phase 2's corrective work was
therefore narrow: building the governance scaffolding (five brand documents, a central config
module, a validation script wired into CI) and applying a small number of precise corrections
(centralising duplicated brand strings, fixing one real button-text inconsistency, aligning two
stale category phrases) rather than a sweeping rewrite. One real cross-document conflict was found
and recorded — not silently fixed — per the prompt's explicit instruction not to edit the SRS
without an approved ADR.

## Starting point

- Branch created from `main` at `21fd62e5` (Phase 0 PR #68 and Phase 1 PR #69 both merged).
- No `docs/brand/` directory existed. No central brand-messaging config module existed —
  `apps/web/src/lib/trust-config.ts` was the closest existing pattern (legal/trust facts only, no
  tagline/category/promise/description strings).
- SRS §2.3 ("Know what AI crawlers can access.") had not been revisited since before this
  workstream's earlier phases corrected the homepage's actual promise sentence.

## Brand system established

| Document                                               | Purpose                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/brand/BRAND_POSITIONING_AND_MESSAGING_SYSTEM.md` | Product/category definitions (one-sentence/short/medium/long), audience hierarchy (primary: agencies/multi-site teams; secondary: publishers, SaaS/docs teams; supporting: individual owners), problem/outcome hierarchies, differentiation, product boundaries, brand promise, tagline, brand enemy, 10 brand principles, objection-handling, CTA hierarchy, proof hierarchy |
| `docs/brand/VOICE_AND_STYLE_GUIDE.md`                  | 7 required voice traits (Calm, Precise, Independent, Evidence-led, Honest, Helpful, Professional), ~15 writing rules, evidence-wording prefer/avoid lists, worked example                                                                                                                                                                                                     |
| `docs/brand/PRODUCT_TERMINOLOGY_GLOSSARY.md`           | Crawler-purpose taxonomy, policy/evidence terms, scanning/monitoring terms, 5 required distinctions                                                                                                                                                                                                                                                                           |
| `docs/brand/CLAIMS_AND_MESSAGING_GUIDE.md`             | 7-level evidence precedence, 6 claim categories, approved-claims table (9 rows, each cited to Phase 0 evidence), qualified-claims wording, all 17 prohibited claims verbatim, required disclaimers, competitive/emerging-standards/customer-proof rules                                                                                                                       |
| `docs/brand/MESSAGING_SURFACE_INVENTORY.md`            | Every public (23 rows), technical/metadata (13 rows), authenticated (13 rows), and admin (4 rows) copy surface, plus documentation cross-references and GitHub-metadata findings                                                                                                                                                                                              |
| `docs/brand/GITHUB_BRAND_METADATA_MANIFEST.md`         | Live-checked current GitHub repo description/topics (both empty) and the recommended values/command                                                                                                                                                                                                                                                                           |

## Central brand config module

`apps/web/src/config/brand.ts` — a single typed `BRAND` constant (product name, tagline, brand
promise, public/strategic category, five description lengths, GitHub/social descriptions, default
title suffix, primary audience, differentiator, approved boundary statement, standard report/
registry disclaimers, canonical CTA labels). Deliberately excludes legal/trust facts (already owned
by `trust-config.ts`) and plan prices (owned by the `plans` table / `pricing.astro`).

## Research findings (three parallel passes)

- **Public marketing surfaces** (homepage, pricing, audit flow, report view, crawler directory,
  tools, guides, about, status, methodology, legal pages, sign-in, 404, footer/header): zero
  prohibited claims, zero fabricated proof; every disclaiming surface already followed the exact
  pattern this phase's `CLAIMS_AND_MESSAGING_GUIDE.md` now formalises.
- **Authenticated product and admin surfaces** (dashboard, domain onboarding, notifications, Atom
  feed, billing, agency branding/sharing, account settings, 23 admin page headers, empty/error
  states): consistently precise and self-limiting language throughout ("only fields Paddle actually
  sends", "never a hardcoded 'all good'"). Two completeness gaps found (not copy defects) and
  deferred to Phase 8, which already owns that scope — see below.
- **Technical/metadata surfaces** (`BaseLayout.astro`, JSON-LD builders, `package.json` files,
  `robots.txt`/`sitemap.xml`, API error strings, seed fixtures): no fabricated ratings/reviews/stale
  pricing anywhere; the only live discrepancy found was SRS §2.3 itself.

## Corrections applied

- **Centralised** (previously hardcoded, now read from `apps/web/src/config/brand.ts`):
  `BaseLayout.astro`'s JSON-LD `Organization`/`WebSite`/`Article` author name and description,
  `og:site_name`; the homepage `<title>` and meta description; `SiteFooter.astro`'s tagline
  paragraph and copyright line; `SiteHeader.astro`'s nav brand text.
- **Fixed a real inconsistency**: `AuditForm.tsx`'s primary CTA button read "Audit domain" — the
  one outlier against "Audit a domain," which was already used consistently in `SiteHeader.astro`,
  `crawlers/[slug].astro`, and `guides/[slug].astro`. Corrected the outlier to match the
  established pattern (rather than inventing new copy) and updated the four e2e assertions that
  referenced the old text (`landing-page.spec.ts`, `responsive-smoke.spec.ts`,
  `auth-and-account.spec.ts`).
- **Aligned stale category phrasing**: root `package.json`'s `description` field ("... AI Crawler
  Policy Auditor & Monitor") updated to the new canonical public category.
- **Corrected the brand doc itself** where its own first draft had invented wording not present
  anywhere in the live product: `cta.primaryAcquisition` was drafted as "Audit a domain free" (never
  used as live CTA text); corrected to "Audit a domain" to match the real, already-consistent
  product pattern instead of introducing new invented copy.

No homepage layout, pricing, product logic, scoring, crawler classification, registry content,
monitoring behaviour, billing/Paddle configuration, authentication, Cloudflare configuration, or
analytics implementation was changed.

## Deliberately not fixed (recorded, not silently resolved)

- **SRS §2.3 vs. the new brand system** (RISK-028, `docs/risks/ACTIVE_RISKS.md`): the SRS's own
  Primary Tagline ("Know what AI crawlers can access.") conflicts with both its own §2.2 Primary
  Product Promise (which the live homepage actually uses) and the new canonical tagline. Per
  `CLAUDE.md`, the SRS outranks other documents unless an approved ADR records a deviation — this
  phase recorded the conflict and routed reconciliation to Phase 3 rather than editing the SRS
  itself.
- **Two authenticated-surface completeness gaps** (`docs/brand/MESSAGING_SURFACE_INVENTORY.md` rows
  C3, C5): the domain-detail scan-history list shows raw status-enum text instead of reusing
  `AuditReportView.tsx`'s existing `STATUS_LABEL` map; no customer-facing UI surfaces
  `scan_diffs`/`diffType` (only the notification stream, gated to high/critical severity). Both
  routed to Phase 8 ("Saved-Domain Experience and Change Timeline"), which already owns this exact
  scope per the roadmap.
- **`package.json` description gaps** (10 files with no `description` field): low-priority
  consistency gap, routed to Phase 3.
- **GitHub repository description/topics**: live-checked as empty; recommended values recorded in
  the manifest rather than applied live, per the manifest-only precedent established in Phase 0.

## Validation

| Command                                                              | Result  | Notes                                                                                                                                                                                                  |
| -------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm brand:validate`                                                | ✅ Pass | 472 files scanned; 0 errors, 0 warnings after allowlist entries for quoted/negated occurrences                                                                                                         |
| `pnpm docs:validate`                                                 | ✅ Pass | 9 required files present                                                                                                                                                                               |
| `pnpm baseline:validate`                                             | ✅ Pass | 17 required files present                                                                                                                                                                              |
| `pnpm format:check`                                                  | ✅ Pass | after `pnpm format`                                                                                                                                                                                    |
| `pnpm lint`                                                          | ✅ Pass | 0 errors                                                                                                                                                                                               |
| `pnpm typecheck`                                                     | ✅ Pass | 0 errors (pre-existing third-party deprecation warnings only)                                                                                                                                          |
| `pnpm test:unit`                                                     | ✅ Pass | 238 tests, 25 files (8 new: `brand.test.ts`, `base-layout-brand.test.ts`)                                                                                                                              |
| `pnpm test:integration`                                              | ✅ Pass | 149 tests, 24 files                                                                                                                                                                                    |
| `pnpm db:validate`                                                   | ✅ Pass | 40 tables verified                                                                                                                                                                                     |
| `pnpm registry:validate`                                             | ✅ Pass | no issues found                                                                                                                                                                                        |
| `pnpm build`                                                         | ✅ Pass | verified built `dist/client/index.html` directly: canonical title, JSON-LD description, `og:site_name`, and footer copy all render from `BRAND`; zero remaining "Audit domain" (only "Audit a domain") |
| `pnpm test:e2e` (`landing-page`, `responsive-smoke` specs, chromium) | ✅ Pass | 20/20, against a live local dev server                                                                                                                                                                 |
| `pnpm test:e2e` (`auth-and-account` spec, chromium)                  | ✅ Pass | 8/8 — exercises the renamed CTA button through a real passkey registration/audit flow                                                                                                                  |
| `pnpm test:a11y` (chromium)                                          | ✅ Pass | 82/82                                                                                                                                                                                                  |
| `pnpm secrets:scan`                                                  | ✅ Pass | no known secret patterns                                                                                                                                                                               |

Exact durations/exit codes were captured during actual execution against this branch, not assumed.

## Runtime impact

**This phase changes documentation, a new config module, brand-string centralisation, one CTA
button label, one JSON-LD/meta description wiring path, and CI/test configuration. It does not
change product logic, scoring, crawler registry content, monitoring behaviour, billing/Paddle
configuration, authentication, Cloudflare configuration, analytics implementation, or pricing.**

## Deployment

**No production deployment is required for Phase 2**, and none occurred. `.github/workflows/ci.yml`
gained one new step (`pnpm brand:validate`, read-only, no network access).

## Rollback

This phase's changes are documentation/config/copy/CI-configuration-only and can be reverted by
reverting the pull request — no data migration or infrastructure rollback is needed.

## Risks

- **New risk recorded**: RISK-028 (SRS §2.3 tagline conflict) — see `docs/risks/ACTIVE_RISKS.md`.
- **Risks carried forward unchanged**: all 27 pre-existing entries in `docs/risks/ACTIVE_RISKS.md`
  — this phase did not close any non-documentation risk.

## Future phases

Phase 3 (Legal Identity, Contact, Security and Trust Foundation) now additionally owns reconciling
SRS §2.3 with this phase's brand system and the low-priority `package.json` description gap. Phase
8 (Saved-Domain Experience and Change Timeline) additionally owns the two authenticated-surface
completeness gaps this phase found and deferred. See
`docs/roadmap/CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md` for full detail.
