# Product Scope

**Level 2 document (Requirements and product intent).** Quick-reference summary of
`docs/product/CRAWLPACT_FINAL_SRS.md` §5 plus the product's actual current scope boundary. The
SRS is authoritative for requirements; `docs/status/CURRENT_STATE.md` is authoritative for what is
currently live. This page exists so scope questions can be answered without opening either in
full.

**Corrected 2026-08-03 (Phase 1)**: this document previously described the product as still in
"Part 1" (engineering foundation and public website shell only, with the scanner, authentication,
monitoring, billing, and Super Admin all "not implemented"). That was true once, but is now
several development phases stale — Phase 0's baseline audit (2026-08-03) confirmed all five of
those capabilities are built and, in most cases, live in production. See `docs/status/CURRENT_STATE.md`
for exact capability statuses and evidence.

## CrawlPact is

A vendor-neutral public-website AI-crawler-policy auditor, monitor, `robots.txt` evaluator,
policy-conflict detector, crawler-purpose knowledge base, report generator, multi-domain
portfolio tool, technical recommendation system, and change-governance platform.

## CrawlPact is not

A WAF, reverse proxy, live crawler blocker, server-log analytics service, full-site SEO
crawler, AI-search ranking tracker, brand-mention tracker, legal service,
copyright-enforcement service, compliance certificate, or a guarantee of any kind about
external crawler behaviour or AI visibility outcomes.

## Prohibited claims (never ship copy that says this)

"Stop all AI scraping", "Guarantee protection from AI", "Make AI crawlers obey", "Ensure
ChatGPT ranking", "Legally protect your website content", "Complete AI compliance", "Block
every AI bot", "Guarantee AI visibility."

## Approved claims

"Audit your declared AI crawler policy", "See how documented crawlers are addressed", "Detect
crawler-policy conflicts", "Monitor crawler-policy changes", "Generate evidence-based
recommendations", "Compare search and training crawler access", "Manage crawler policies across
multiple websites."

## Currently supported scope

Capabilities verified in the current product (see `docs/status/CURRENT_STATE.md` for exact
status/evidence per item — statuses below are Phase 0/Phase 1 capability statuses, not SRS
requirement statuses):

- Anonymous audits and public audit results (`verified-live` — real scans, not a placeholder)
- Authentication and account creation (passkey/WebAuthn-only) (`verified-live`)
- Saved domains, groups, batch import, CSV export (`code-present-not-production-verified`)
- Scheduled monitoring and manual re-scans (`code-present-not-production-verified`; a quantified
  Workers-Free CPU-budget risk applies at scale — see `docs/risks/ACTIVE_RISKS.md`)
- Notifications and a private Atom feed per user (`code-present-not-production-verified`)
- Billing and subscriptions via Paddle, annual-only, three paid tiers (`verified-live` for
  webhook processing; real **paid** checkout lifecycle not yet run)
- Agency features: client groups, batch import, branded client-safe shares (`code-present-not-production-verified`)
- Crawler registry: 23 crawlers across 9 operators, versioned releases, admin governance UI
  (`code-present-not-production-verified`; registry seeding was confirmed live-verified in
  production 2026-07-28)
- Public status page and incident tracking (`verified-live` for the status page's live reads)
- Super Admin Control Center: dashboard, user/subscription/domain/scan/registry/security
  administration, audit logging (`code-present-not-production-verified`)
- First-party product analytics (`code-present-not-production-verified`), plus Google Analytics
  on public marketing pages only (`verified-live` — see "Known deviations" below)
- Security/trust pages, legal pages, SEO content (22 crawler pages, 20 guides, 5 free tools)
  (`code-present-not-production-verified` to `verified-live` depending on route — see
  `docs/baseline/2026-08-03/ROUTE_INVENTORY.md`)

## Current product boundaries

What CrawlPact intentionally does not do:

- No network enforcement — it audits declared policy signals, it does not block, throttle, or
  otherwise act on real crawler traffic.
- No guaranteed crawler compliance — a policy signal being correctly declared does not prove any
  specific crawler obeys it.
- No proof of real crawler access — without server/CDN traffic logs (which CrawlPact does not
  ingest), the product cannot confirm a crawler actually requested a resource, only what the
  site's own declared signals say should happen.
- No legal certification of any kind.
- No broad, general-purpose SEO crawling — CrawlPact evaluates a bounded set of policy-relevant
  resources per scan (robots.txt, sitemap, a bounded HTML/HTTP sample, llms.txt, RSL, Content
  Signals), not a full site crawl.
- No traffic-log analytics — unless a future phase explicitly adds this, with its own approval
  and SRS update.
- Optional signals (llms.txt, RSL, Content Signals) are treated according to their own maturity
  and evidence — CrawlPact does not claim universal adoption or enforcement of any of them.

## Approved near-term scope

Planned work already included in `docs/roadmap/CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md`
(Phases 2–19): brand positioning, legal/trust foundation, homepage/conversion redesign, pricing
and checkout continuity, vertical SEO landing pages, saved-domain UX, agency workspace,
notification reliability, database/performance hardening, security/CI hardening, analytics/consent
strategy, operational reliability, registry governance, research authority content, customer
pilot validation, and launch readiness.

## Future or conditional scope

Features requiring validation or future approval before being treated as in-scope:

- A dedicated Super Admin analytics dashboard surfacing the SRS §28.13 14-metric list (currently
  only individual events are recorded, not aggregated into a distinct view — see
  `docs/status/REQUIREMENTS_TRACEABILITY.md` §28.13).
- Any real traffic-log ingestion or analysis capability.
- A cookie-consent mechanism for the Google Analytics deviation (see "Known deviations" below).
- Enterprise functionality not yet approved (SSO, custom SLAs, dedicated infrastructure).

## Explicitly out-of-scope areas

- Network enforcement (WAF/reverse-proxy/live-blocking functionality)
- Traffic-log analytics
- AI-content licensing marketplace
- General SEO platform features beyond what supports CrawlPact's own crawler-policy audit product
- Legal compliance certification
- Unsupported third-party communication channels (no email/SMS/push notification provider)
- Enterprise functionality not yet approved

## Known deviations from strict scope

- **Google Analytics on public marketing pages only** (not authenticated app/admin, not
  local/preview) — a real, disclosed, deliberate 2026-07-30 product-owner decision that deviates
  from SRS §6.2's external-analytics-vendor prohibition. See
  `docs/status/REQUIREMENTS_TRACEABILITY.md` §6 and `docs/risks/ACTIVE_RISKS.md`. Not a bug, not
  silently reverted by a future phase without a fresh product-owner decision.
- **Legal entity/registered address/jurisdiction/contact disclosure** is not yet published.
  Not an SRS requirement (no SRS text mandates it), but a real, explicitly product-owner-deferred
  gap — see `docs/risks/ACTIVE_RISKS.md`.

## Related documents

- `docs/status/CURRENT_STATE.md` — current, evidence-linked capability status
- `docs/status/REQUIREMENTS_TRACEABILITY.md` — SRS requirement-level status
- `docs/product/CRAWLPACT_FINAL_SRS.md` — full requirements specification
- `docs/roadmap/CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md` — phase roadmap
