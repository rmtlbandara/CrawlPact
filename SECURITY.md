# Security Policy

## Reporting a vulnerability

Report a suspected vulnerability to **info@crawlpact.com** (CrawlPact's approved security
contact — see `docs/trust/TRUST_AND_LEGAL_CONFIGURATION.md`). The full public
responsible-disclosure policy, including scope, reporter guidance, and prohibited testing, is
published at
[crawlpact.com/security](https://crawlpact.com/security) and machine-readable at
[crawlpact.com/.well-known/security.txt](https://crawlpact.com/.well-known/security.txt) per
RFC 9116.

Please include:

- A clear description of the issue and its potential impact
- Steps to reproduce, or a proof-of-concept
- The affected area (e.g. scanner/SSRF, authentication, billing webhook handling)

Do not send passwords, private keys, full payment-card information, or other users' data.

## Scope

In scope: this repository's code, its Cloudflare Worker configuration, and its D1 schema. Out
of scope: Cloudflare's or Paddle's own platform security (report those directly to Cloudflare
or Paddle), and any third-party website audited through CrawlPact.

## Current state

CrawlPact is live in production at [crawlpact.com](https://crawlpact.com) — passkey/WebAuthn
authentication, the crawler-policy scanner, Paddle billing, saved-domain monitoring, and Super
Admin functionality are all implemented and verified live. See
`docs/status/CURRENT_STATE.md` for the authoritative, evidence-linked capability status and
`docs/security/SECURITY_CHECKLIST.md` for the current status of each SRS §33 security control.

## Our commitment

Security fixes take priority over feature work. A confirmed vulnerability gets a forward-fix
migration/code change, not a silent workaround — consistent with this project's migration and
documentation policies.
