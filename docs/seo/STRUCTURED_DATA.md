# Structured Data

Per SRS §9.24, structured data is only added where genuinely valid, and never includes
fabricated reviews or ratings.

| Type                  | Where                           | Status                                                                                                                                              |
| --------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Organization`        | `BaseLayout.astro` (every page) | ✅ Implemented                                                                                                                                      |
| `WebSite`             | `BaseLayout.astro` (every page) | ✅ Implemented                                                                                                                                      |
| `SoftwareApplication` | —                               | ⏳ Not yet added — deferred until pricing/plan data is served dynamically rather than hard-coded, so the markup doesn't drift from the visible page |
| `FAQPage`             | `index.astro`                   | ✅ Implemented, generated from the same `faqItems` array the visible accordion renders — cannot drift, since both read the same source array        |
| `BreadcrumbList`      | Subpages (crawler/guide detail) | ⏳ Not yet added                                                                                                                                    |

## Rule

Any structured data block must be generated from the same data the visible page renders (as
`FAQPage` is, from `faqItems`) — never authored as a separate, hand-maintained copy that can
drift from what a user actually sees.
