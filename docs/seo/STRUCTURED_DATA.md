# Structured Data

Per SRS §9.24, structured data is only added where genuinely valid, and never includes
fabricated reviews or ratings.

| Type             | Where                                           | Status                                                                                                                                                              |
| ---------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Organization`   | `BaseLayout.astro` (every page)                 | ✅ Implemented                                                                                                                                                      |
| `WebSite`        | `BaseLayout.astro` (every page)                 | ✅ Implemented                                                                                                                                                      |
| `WebApplication` | `pricing.astro`                                 | ✅ Implemented (2026-07-30) — `offers` built from the same `plans` array the visible pricing table renders, so it can't drift                                       |
| `FAQPage`        | `index.astro`                                   | ✅ Implemented, generated from the same `faqItems` array the visible accordion renders — cannot drift, since both read the same source array                        |
| `BreadcrumbList` | Subpages with a `breadcrumbs` prop              | ✅ Implemented in `BaseLayout.astro` — was already live in production; this doc's earlier "not yet added" note was stale                                            |
| `Article`        | Crawler/guide detail pages (`ogType="article"`) | ✅ Implemented in `BaseLayout.astro` — likewise already live; the 2026-07-30 audit's initial finding that this was missing was based on a mistaken production check |
| `HowTo`          | Guides with genuine `Step N:` headings          | ✅ Implemented (2026-07-30), via `extraJsonLd` in `guides/[slug].astro` — only emitted when ≥2 real step headings exist, never fabricated for non-step guides       |

## Rule

Any structured data block must be generated from the same data the visible page renders (as
`FAQPage` is, from `faqItems`) — never authored as a separate, hand-maintained copy that can
drift from what a user actually sees.
