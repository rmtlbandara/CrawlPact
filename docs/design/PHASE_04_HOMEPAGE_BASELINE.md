# Phase 4 Homepage Baseline

**Level 3 document (Evidence).** Captured before any Phase 4 redesign work, from direct
inspection of `apps/web/src/pages/index.astro` at commit `abab3d4` (Phases 0-3 merged) — not
assumed or reconstructed from memory. Established 2026-08-03.

## Current section order (14 sections, in `index.astro` as of `abab3d4`)

1. Hero — H1, supporting copy, `AuditForm`, `WebsiteAuditMark` artwork (desktop only)
2. Trust strip — 6 short claims ("Vendor-neutral", "No installation", etc.)
3. Problem explanation (`id="product"`) — H2 "AI crawler policy is no longer a single
   allow-or-block decision", 6 purpose pills
4. How CrawlPact works — 4-step numbered list
5. "See what a report looks like" — synthetic `ReportPreview` (score + 4 crawler rows), labelled
   "Illustrative example using a synthetic demonstration domain — not a real scan result"
6. Core features — 7-card grid
7. Evidence and methodology — 2 link cards (methodology, scoring)
8. "Built for real workflows" — 6-card audience grid (SEO agencies, publishers, SaaS, docs sites,
   developers, technical owners)
9. Supported public signals — pill list of 10 signal names
10. AI crawler directory preview — first 4 crawlers from the content collection
11. Monitoring value — "A correct policy today can become outdated tomorrow", 5-item list
12. Pricing summary — 4 plan cards (hardcoded array duplicating `pricing.astro`'s `plans`)
13. FAQ — 10-item `Accordion`, mirrored exactly in `FAQPage` JSON-LD
14. Final CTA — panel with a second `AuditForm` instance

## Current strengths (confirmed, not to be lost)

- Already honest: zero prohibited claims, zero fabricated proof (reconfirmed by Phase 2's
  research — nothing has changed since).
- Search/training/user-triggered/agent purpose separation is already present (pill list),
  though not yet explained in depth per-purpose.
- The synthetic report preview is already clearly, correctly labelled as illustrative.
- FAQ already answers most of Phase 4's required questions accurately (block/guarantee/install/
  AI-use/search-vs-training/registry-drift/legal-advice/monitoring).
- Monitoring-value section already distinguishes some website-driven vs. registry-driven causes.
- H1 ("Audit and monitor your website's AI crawler policy.") matches SRS §2.2's Primary Product
  Promise and was explicitly reviewed and retained (not rewritten) during Phase 2's messaging
  audit — see `docs/brand/MESSAGING_SURFACE_INVENTORY.md` row A1.

## Current weaknesses (addressed this phase)

- **No dedicated "why this matters" risk section** — the problem is stated once, briefly, without
  the three concrete risk scenarios (search-blocking, unspecified training, policy drift) Phase 4
  requires.
- **No standalone sample-report route** — the only preview is a small inline `ReportPreview`
  (score + 4 rows); there is no full report a visitor can browse before running their own audit.
- **No dedicated agency/multi-domain section** — "Built for real workflows" mentions agencies as
  one of six equally-weighted audience cards, not a dedicated section making the primary
  commercial audience visible, as Phase 4 requires.
- **Crawler-purpose explanation is shallow** — six purpose names as plain pills, not the
  four-category explainer (search/training/user-triggered retrieval/agent) Phase 4 requires.
- **Pricing preview duplicates data**: `index.astro`'s pricing array is a second, independently
  hand-typed copy of `pricing.astro`'s `plans` array (same values today, but two sources that can
  silently drift) — not the shared source Phase 4 requires.
- **No homepage-specific analytics events** beyond a single `landing_viewed` beacon.

## Existing behaviour that must be preserved

- `AuditForm` (hero and final-CTA instances) — same component, same submission behaviour, same
  SSRF/rate-limit/validation logic in `packages/scanner`/`apps/web/src/pages/api/audit`. Phase 4
  must not touch this backend behaviour.
- `FAQPage` JSON-LD must continue to mirror the visible FAQ exactly (SRS §9.24).
- `AnalyticsBeacon` `landing_viewed` event.
- The synthetic-example labelling convention for the report preview.

## Existing content retained vs. replaced

