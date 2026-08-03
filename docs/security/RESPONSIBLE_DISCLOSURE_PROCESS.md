# Responsible Disclosure Process

**Level 1 document (Current authoritative).** Internal record backing the public
`/security` page and `/.well-known/security.txt`. Established Phase 3, 2026-08-03. Owner:
Security owner. Review cadence: quarterly, per `docs/governance/DOCUMENTATION_GOVERNANCE.md`.

## Public-facing summary

The public policy (`apps/web/src/pages/security.astro`) and `security.txt`
(`apps/web/src/pages/.well-known/security.txt.ts`) are the authoritative public statements — this
document records the internal process behind them, not a separate policy.

## Scope

In scope: CrawlPact-owned systems and services (this repository's code, Cloudflare Worker
configuration, D1 schema). Out of scope, and never authorised by this process: third-party
websites audited through CrawlPact, Paddle, Cloudflare infrastructure outside CrawlPact's own
configuration, other users' accounts or domains, and third-party crawler operators.

## Intake

Reports arrive at `info@crawlpact.com` (`TRUST_CONFIG.securityContact`). There is no ticketing
system or bug-bounty platform — email is the only channel, matching the public page.

## Triage

1. Confirm the report is in scope (see above).
2. Assess severity and reproducibility using the reporter's provided description, steps, and
   evidence.
3. If out of scope, respond explaining why and, where possible, point to the correct venue
   (Cloudflare's or Paddle's own security-reporting channel for their platforms).

## Remediation

Per `CLAUDE.md`'s non-negotiable rules: a confirmed vulnerability gets a forward-fix
migration/code change, not a silent workaround. Fixes follow the same PR/review process as any
other change — no undocumented hotfix path exists for security issues.

## Response commitments (what is and is not promised)

- No fixed response or resolution time is promised, publicly or internally.
- No bug-bounty payment is offered — "bug bounty" language is never used in public copy.
- Coordinated disclosure is preferred; the public policy asks reporters not to disclose publicly
  before a reasonable remediation process completes, but this is a request, not an enforceable
  embargo with a stated deadline.

## Prohibited testing (mirrors the public page)

Denial of service, spam, social engineering, physical attacks, destructive testing, data
exfiltration, accessing other users' data, persistent unauthorised access, high-volume automated
scanning, and public disclosure before remediation.

## Data handling for reports

Reports may occasionally include sensitive data despite the public request not to send it. Treat
any such data as confidential, do not forward it beyond what's necessary for remediation, and
delete proof-of-concept material once a fix is verified where retention isn't otherwise required.
