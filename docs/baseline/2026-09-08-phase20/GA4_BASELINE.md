---
Document owner: Engineering owner
Status: current-authoritative
Date: 2026-09-08
---

# GA4 baseline (Phase 20)

Source: direct, read-only Google Analytics Admin API + Data API access
(`https://www.googleapis.com/auth/analytics.readonly`), account `CrawlPact` (`accounts/402672834`),
property `CrawlPact` (`properties/547512440`). All figures read from already-exported local
JSON/CSV files under `~/.config/crawlpact-gsc/output/ga4/`. No credentials read or reproduced.

## Baseline window: 2026-08-09 → 2026-09-05

| Metric                |   Value |
| --------------------- | ------: |
| Active users          |       7 |
| New users             |       4 |
| Sessions              |      40 |
| Engaged sessions      |      26 |
| Engagement rate       |     65% |
| Avg. session duration | ~332.3s |
| Page/screen views     |     151 |
| Event count           |     382 |
| Key events            |       0 |

**This traffic is almost entirely internal, not external product-market signal.** Country
breakdown: 6 of 7 active users and 39 of 40 sessions are from Sri Lanka (the product owner's own
location, consistent with this repository's commit timestamps, all `+0530`); only 1 session is
from the United States. This is consistent with `docs/status/CURRENT_STATE.md`'s existing,
independently-reached finding of "0 external activated accounts... 2 total accounts exist (1 owner
Super Admin...)". **No conclusion about real external audience behavior can be drawn from this
window** — treat every ratio/rate above as a description of the owner's own testing activity, not
of product-market fit.

## Is GA4 correctly receiving production traffic?

**Yes.** `apps/web/src/components/GoogleAnalytics.astro` (reviewed in source) confirms the
architecture this data is consistent with: rendered only when `PUBLIC_APP_ENV === "production"`
_and_ the visitor has granted analytics consent _and_ the current route is on the GA-eligible
allowlist (`apps/web/src/lib/consent.ts`'s `isGaEligibleRoute` — never `/app/*`, `/admin/*`,
billing, private audit/report routes). `page_location` is explicitly overridden to
`origin + pathname`, stripping query strings/hashes/tokens before anything reaches Google. Ad
signals (`ad_storage`, `ad_user_data`, `ad_personalization`) are explicitly denied regardless of
consent — CrawlPact does not do ad personalization. This matches
`docs/analytics/GOOGLE_ANALYTICS_SCOPE_POLICY.md` and
`docs/analytics/CONSENT_AND_ANALYTICS_PREFERENCE_MODEL.md` exactly; nothing here required a code
change.

## Channels / source-medium

| Channel        | Sessions | Engagement rate |
| -------------- | -------: | --------------: |
| Direct         |       22 |             59% |
| Organic Search |       18 |             72% |

Source/medium detail for "Organic Search" splits into two rows: `google / organic` (3 sessions)
and `search.google.com / referral` (15 sessions). **This is not a measurement defect** —
`search.google.com/referral` is GA4's standard behavior for certain Google Search entry paths that
don't carry the exact signal GA4 uses to auto-classify as `google/organic`, and GA4's Default
Channel Group logic already correctly buckets both under "Organic Search" (3 + 15 = 18, matching
the channel table exactly). Noted here only so a future session doesn't mistake the
source/medium-level "referral" label for non-organic traffic.

## Landing pages

`/` (29 sessions, 79% engagement), `(not set)` (6 sessions — GA4's usual label for sessions where
the landing page dimension wasn't captured, typically direct/app-triggered), `/pricing` (4
sessions, 75% engagement), `/crawlers/claude-user/` (1 session). Organic landing traffic _is_
represented (not just the homepage) — consistent with the Search Console query/page data showing
real impressions across crawler and tool pages.

## Events actually firing

`page_view` (151), `user_engagement` (131), `scroll` (55), `session_start` (40), `first_visit` (4),
`click` (1). **These are exclusively GA4's automatically-collected events — zero custom events.**

## Why GA4 shows 0 key events — investigated, not a defect

This is **not** an instrumentation gap. CrawlPact has a complete, separate, first-party product
event system (`apps/web/src/lib/analytics.ts`, `PRODUCT_EVENT_NAMES`) that already covers the
entire desired funnel — `landing_viewed`, `audit_started`, `audit_completed`, `account_started`,
`account_created`, `domain_saved`, `pricing_viewed`, `checkout_started`,
`subscription_activated`, `monitoring_enabled`, and more — written server-side into the
`product_events` D1 table via `POST /api/analytics/track`
(`apps/web/src/lib/analytics-client.ts`). This is a deliberate architecture decision, documented at
the top of `analytics.ts` itself: _"No third-party analytics vendor, no external script, no
pixel"_ for product-behavior tracking — GA4 was added later as an explicit, disclosed SRS §6.2
deviation (`docs/status/KNOWN_RISKS.md`) scoped narrowly to marketing-page traffic/channel
measurement, never intended to be the system of record for the funnel.

**GA4 has 0 key events because no product event has ever been deliberately bridged to it — which
is correct given this architecture, not a bug.** The real funnel is already fully instrumented in
first-party data; what's genuinely missing (already known, already disclosed, not new this phase)
is an aggregated admin-facing view of that first-party data —
`docs/status/CURRENT_STATE.md`'s existing "Known disabled or incomplete capabilities" entry: _"Super
Admin 14-metric usage-analytics dashboard (SRS §28.13): individual events recorded, not yet
aggregated into a distinct admin view."_ This is a Phase 21 backlog item, not a Phase 20 blocker —
no small instrumentation defect prevents a basic baseline (this document _is_ that baseline, for
GA4's actual intended scope).

If the product owner later wants a GA4-side "key event" (e.g. for a future Google Ads conversion
integration), that requires a deliberate decision about which first-party event(s) to also fire
into GA4 and under what consent/privacy terms — a product decision, not a Phase 20 technical fix.

## What was verified, what wasn't

- Verified: GA4 receives real production traffic; consent gating and route allowlisting behave as
  documented; organic landing pages are represented; the underlying funnel is fully instrumented
  (just not in GA4).
- Not attempted: any change to GA4 configuration, consent architecture, or the first-party
  analytics system. No blocking defect was found that would justify touching either.
