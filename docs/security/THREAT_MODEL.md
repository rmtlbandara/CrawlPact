# Threat Model

Scope: CrawlPact's complete customer-facing SaaS as implemented through Part 2 (public site +
same-origin API + live scanner + policy engine + passkey auth + accounts/saved domains +
scheduled monitoring + notifications + Paddle billing, on one Cloudflare Worker + D1). Updated
as later parts add Super Admin (Part 3) and agency features.

## Assets

- Customer account/session data (passkey credentials, recovery-code hashes, DB-backed sessions)
- Saved domain lists and scan evidence, including historical scan interpretations
- Billing identifiers and subscription state (Paddle customer/subscription IDs; no card data is
  ever handled by CrawlPact — Paddle is merchant of record)
- Private notification feed tokens and shared-report tokens
- The crawler registry (integrity matters: a bad entry could mislead every customer's report)
- Uploaded agency-branding logo images (R2, `AGENCY_LOGOS` bucket) — publicly served by design
  (shared reports have no login), so confidentiality isn't the concern; integrity (never letting
  an upload become a script-execution vector) is
- CrawlPact's own infrastructure (D1, Worker) and its ability to serve the public site

## Actors and motivations

| Actor                            | Motivation                                                                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Opportunistic scanner abuser     | Use CrawlPact's scanner as a free SSRF/proxy tool against third-party or internal targets                                          |
| Competitor / researcher          | Scrape the crawler registry or pricing at high volume                                                                              |
| Credential attacker              | Attempt to brute-force recovery codes, forge a cross-site request against a signed-in victim, or replay a session                  |
| Billing fraudster                | Replay, forge, or reorder a Paddle webhook to grant free/extended entitlements                                                     |
| Malicious scanned target         | Return content designed to exploit the scanner or the report renderer (HTML/script injection, oversized responses, redirect loops) |
| Curious/malicious other customer | Attempt to read or modify another customer's domains, sessions, notifications, or shared reports by guessing/forging IDs           |

## Key mitigations (by area)

- **SSRF / malicious target** — single safe-fetch chokepoint, IP-range classification, redirect
  revalidation, size/time/request limits, admin target blocklist enforced on every scan path
  (anonymous, manual, scheduled) — see `docs/security/SSRF_SECURITY_MODEL.md`.
- **Session/auth abuse** — passkey-only auth (no password/email path exists to attack), DB-backed
  revocable sessions, `HttpOnly`/`Secure`/`SameSite=Lax` cookies, step-up (recent-auth) required
  for sensitive actions, hashed one-time recovery codes with a per-IP rate limit.
- **CSRF** — `SameSite=Lax` session cookies plus an independent Origin/Referer check on every
  authenticated mutating request (`lib/auth/require-session.ts`'s `assertSameOrigin`); read-only
  requests are exempt since a forged GET can't mutate state.
- **XSS / content injection** — a real `Content-Security-Policy` on every response
  (`src/middleware.ts`), plus target-controlled text (robots.txt bodies, header values) always
  rendered as text, never HTML, by React's default escaping — no `dangerouslySetInnerHTML`/
  `set:html` is used anywhere with scan-derived or user-controlled content. CSV exports
  neutralise formula-injection payloads (`lib/csv.ts`).
- **Billing fraud** — Paddle webhook signature verification (raw-body HMAC, replay-window
  timestamp check), event-ID idempotency, out-of-order-event protection by `occurred_at`,
  server-to-server-only entitlement writes — see `docs/security/BILLING_SECURITY.md`.
- **Cross-customer data access** — every domain/group/session/passkey/notification/share query is
  scoped by owner ID in the `WHERE` clause itself, never checked after the fact in application
  code; covered by dedicated ownership-isolation integration tests per resource type.
- **Abuse / volumetric** — anonymous audits are capped per IP per day
  (`runtime_configuration.anonymous_audit_daily_limit`), recovery-code and account-scan-related
  attempts are rate-limited per IP, all logged to `security_events`.
- **File upload (agency-branding logo, added 2026-07-30)** — the only user-uploaded binary
  content in this codebase (`POST /api/agency-branding/logo`). Real content is sniffed from the
  file's own magic bytes (`lib/agency-logo.ts`'s `detectImageType`), never trusted from a
  client-supplied `Content-Type` header or filename; SVG is rejected outright (it can carry
  inline `<script>`/event-handler payloads — the same class of risk ADR-0005's SSRF chokepoint
  discipline exists to prevent elsewhere). The object key is always server-generated
  (`{userId}/{uuid}.{ext}`), never client-supplied, so there's no path-traversal or key-collision
  surface. Size capped at 1 MiB, gated behind the same `agencyBrandingEnabled` plan check the
  share route uses, and rate-limited per IP. The serving route
  (`GET /api/agency-branding/logo/[userId]/[filename]`) is deliberately public/unauthenticated
  (shared reports are viewed by third parties with no account) but safe to be so: the bucket
  holds nothing but what the upload route ever wrote, so an arbitrary-key read can only ever
  return a legitimately uploaded logo, never other CrawlPact data. See
  `docs/data/D1_R2_DATA_PLACEMENT_POLICY.md`'s 2026-07-30 entry.
