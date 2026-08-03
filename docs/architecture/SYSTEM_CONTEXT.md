# System Context

**Corrected 2026-08-03 (Phase 1)** — this document previously described Paddle billing and
WebAuthn authentication as "not implemented in Part 1." Both are built; Paddle webhook processing
and passkey authentication are `verified-live` in production per
`docs/baseline/2026-08-03/CAPABILITY_MATRIX.md`. See `docs/status/CURRENT_STATE.md` for current
capability status.

## External systems CrawlPact talks to

| System                        | Direction              | Purpose                                                                                               | Notes                                                                                                                                                   |
| ----------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cloudflare Workers runtime    | Hosts CrawlPact        | Compute                                                                                               | Single Worker, see ADR-0001                                                                                                                             |
| Cloudflare D1                 | CrawlPact → D1         | Primary datastore                                                                                     | Binding `DB`, see ADR-0002                                                                                                                              |
| Cloudflare KV                 | CrawlPact → KV         | `@astrojs/cloudflare`'s mandatory session-KV requirement only (real sessions are D1-backed, ADR-0004) | Binding `SESSION`                                                                                                                                       |
| Cloudflare R2                 | CrawlPact → R2         | Agency-branding logo uploads only (adopted 2026-07-30)                                                | Binding `AGENCY_LOGOS`, see `docs/data/D1_R2_DATA_PLACEMENT_POLICY.md`                                                                                  |
| Cloudflare Cron Triggers      | Cloudflare → CrawlPact | Scheduled monitoring and daily data-retention purge                                                   | `scheduled()` export, daily at 03:00 UTC                                                                                                                |
| Public websites being audited | CrawlPact → target     | The product's core function                                                                           | Only via `packages/scanner`'s safe-fetch chokepoint, ADR-0005                                                                                           |
| Paddle Billing                | Bidirectional          | Payments, webhooks                                                                                    | Merchant of record; webhook processing verified live in production 2026-07-28 (real paid checkout lifecycle not yet run — `docs/risks/ACTIVE_RISKS.md`) |
| Browser WebAuthn API          | Browser ↔ CrawlPact    | Passkey auth                                                                                          | Verified live in production — real register/sign-in round trip confirmed 2026-07-28                                                                     |
| Google Analytics (gtag.js)    | CrawlPact → Google     | Marketing-page visit measurement                                                                      | Public marketing pages only, production-only, a disclosed, deliberate deviation from SRS §6.2 — see `docs/status/REQUIREMENTS_TRACEABILITY.md` §6       |

## What is explicitly out of scope (SRS §6.2)

CrawlPact does not integrate with: external email/SMS/push providers, external AI APIs,
external authentication providers, external PDF/screenshot services, external job schedulers, or
external log-management/uptime services. Any future integration request against this list
requires an ADR explaining why it is an exception, and explicit approval — it is not a decision
an agent should make unilaterally. (Google Analytics is the one already-approved, disclosed
exception to the "external analytics vendors" item — see table above.)

## Actors

- **Anonymous visitor** — runs a free audit, browses public content.
- **Free/Solo/Pro/Agency account** — authenticated via passkey/WebAuthn; live in production.
- **Super Admin** — platform owner; full Control Center built (dashboard, user/subscription/
  domain/scan/registry/security administration, audit logging).
- **Scheduled job (cron)** — invokes `scheduled()`; runs the real monitoring sweep and daily
  retention purge when `AUDIT_ENGINE_ENABLED=true` and not paused.
