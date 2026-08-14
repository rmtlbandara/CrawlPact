# Brand Asset Usage Inventory

**Level 4 document.** Complete inventory of where the CrawlPact brand mark appears, produced
during the Phase 0–18 final reconfirmation pass (2026-08-14) as part of a full brand/logo
consistency audit. Canonical current assets live under `apps/web/public/branding/`:
`crawlpact-icon.webp` (shield/checkmark icon), `crawlpact-main-horizontal.webp` (wordmark +
icon), `crawlpact-monochrome-dark.webp` (single-color variant).

| Surface                                               | Asset / component                                                                                                                                                                                                                                    | Purpose                           | Print? | Public?                  |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------ | ------------------------ |
| Public header                                         | `BrandMark.astro` → `crawlpact-icon.webp`, via `SiteHeader.astro`                                                                                                                                                                                    | Site-wide marketing nav logo      | No     | Yes                      |
| Footer                                                | `BrandMark.astro` → `crawlpact-icon.webp`, via `SiteFooter.astro`                                                                                                                                                                                    | Site-wide marketing footer logo   | No     | Yes                      |
| App navigation                                        | `BrandMark.astro` → `crawlpact-icon.webp`, via `AppNav.astro`                                                                                                                                                                                        | Authenticated app nav             | No     | No (auth-gated)          |
| Admin navigation                                      | `BrandMark.astro` → `crawlpact-icon.webp`, via `AdminNav.astro`                                                                                                                                                                                      | Super Admin Control Center nav    | No     | No (auth-gated)          |
| Favicon                                               | `apps/web/public/favicon.png` (single PNG, referenced in `BaseLayout.astro`)                                                                                                                                                                         | Browser tab icon                  | N/A    | Yes                      |
| OG/social image                                       | `scripts/og-image-sources/*.svg` (embeds `crawlpact-icon.webp` as an inlined base64 raster, rasterized to `apps/web/public/og/*.png` by `scripts/generate-og-images.mjs`)                                                                            | Social share previews             | N/A    | Yes                      |
| Homepage                                              | `SiteHeader`/`SiteFooter` (above) — no separate homepage-only brand mark                                                                                                                                                                             | Marketing landing                 | No     | Yes                      |
| Audit report (`/audit/[auditId]`)                     | `BrandMark.tsx` → `crawlpact-icon.webp`, via shared `AuditReportView.tsx`                                                                                                                                                                            | Real authenticated report header  | Yes    | No (auth-gated)          |
| Sample report (`/sample-report`)                      | Same — `AuditReportView.tsx`                                                                                                                                                                                                                         | Public synthetic-data demo report | Yes    | Yes                      |
| Shared report (`/shared/[token]`)                     | Same — `AuditReportView.tsx`                                                                                                                                                                                                                         | Token-authenticated shared report | Yes    | Token-private, `noindex` |
| Print report                                          | Same header, browser print of the report page                                                                                                                                                                                                        | Print/PDF output                  | Yes    | N/A                      |
| Agency-branded report                                 | `AuditReportView.tsx`'s CrawlPact mark (unchanged) + separately rendered agency logo/intro from `agencyBranding` prop — the two are visually and structurally distinct, agency branding never replaces the CrawlPact mark or methodology attribution | Agency white-label context        | Yes    | Token-private, `noindex` |
| Status page (`/status`)                               | `SiteHeader`/`SiteFooter` via `MarketingLayout.astro`                                                                                                                                                                                                | Public status page                | No     | Yes                      |
| Observatory (`/observatory`, `/observatory/registry`) | `SiteHeader`/`SiteFooter` via `MarketingLayout.astro`                                                                                                                                                                                                | Public research/registry pages    | No     | Yes                      |

## Architecture

Two thin wrapper components share one canonical asset, rather than duplicating SVG geometry:

- `apps/web/src/components/BrandMark.astro` — for Astro pages/layouts (header, footer, app nav,
  admin nav).
- `apps/web/src/components/BrandMark.tsx` — for React components (`AuditReportView.tsx` and any
  future React-rendered surface), added this pass specifically because Astro components cannot be
  imported into React (`.tsx`) files.

Both render the same `<img src="/branding/crawlpact-icon.webp" alt="" aria-hidden="true" />`
pattern — decorative, no redundant screen-reader text, since the CrawlPact name is always present
as visible adjacent text wherever the mark appears.

## Historical defect (fixed this pass)

`AuditReportView.tsx` previously inlined a historical "C-bracket" SVG mark (`M21 9h-8...`,
`M12 16h11...`, a `23.2/14.4` accent dot) predating the current shield/checkmark rebrand, instead
of using a shared brand component. This was the only occurrence found anywhere in runtime source
— confirmed via a full-repository search for the three geometry fingerprints, and now enforced by
`pnpm brand:validate`'s `OLD_LOGO_GEOMETRY_PATTERNS` check plus
`apps/web/src/components/audit-report-view-brand.test.ts`.