- **Registry integrity** — publication requires a reliable source, verified token, purpose
  classification, and administrator approval (FR-REG-005); releases are immutable.
- **Data minimisation / retention** — a daily job purges anonymous scans after 7 days, owned scan
  history past the owner's plan retention window (keeping the domain's current baseline
  regardless of age), and accounts past the cancellable 30-day deletion grace period, cascading
  through every owned row — see `docs/data/DATA_RETENTION.md`.

## Residual risks accepted (Part 2)

- **DNS rebinding against the scanner's own resolution check** — see ADR-0005's full
  treatment. Not fully closable with Cloudflare Workers' current fetch API; bounded by the
  isolate network model and by CrawlPact's other per-scan limits, not eliminated.
- **Cloudflare platform egress behaviour is not independently verifiable by CrawlPact** — the
  claim that Workers cannot reach arbitrary third-party private networks rests on Cloudflare's
  own infrastructure, which this project cannot test or audit directly.
- **Abuse of the free anonymous audit as a request-generation tool against a single target** —
  mitigated by per-scan request caps, a target blocklist, and a per-IP daily audit limit, but a
  distributed set of anonymous callers (many different IPs) could still direct many small, safe,
  in-bounds scans at one target; there is no cross-request _target_-frequency monitoring yet
  (only per-_caller_ limits) — tracked for Super Admin tooling (Part 3) to add.
- **DNS-over-HTTPS resolver dependency** — target hostname resolution during a scan depends on
  a third-party DNS resolver being reachable and honest. This is standard internet
  infrastructure, not a "service" in the SRS §6.2 sense, but a resolver outage or resolver-level
  manipulation is a real, if narrow, dependency worth naming.
- **CSP allows `'unsafe-inline'` for scripts and styles** — Astro's island-hydration bootstrap
  and Tailwind's runtime both emit inline `<script>`/style content with no nonce plumbing wired
  up in this phase, so the CSP can't drop `'unsafe-inline'` without breaking the site. It still
  blocks loading script/style/frame content from any origin other than this site and Paddle's
  checkout — real, but partial, XSS mitigation. Wiring per-request nonces through Astro's
  rendering pipeline is tracked as follow-up work, not done in Part 2.
- **CSRF defence is Origin/Referer-based, not a cryptographic per-form token** — this matches
  common modern practice (combined with `SameSite=Lax`) and is verified by dedicated tests, but
  it is weaker than a server-issued, single-use CSRF token in the specific edge case of a browser
  or proxy that strips both `Origin` and `Referer` from a same-site request — such a request is
  currently rejected outright (fails closed), which is safe but could reject a legitimate
  privacy-hardened client. No such client is known to affect this product today.
- **Paddle API field-shape fidelity is unverified** — the webhook/portal-session payload shapes
  in `lib/billing/` follow Paddle Billing v2's public docs as best understood; no real Paddle
  sandbox account was available to confirm exact field names against a live account (see the
  Part 2 final report). The signature verification, idempotency, and state-machine logic are
  proven correct against self-generated fixtures of the assumed shape — the assumption itself is
  the residual risk.
- **No cross-request target-frequency admin alerting yet** — `blocked_targets` is enforced, but
  there is no automated signal that flags "many different callers are all scanning the same
  target" for a human to review; only the per-IP rate limit and per-scan safety checks apply
  today. This is Super Admin/Part 3 scope.

## Residual risk accepted for Part 1 (historical)

No live scanner existed in Part 1, so most of the mitigations above were architected (ADR,
schema, interfaces) but not exercised end-to-end. Part 2 implements and tests them; this line
is kept for history rather than deleted.