| Content                                           | Decision                                                                                                                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hero H1                                           | **Retained** — SRS §2.2-aligned, Phase-2-validated; Phase 4 improves supporting copy, CTA hierarchy, and visual only, not the headline itself                                        |
| Hero artwork (`WebsiteAuditMark`)                 | Retained, unchanged                                                                                                                                                                  |
| Trust strip                                       | Retained, folded into hero supporting copy area                                                                                                                                      |
| 6 purpose pills                                   | Replaced by a proper 4-category crawler-purpose explainer section (Section 5)                                                                                                        |
| Inline `ReportPreview`                            | Retained as the homepage-embedded preview (Section 3), now linking to a new full `/sample-report` page                                                                               |
| How it works (4 steps)                            | Retained, lightly reworded to match Section 4's required step framing                                                                                                                |
| Core features (7 cards)                           | Consolidated into the evidence/methodology section and the new agency-workflow section, to avoid duplicate content per SRS-style "don't add sections merely to make the page longer" |
| "Built for real workflows" (6-card audience grid) | Replaced by a dedicated agency/multi-domain section (Section 6) plus a shorter, still-inclusive note for other audiences                                                             |
| Supported signals pill list                       | Retained, reframed as Section 8 with the required optional-signal disclaimer wording                                                                                                 |
| Crawler directory preview                         | Retained (Section 8/9 area)                                                                                                                                                          |
| Monitoring value                                  | Retained as Section 9, reworded around the required two change-source categories                                                                                                     |
| Pricing summary (hardcoded duplicate array)       | Replaced — now imports the same `PLANS` array `pricing.astro` uses, via new `apps/web/src/lib/plans.ts`                                                                              |
| FAQ (10 items)                                    | Retained, content unchanged (already accurate)                                                                                                                                       |
| Final CTA                                         | Retained                                                                                                                                                                             |

## Known homepage risks (pre-existing, not introduced this phase)

- Pricing data duplication (see above) — this phase closes the duplication by extracting a shared
  module, without changing any price, limit, or entitlement.
- No production Lighthouse/performance record existed before this phase for the homepage
  specifically — this phase establishes the first dev-server-relative baseline (see below);
  measuring the real deployed Worker remains future work, consistent with the project's existing
  distinction between lab and field metrics (`scripts/lighthouse-check.mjs`'s own header comment).

## Pre-redesign Lighthouse baseline (production build, static-served, `/`)

An initial dev-server (`astro dev`) capture was attempted but discarded: dev-server Lighthouse
numbers proved highly unstable (LCP swung from ~3.5s to ~13s between runs with no code change)
because Vite serves every file under `@crawlpact/ui`'s barrel import as a separate unbundled
module in dev mode — an artefact of the dev server, not real performance, and pre-existing before
this phase touched anything. The methodology was corrected to measure the actual **production
build**, matching what `scripts/lighthouse-check.mjs` measures against the real deployed Worker.

Captured 2026-08-04: `main` at `abab3d4` (pre-Phase-4) was checked out into a separate `git
worktree`, built with `pnpm build`, and served statically (`npx serve`) on a different port so it
could run side-by-side with the Phase-4 branch's own build — same machine, same method, only the
homepage code differs.

| Metric              | Before (`abab3d4`) | After (this branch) |
| ------------------- | ------------------ | ------------------- |
| Performance         | 99                 | 99                  |
| Accessibility       | 100                | 100                 |
| Best Practices      | 96                 | 96                  |
| SEO                 | 100                | 100                 |
| LCP                 | 2114 ms            | 2113 ms             |
| CLS                 | 0                  | 0                   |
| Total Blocking Time | 24 ms              | 0 ms                |
| Network requests    | 16                 | 14                  |

No material performance change — the redesign is, if anything, marginally lighter (fewer
requests, no measured blocking time) despite adding a new route (`/sample-report`) and several new
homepage sections, because no new client-side hydration was introduced (all new homepage sections
are static Astro components; the only new hydrated component, `AuditReportView`, is scoped to
`/sample-report`, not the homepage itself).

## Phase 4 implementation decisions

- Keep the hero H1 unchanged (see "Existing content retained" above) — changing it would create
  a fresh, avoidable SRS §2.2 deviation of exactly the kind already tracked as RISK-028 for the
  tagline; Phase 4 has no mandate to touch the SRS and this phase's own instruction defers to
  "a newer approved canonical hero" only if Phase 2 established one, which it did not for the
  headline specifically (Phase 2 explicitly reviewed and retained this exact wording).
- Keep the primary CTA button label as "Audit a domain" (not "Audit a domain free") — Phase 2
  deliberately corrected an invented "Audit a domain free" variant back to the real,
  already-consistent product wording (`docs/brand/MESSAGING_SURFACE_INVENTORY.md` row A5); adding
  "free" back in Phase 4 would silently reverse that decision. "Free" is communicated in
  supporting microcopy and the final-CTA section instead, matching the existing pattern.
- Reuse `AuditReportView` (the same component that renders real reports) for the new
  `/sample-report` page, driven by a new typed fixture, rather than building a second
  report-rendering implementation — directly satisfies "avoid duplicating report logic."
- Extract `pricing.astro`'s `plans` array into `apps/web/src/lib/plans.ts` so the homepage pricing
  preview and the pricing page read one array — a within-scope "don't hardcode duplicate pricing"
  fix; the deeper issue (this array should ultimately come from the database, not a source file)
  remains explicitly Phase 6's, unchanged by this phase.
