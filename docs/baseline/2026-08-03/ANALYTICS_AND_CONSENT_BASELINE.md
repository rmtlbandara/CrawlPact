# Analytics and Consent Baseline — 2026-08-03

Phase 0 baseline. No analytics behavior was changed. Two entirely separate analytics systems
coexist in CrawlPact.

## 1. Google Analytics 4 (`gtag.js`, measurement ID `G-1W5HP7S561`)

- **Component**: `apps/web/src/components/GoogleAnalytics.astro`, loading
  `googletagmanager.com/gtag/js` plus an inline bootstrap.
- **Included from**: `apps/web/src/layouts/MarketingLayout.astro` **only** — confirmed by
  repo-wide search, referenced in exactly two files total (the component and this one layout). No
  reference in `AppLayout.astro` or `AdminLayout.astro`.
- **Environment gate**: `PUBLIC_APP_ENV === "production"` — local/preview traffic never loads it.
- **Pages**: every page using `MarketingLayout` (homepage, pricing, guides, crawler directory,
  tools, legal pages, `/status`, etc.) — never `/app/*` or `/admin/*`.
- **Status of the deviation**: confirmed, disclosed, deliberate — per project memory and
  `docs/status/KNOWN_RISKS.md`, added 2026-07-30 at the product owner's explicit, twice-confirmed
  request, superseding SRS §6.2's external-analytics-vendor prohibition and §28.13's
  first-party-only commitment. **Not to be silently reverted** — this audit records it, does not
  recommend undoing it.

## 2. First-party product analytics (`product_events`)

- **Implementation**: `apps/web/src/lib/analytics.ts` — `trackEvent()` writes one row per call.
  Docstring: "No third-party analytics vendor, no external script, no pixel... `properties` is
  deliberately shallow... never full page HTML, never a session/recovery/API token."
- **Event vocabulary**: `landing_viewed`, `audit_started`, `audit_completed`, `audit_failed`,
  `result_viewed`, `account_started`, `account_created`, `domain_saved`, `pricing_viewed`,
  `checkout_started`, `subscription_activated`, `report_shared`, `notification_opened`,
  `crawler_reference_page_opened`.
- **SRS §28.13 gap, confirmed still open**: SRS §28.13 requires a Super-Admin-visible dashboard of
  14 named usage metrics. The event vocabulary above covers most of them conceptually, but **no
  dedicated admin analytics-dashboard page exists** — confirmed by filesystem search
  (`apps/web/src/pages/admin/*analytic*` → no match). Already honestly disclosed in
  `docs/status/REQUIREMENTS_TRACEABILITY.md` as "Implemented, not Tested" with this exact caveat —
  not a new finding, confirmed still accurate.

## 3. Consent mechanism

**None exists.** A repo-wide case-insensitive search for `consent`/`cookie banner`/
`CookieConsent` returned zero matches anywhere in `apps/web/src`. No cookie-consent banner, no
geolocation-based gating, no opt-out control, no mechanism distinguishing EU/UK visitors before GA
loads. Matches `docs/status/KNOWN_RISKS.md`'s own disclosure exactly — confirmed still true, not
resolved.

## 4. Privacy disclosure

`apps/web/src/pages/privacy.astro`'s third-party section (quoted): infrastructure/billing
providers named, then: _"{analyticsProvider} is used on public marketing pages... to measure
visits; it is not loaded on the authenticated app or admin areas."_ `{analyticsProvider}` resolves
to `"Google Analytics"` (`apps/web/src/lib/trust-config.ts`). Accurate against current code (GA
genuinely is marketing-pages-only) — but does **not** disclose the absence of a consent mechanism,
GA's tracking-cookie behavior, or an opt-out path.

## 5. CSP rules

`apps/web/src/lib/security-headers.ts` and `apps/web/public/_headers` (kept in sync, asserted by a
dedicated test) both allow: `script-src` → `https://www.googletagmanager.com`; `connect-src` →
`https://www.google-analytics.com https://*.google-analytics.com
https://www.googletagmanager.com`. Confirmed live in production response headers this session
(see `PRODUCTION_INFRASTRUCTURE_INVENTORY.md` §7) — matches exactly.

## 6. Authenticated-app/admin scope — confirmed first-party only, but untested

`GoogleAnalytics` is imported nowhere outside `MarketingLayout.astro` (code-confirmed, not just
claimed). **However, no automated test asserts this boundary** — no e2e/a11y/unit test references
`GoogleAnalytics` or `gtag` anywhere under `apps/web/tests`. The guarantee currently rests entirely
on manual code review, not a regression-proof test. Flagged as a gap, routed to Phase 13.

## 7. Data retention for `product_events`

`docs/data/DATA_RETENTION.md`'s own "still open" section names only billing records as lacking a
purge job — it does **not** mention that `product_events` (the table backing this very analytics
system) also has no purge job at all, a fact that is disclosed, but only in
`docs/status/KNOWN_RISKS.md`, not in the dedicated retention document. Logged as DC-009 in
`DOCUMENTATION_CONFLICTS.md`.

## 8. Alignment summary

| Dimension                                             | Aligned?                                                                                                                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current privacy-policy wording                        | Yes — accurately describes what actually loads and where.                                                                                                     |
| Original SRS §6.2/§28.13 first-party-only requirement | No — confirmed, disclosed, deliberate deviation for GA specifically; the first-party system itself remains compliant on its own terms.                        |
| Current production behavior                           | Yes — GA loads only in production, only on marketing pages, exactly as documented.                                                                            |
| Current consent behavior                              | Not aligned with any GDPR/UK-GDPR-style expectation — no consent mechanism exists; disclosed as an open risk, not silently missing.                           |
| Public marketing claims                               | Yes, narrowly — the specific claim made ("not loaded on the authenticated app or admin areas") is true; no broader "no tracking" claim is made or overstated. |

## 9. Verification limitations

- GA4 property-side retention/anonymization settings (external to this repo) — not verified,
  outside repository access.
- Whether any EU/UK consent requirement is actually triggered in practice depends on real visitor
  geography, not derivable from the repository — unknown.
- Whether `security_events`/`notifications` (named alongside `product_events` in the no-purge-job
  risk) show the identical retention-documentation gap was not independently re-verified line by
  line beyond the same grep pattern.
