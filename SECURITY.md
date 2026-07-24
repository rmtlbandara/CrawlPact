# Security Policy

## Reporting a vulnerability

CrawlPact does not yet have a public bug-bounty program or a dedicated security contact
address (no email infrastructure exists by design — see SRS §6.2). Until a formal channel is
established, report a suspected vulnerability by opening a private communication with the
repository owner through the platform hosting this repository (e.g. a GitHub private security
advisory), rather than a public issue.

Please include:

- A clear description of the issue and its potential impact
- Steps to reproduce, or a proof-of-concept
- The affected area (e.g. scanner/SSRF, authentication, billing webhook handling)

## Scope

In scope: this repository's code, its Cloudflare Worker configuration, and its D1 schema. Out
of scope: Cloudflare's or Paddle's own platform security (report those directly to Cloudflare
or Paddle).

## What CrawlPact does today (Part 1)

- Domain/URL input is normalised and validated before any further processing
  (`packages/core/src/domain/normalize.ts`).
- IP-range classification for SSRF defence-in-depth is implemented and unit-tested
  (`packages/scanner/src/ip-classification.ts`) — see `docs/security/SSRF_SECURITY_MODEL.md`.
- No live scanner, authentication, billing, or admin surface exists yet, so most of the SRS's
  security requirements (§33) are architected but not yet exercised — see
  `docs/security/SECURITY_CHECKLIST.md` for the current, honest status of each control.

## Our commitment

Security fixes take priority over feature work. A confirmed vulnerability gets a forward-fix
migration/code change, not a silent workaround — consistent with this project's migration and
documentation policies.
