# Google Analytics Scope Policy

**Level 2 document.** Phase 13. Defines exactly where Google Analytics may load, what it may
receive, and what it may never receive. Google Analytics is **not** the product-measurement source
of truth — see `docs/analytics/CRAWLPACT_PRODUCT_MEASUREMENT_STRATEGY.md`. It measures consented
public marketing-page acquisition only.

## Measurement ID

`G-1W5HP7S561` (unchanged from the prior implementation — this phase did not rotate it).

## Loading conditions (all must be true)

1. `PUBLIC_APP_ENV === "production"` — never local, never preview (`docs/analytics/PHASE_13_ANALYTICS_CONSENT_BASELINE.md`).
2. The visitor has an analytics-consent cookie (`crawlpact_analytics_consent`) with value
   `granted` **at the current `ANALYTICS_CONSENT_VERSION`** (`apps/web/src/lib/consent.ts`). A
   missing, denied, or stale-version cookie means GA does not load.
3. The current route is on the allowlist below (`isGaEligibleRoute`).

All three conditions are enforced server-side (`MarketingLayout.astro`, SSR) for a returning
consented visitor, and client-side (`AnalyticsConsent.tsx`) for the same-session accept case —
both read from the exact same `apps/web/src/lib/consent.ts` module, so there is one source of
truth, not two independently-maintained copies.

## Route allowlist

```
/
/pricing
/about
/methodology
/limitations
/scoring
/changelog
/scanner
/sample-report
/audit                (the form only — see denylist below)
/for/*
/platforms/*
/crawlers/*
/guides/*
/tools/*
```

## Route denylist (GA must never load here, consent notwithstanding)

```
/app/*                        — authenticated product
/admin/*                      — Super Admin
/api/*                        — never renders MarketingLayout at all
/sign-in                      — authentication
/auth/*                       — authentication
/pay                          — billing/checkout
/shared/[token]               — private shared reports
/audit/[auditId]              — a specific audit result (a private-ish identifier in the URL)
/privacy /terms /security /contact /status /acceptable-use /404
                               — legal/infra pages; marketing measurement adds no product value
```

The last group also matches the prompt's own recommendation ("marketing measurement adds little
value there"). This denylist is enforced via `isGaEligibleRoute`'s explicit allowlist design —
anything not explicitly listed is excluded by default, not the other way around.

## Query-string and identifier privacy

`GoogleAnalytics.astro` overrides GA4's `page_location` config parameter to
`window.location.origin + window.location.pathname` — never the unfiltered `location.href`. This
means query strings, hashes, and any continuation/report/audit token that might otherwise appear
in a URL are never sent to Google, regardless of which allowlisted route the visitor is on.

## What is never sent

- Google Analytics User-ID
- Email, account identifier, Paddle customer/subscription identifier
- Domain ID, saved-domain name, report ID, feed token
- Hashed email, user-provided data, enhanced conversions (`gtag("consent", ...)` explicitly
  defaults `ad_storage`/`ad_user_data`/`ad_personalization` to `denied` even after analytics
  consent is granted — see `GoogleAnalytics.astro`)

## Property review (property-level, where accessible)

This phase did not have interactive access to the live GA4 property admin UI (no browser session
against analytics.google.com). The following settings could not be directly re-verified this phase
and are carried forward from the SRS §6.2 deviation record
(`docs/status/KNOWN_RISKS.md`) rather than re-confirmed:

- Data retention, Google Signals, advertising features, Ads linking, user-provided-data collection,
  data-sharing options, enhanced measurement, internal traffic rules, unwanted referrals.

**Recommended posture** (unchanged from this phase's own guidance, to be applied by the product
owner directly in the GA4 admin UI): retention at the minimum useful duration (GA4's supported
14-month maximum, not longer); Google Signals disabled; user-provided data disabled; advertising
personalisation disabled; no Google Ads link added; most restrictive data-sharing settings
compatible with basic acquisition measurement. See
`docs/analytics/PHASE_13_GA_PROPERTY_CONFIGURATION_AUDIT.md` for what this phase could and could
not verify.

## Scope: what GA measures

Recommended and implemented scope: page views, acquisition source, landing page, public-content
category. CrawlPact does not send the 106-event first-party taxonomy (see
`docs/analytics/PRODUCT_EVENT_REGISTRY.md`) to GA — first-party `product_events` already covers
that, is the authoritative source, and never leaves CrawlPact's own infrastructure.
