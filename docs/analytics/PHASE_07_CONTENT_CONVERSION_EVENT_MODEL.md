# Phase 7 analytics event model: vertical landing pages and platform guides

The 9 `PRODUCT_EVENT_NAMES` entries (`apps/web/src/lib/analytics.ts`, lines 68–76) added for the
`/for/*` and `/platforms/*` surface. Same first-party-only model as every other product event in
this codebase (SRS §33): no third-party analytics, `isProductEventName()` enforces the closed
union server-side, and **no domain, email, or user id is ever sent as an event property** — every
property below is a closed-set content identifier (a vertical/platform slug), never free text.

## Events

| #   | Event                              | Fired from                                                                                  | Properties                                                           | Fires when                                                                         |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | `vertical_page_viewed`             | `AnalyticsBeacon` on `/for/[slug].astro` (`client:load`)                                    | `{ vertical: entry.id }`                                             | A vertical landing page (e.g. `/for/agencies`) renders successfully                |
| 2   | `vertical_audit_cta_clicked`       | Click-delegation `<script>` on `/for/[slug].astro`                                          | — (`eventName` only)                                                 | The "Audit a domain" CTA is clicked                                                |
| 3   | `vertical_sample_report_clicked`   | Same                                                                                        | —                                                                    | The "View a sample report" CTA is clicked                                          |
| 4   | `vertical_pricing_clicked`         | Same                                                                                        | —                                                                    | The "Review `<plan>` pricing" link (in the live-pricing guidance block) is clicked |
| 5   | `platform_guide_viewed`            | `AnalyticsBeacon` on `/platforms/[slug].astro` and `/platforms/index.astro` (`client:load`) | `{ platform: platform.id }` (guide) or `{ platform: "hub" }` (index) | A platform guide or the platform hub renders successfully                          |
| 6   | `platform_audit_cta_clicked`       | Click-delegation `<script>` on `/platforms/[slug].astro`                                    | —                                                                    | The "Audit your deployed policy" CTA is clicked                                    |
| 7   | `platform_official_source_clicked` | Same                                                                                        | —                                                                    | A link in the "Official references" block is clicked                               |
| 8   | `platform_related_guide_clicked`   | Same                                                                                        | —                                                                    | A link in the "Related tools and crawler pages" block is clicked                   |
| 9   | `content_correction_clicked`       | Same                                                                                        | —                                                                    | The "Report an inaccuracy" `mailto:` link is clicked                               |

All 9 events are client-side beacons — no server-recorded Phase 7 event exists, because no Phase 7
route performs a mutation. Events 1 and 5 use `AnalyticsBeacon` (`client:load`, fires once via
`useEffect`, matching the Phase 4/6 page-view pattern). Events 2–4 and 6–9 share one
`document.addEventListener("click", ...)` delegation script per page (unhydrated, matching
`index.astro`'s existing pattern) that reads `data-analytics-event` off the clicked element's
closest matching ancestor and POSTs `{ eventName }` to `POST /api/analytics/track` with
`keepalive: true`, swallowing all errors — analytics must never surface a failure to the visitor or
block navigation.

## Why click events carry no properties

Unlike Phase 5/6's click events (which carry a `variant`/`planId`/`interval` the click's meaning
depends on), every Phase 7 click event's meaning is already fully determined by the event name
itself — `vertical_pricing_clicked` on `/for/agencies` is unambiguous without also sending which
plan, because that page's `recommendedPlan` is fixed content, not a runtime choice. Adding a
`vertical`/`platform` property to every click event was considered and rejected: it would
duplicate what the corresponding page-view event (1 or 5) already recorded once per session,
for no analytical benefit, at the cost of a slightly larger request body on every click.

## Consistency check

There is no dedicated `analytics.ts` unit-test file in this codebase — `isProductEventName()`'s
closed-union enforcement is exercised indirectly, at the HTTP boundary, by
`POST /api/analytics/track` itself. Verified directly against a live local dev server: all 9 event
names above return `HTTP 200 {"ok":true,"data":{"tracked":true}}`, and an unrecognised name
(`bogus_event_name_xyz`) returns `HTTP 400 {"code":"VALIDATION_FAILED","message":"Unrecognised
event."}` — confirming `isProductEventName()` accepts exactly the 9 new names and nothing else.
See the Phase 7 completion report's evidence section for the exact commands and output.
