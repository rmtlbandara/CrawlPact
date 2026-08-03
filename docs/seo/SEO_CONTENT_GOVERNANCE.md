# SEO Content Governance

## Content minimum (SRS §30.4) — status

| Requirement                | Minimum |                                                                                                                                                                         Current (Part 3) |
| -------------------------- | ------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| Crawler-reference pages    |      20 | 22 ✅ (23 registry entries as of 2026-07-30 — corrected from a prior stale "21" count, Phase 1 2026-08-03; one deliberate exception — see `docs/registry/SOURCE_VERIFICATION_POLICY.md`) |
| Decision/comparison guides |      10 |                                                                                                                                                                                    10 ✅ |
| Implementation guides      |       5 |                                                                                                                                                                                     5 ✅ |
| Troubleshooting guides     |       5 |                                                                                                                                                                                     5 ✅ |
| Free validator pages       |       4 |                                                                                                                                              5 ✅ (all real, genuinely scoped — Step 14) |
| Methodology page           |       1 |                                                                                                                                                                                     1 ✅ |
| Scoring page               |       1 |                                                                                                                                                                                     1 ✅ |
| Registry changelog         |       1 |                                                                                                                                       1 ✅ (`/changelog`, live from `registry_versions`) |

Met as of Part 3 Steps 13–16. Every crawler and guide page cites a real, checkable source or
technical fact — nothing here was generated to hit the count; see "Rules for adding content"
below and `docs/status/KNOWN_RISKS.md`'s "Explicitly rejected shortcuts" section for how the
count was actually reached.

## Rules for adding content

- Crawler pages (`apps/web/src/content/crawlers/*.md`) must cite a real official source URL and
  match the registry data (`packages/database/seed/seed.sql`) — never invent a crawler.
- Guides (`apps/web/src/content/guides/*.md`) must describe a real, checkable technical fact
  (e.g. RFC 9309 behaviour, a documented crawler pairing) — no generic filler content.
- No thin programmatic pages: every page must have genuinely distinct content, not a template
  with one variable swapped (SRS §30.3).
- Private/arbitrary pages (`/audit/[auditId]`, `/shared/[token]`, `/app`, `/sign-in`, `/admin`,
  `/dev/*`) are `noindex` (meta tag and, since Part 3 Step 16, `X-Robots-Tag` header) and
  excluded from the sitemap — see `docs/seo/ROUTE_REGISTRY.md`.

## Metadata

Every page sets a unique title/description via `BaseLayout`'s `title`/`description` props — there
is no shared default that multiple pages accidentally reuse. `apps/web/tests/e2e/seo-metadata.spec.ts`
(Part 3 Step 16) automatically checks every page listed in the live `/sitemap.xml` for a unique
title, a unique description, a matching canonical tag, exactly one `<h1>`, and required Open
Graph tags — so this isn't just a stated rule, it's enforced on every e2e run.
