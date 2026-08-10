# Phase 13 GA Property Configuration Audit

**Level 4 document.** This session had no interactive browser access to the live Google Analytics
4 property admin UI (analytics.google.com) — that surface requires an authenticated human browser
session, not something reachable via this repository's tooling (no Google Analytics Admin API
credential is configured for this project). This audit is therefore honestly incomplete, not
guessed.

## What could be verified (from code/config)

- **Measurement ID**: `G-1W5HP7S561` (`apps/web/src/components/GoogleAnalytics.astro`) — unchanged
  from before Phase 13.
- **No User-ID, no enhanced conversions, no user-provided-data collection is configured in code**
  — confirmed by reading `GoogleAnalytics.astro`'s and `AnalyticsConsent.tsx`'s `gtag()` calls in
  full: only `gtag("consent", ...)`, `gtag("js", ...)`, and `gtag("config", "G-1W5HP7S561",
{ page_location })` are ever called. No `user_id`, `user_properties`, or enhanced-conversion
  parameter appears anywhere in this codebase.
- **Advertising signals explicitly denied** at the code level (`ad_storage`, `ad_user_data`,
  `ad_personalization` all `"denied"` in every `gtag("consent", "default", ...)` call) — this is a
  client-side signal Google's tag respects, not a property-level admin setting, but it's the
  strongest guarantee available without live property access.

## What could not be verified this phase (property-level admin settings)

- Data retention setting (recommend: GA4's supported 14-month maximum, not longer)
- Google Signals (recommend: disabled)
- Advertising features / Ads linking (recommend: disabled / not added)
- User-provided-data collection toggle (recommend: disabled, consistent with the code-level
  finding above)
- Data-sharing options (recommend: most restrictive compatible with basic acquisition measurement)
- Enhanced measurement toggle
- Internal traffic rules / unwanted referrals

## Recommended owner action

The product owner (who has interactive access to the GA4 admin UI) should manually verify and, if
needed, correct each unverified setting above against
`docs/analytics/GOOGLE_ANALYTICS_SCOPE_POLICY.md`'s "Recommended posture" section, then record the
actual confirmed values in this document. Until that happens, this document discloses the gap
honestly rather than presenting an assumed-correct configuration as verified.
