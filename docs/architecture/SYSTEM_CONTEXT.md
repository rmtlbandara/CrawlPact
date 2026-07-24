# System Context

## External systems CrawlPact talks to

| System                        | Direction              | Purpose                     | Notes                                                         |
| ----------------------------- | ---------------------- | --------------------------- | ------------------------------------------------------------- |
| Cloudflare Workers runtime    | Hosts CrawlPact        | Compute                     | Single Worker, see ADR-0001                                   |
| Cloudflare D1                 | CrawlPact → D1         | Primary datastore           | Binding `DB`, see ADR-0002                                    |
| Cloudflare Cron Triggers      | Cloudflare → CrawlPact | Scheduled monitoring        | `scheduled()` export                                          |
| Public websites being audited | CrawlPact → target     | The product's core function | Only via `packages/scanner`'s safe-fetch chokepoint, ADR-0005 |
| Paddle Billing                | Bidirectional          | Payments, webhooks          | Merchant of record; not implemented in Part 1                 |
| Browser WebAuthn API          | Browser ↔ CrawlPact    | Passkey auth                | Not implemented in Part 1                                     |

## What is explicitly out of scope (SRS §6.2)

CrawlPact does not integrate with: external email/SMS/push providers, external AI APIs,
external authentication providers, external analytics vendors, external PDF/screenshot
services, external job schedulers, or external log-management/uptime services. Any future
integration request against this list requires an ADR explaining why it is an exception, and
explicit approval — it is not a decision an agent should make unilaterally.

## Actors

- **Anonymous visitor** — runs a free audit, browses public content.
- **Free/Solo/Pro/Agency account** — not implemented in Part 1 (auth pending).
- **Super Admin** — platform owner; not implemented in Part 1.
- **Scheduled job (cron)** — invokes `scheduled()`; currently only records a placeholder run.
