# Analytics Data Flow

**Level 2 document.** Phase 13. How data moves through CrawlPact's three analytics categories —
see `docs/analytics/PHASE_13_ANALYTICS_CONSENT_BASELINE.md` for the categories' definitions.

## Category A — Operational telemetry

`security_events`, `scheduled_job_runs`, application logs (Cloudflare Workers Observability).
Written directly by request handlers/cron/webhook code. Never analytics — used to operate
CrawlPact reliably, covered by `docs/operations/`, not this document.

## Category B — First-party product measurement (authoritative)

```
Server-side request handler (page/API route)
   │  (46+ call sites — see docs/analytics/PRODUCT_EVENT_REGISTRY.md)
   ▼
trackEvent(db, eventName, { userId?, properties? })
   │  runtime guard: PROHIBITED_PROPERTY_KEY_PATTERN rejects PII-shaped keys
   ▼
INSERT INTO product_events (event_name, user_id, properties, created_at)
   │
   ├──► Super Admin dashboard (GET /api/admin/analytics, bounded date-range queries)
   │
   └──► Daily retention purge (18 months, apps/web/src/lib/data-retention.ts)
```

Client-side page-view-style events (no natural server-side mutation to hang tracking off) go
through `POST /api/analytics/track`, which validates the event name against `PRODUCT_EVENT_NAMES`
and rejects unknown events before calling the same `trackEvent()` path above.

## Category C — Third-party public marketing analytics (Google Analytics)

```
Visitor on an allowlisted public marketing route, in production
   │
   ▼
Has the visitor granted current-version analytics consent?
   │                                    │
  No                                   Yes
   │                                    │
GA never loads,                    GoogleAnalytics.astro renders (SSR)
no Google request                  or AnalyticsConsent.tsx injects it (client, on Accept)
                                         │
                                         ▼
                                    gtag.js loads → gtag("consent","default",{ad_*: denied,
                                    analytics_storage: granted}) → gtag("config", ..., {
                                    page_location: origin+pathname })
                                         │
                                         ▼
                                    Google's own servers (outside CrawlPact's infrastructure)
```

No data from Category C ever flows back into Category B's `product_events` table, and no data
from Category B is ever sent to Google — the two systems are fully independent, per
`docs/analytics/GOOGLE_ANALYTICS_SCOPE_POLICY.md`'s "Google Analytics is not the product
measurement source of truth" principle.

## Consent state flow

```
crawlpact_analytics_consent cookie (first-party, ~6-month expiry)
   │
   ├─ read server-side: apps/web/src/lib/consent.ts (MarketingLayout.astro SSR gate)
   └─ read/written client-side: apps/web/src/components/AnalyticsConsent.tsx
```

Both read paths share the exact same parsing/versioning logic in `consent.ts` — there is one
source of truth for the cookie format, not two independently-maintained copies that could drift.
