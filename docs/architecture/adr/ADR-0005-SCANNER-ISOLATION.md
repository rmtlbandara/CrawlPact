# ADR-0005: Scanner Isolation and SSRF Containment

**Status:** Accepted (revised for Part 2 implementation)
**Date:** 2026-07-22 (Part 1) · Revised 2026-07-22 (Part 2)

## Context

SRS §15 requires the scanner to fetch only public HTTP/HTTPS resources, reject
private/loopback/link-local/reserved/multicast ranges and cloud metadata addresses, reject
literal IP targets, revalidate redirect destinations, bound redirects/timeouts/body size/request
count, and never execute target-controlled script, submit forms, authenticate, or retain
cookies (FR-FET-001 through FR-FET-012).

Cloudflare Workers run each request in a V8 isolate with no local network stack: a Worker's
`fetch()` call is proxied through Cloudflare's own network to the public internet. There is no
loopback interface, no VM-level `localhost`, and no route into the _Worker's own_ private
infrastructure to accidentally expose — this structurally removes the classic "SSRF reaches
the host's internal metadata service" failure mode that affects VM- or container-based
scanners. It does **not**, by itself, stop the scanner from being pointed at a caller-supplied
IP that happens to be inside a private range as interpreted by application logic, nor does it
revalidate redirect targets — those remain application-level responsibilities.

## Decision

- Application-level SSRF containment is implemented as an isolated module,
  `packages/scanner/src/safe-fetch.ts`, with a single responsibility: given a candidate URL,
  resolve and validate before any request is issued, and re-validate on every redirect hop.
- The safe-fetch module is the **only** code path in the entire codebase permitted to make
  outbound requests to a customer-supplied target. It is not imported by any route handler
  directly — only by the scanner orchestrator in `packages/scanner`, which is in turn the only
  caller from `apps/web`. This single-chokepoint design means a future security review only
  has one module to re-audit for fetch behaviour.
- Validation performed before every request (including each redirect hop, up to the
  SRS-mandated maximum of five):
  1. Reject disallowed schemes outright (only `http`/`https`).
  2. Reject embedded credentials (`user:pass@host` — SRS §15/FR-FET; a URL with userinfo is
     rejected unconditionally, never stripped-and-continued, since a target that supplies one
     is either malformed or attempting credential-based request smuggling).
  3. Reject disallowed ports — only the default port for the scheme (`80`/`443`) or an
     explicit, identical default is allowed; any other port is rejected (FR-FET-006).
  4. Reject literal IP-address targets (FR-FET-003 — hostnames only in the MVP).
  5. Resolve DNS via a DNS-over-HTTPS lookup, then reject if **any** resolved address falls in
     a private IPv4/IPv6 range, link-local, multicast, reserved, loopback, or a known cloud
     metadata address (169.254.169.254 and IPv6 equivalents) — see "DNS rebinding" below for
     why this check is necessary-but-not-sufficient and is treated as one layer, not the whole
     control.
  6. Enforce connection/first-byte/per-resource/total-scan timeouts and header/body size caps
     before and while reading a response body — the body reader is truncated at the configured
     limit rather than trusting `Content-Length`.
  7. Cap external requests per scan at ~12 (FR-FET-008), tracked by the scan orchestrator
     (visible to callers), not hidden inside safe-fetch.
  8. Check the target against the admin-managed blocklist (`blocked_targets`) before the first
     request and again before following each redirect.
- The scanner identifies itself with a fixed, documented user agent
  (`CrawlPactAuditBot/1.0 (+https://crawlpact.com/scanner)`) and never impersonates another
  crawler (FR-FET-010/011).
- Target-controlled content (HTML, headers, robots.txt bodies) is treated as untrusted at
  every layer above the fetch: stored as plain text/opaque bytes, never interpreted as
  executable, and escaped on render (see `docs/security/SSRF_SECURITY_MODEL.md` and
  `docs/security/THREAT_MODEL.md`).

## DNS rebinding: honest treatment

**Pre-resolving DNS and checking the result does not, by itself, guarantee the eventual
`fetch()` call connects to the address that was checked.** Two gaps exist and are not fully
closable from inside a Cloudflare Worker with the APIs currently available:

1. **No IP pinning API.** The Fetch API in Workers has no supported way to say "resolve this
   hostname once, verify it, then connect to exactly that address while still sending the
   original Host header" (unlike Node's `http.request` with a custom `lookup` function).
   `fetch(url)` performs its own, independent DNS resolution at connection time. A DNS record
   with a very short TTL could resolve to a safe address at check-time and a different address
   moments later at connect-time (classic TOCTOU rebinding).
2. **No visibility into the address actually connected to.** The Workers runtime does not
   expose the resolved peer IP of an outbound `fetch()` call back to the calling script, so
   there is no way to assert post-hoc "the connection I just made matched the address I
   checked."

Given this, safe-fetch's DNS-based classification (step 5 above) is **defence in depth, not a
complete guarantee** — it reliably rejects the common case (a hostname that plainly, currently
resolves to a private/reserved/metadata address) but cannot fully close a determined,
low-TTL rebinding attack against the resolution step itself.

**What bounds the residual risk in practice:**

- Cloudflare Workers have no network route to an arbitrary third party's private
  infrastructure (a customer's home NAS, a target website's internal admin panel, etc.) — that
  network simply isn't reachable from Cloudflare's edge regardless of what DNS answer is
  returned, because Workers egress through Cloudflare's own network, not the attacker's. A
  successful rebind therefore cannot, on its own, grant access to a third party's internal
  network the way it could from a scanner running inside that party's own infrastructure or
  cloud account.
- The only network a rebind could plausibly reach is Cloudflare's own internal address space,
  if any such rebind target happens to be routable from the Workers egress path. This is a
  platform-level surface CrawlPact has no visibility into and cannot independently verify or
  disprove — it is Cloudflare's responsibility to guard its own network boundary, not
  something this application can test.
- Even in a successful rebind, the blast radius is bounded by the other controls already in
  place regardless of destination: ~12 requests per scan, per-resource and total-scan timeouts,
  response body/header size caps, no cookie retention, no script execution, and the response is
  only ever parsed as one of a small set of expected text formats (never executed).

**This residual risk is accepted, not solved, and must not be described to customers or in
product copy as "impossible" or "fully protected against."** `docs/scanner` public copy states
that CrawlPact validates targets and blocks known-unsafe address ranges — it does not claim an
absolute SSRF guarantee. Re-review this section if Cloudflare's Workers documentation ever adds
resolved-address pinning or visibility APIs, since that would allow closing gap 1/2 above.

## Alternatives Considered

1. **A separate, independently-deployed "scanner Worker"** for stronger blast-radius isolation
   from the main application Worker. Rejected: Workers' isolate model already provides strong
   per-request isolation, and a second deployable would reintroduce the same-origin/
   coordination costs ADR-0001 avoided, for a security benefit that is marginal given the
   analysis above. Revisit via a new ADR if scan volume or risk profile changes materially.
2. **Delegate SSRF filtering to a third-party proxy/service** — rejected by SRS §6.2 (no
   unnecessary external operational services) and unnecessary given the isolate-model
   mitigation already in place.
3. **Skip DNS-based private-range checks since Workers can't reach internal networks anyway**
   — rejected: the SRS's acceptance criteria (§36.8, §35.4) require these checks to be tested
   and passing regardless of platform-level mitigation, and relying solely on platform
   behaviour would be a silent reduction of an explicit SRS requirement, which the project
   rules prohibit.
4. **Attempt to pin resolved IPs via a raw TCP socket API** — Cloudflare Workers expose
   `connect()` (`cloudflare:sockets`) for raw TCP, which in principle could allow
   resolve-then-connect-by-IP. Not adopted in Part 2: it would require reimplementing HTTP/TLS
   over a raw socket (losing `fetch()`'s HTTP semantics, redirect handling, and TLS
   verification) for a gap-closure that only matters for the narrow rebinding window described
   above. Documented here as a possible future mitigation if the residual risk is ever judged
   unacceptable.

## Consequences

- Every new resource type the scanner fetches (llms.txt, sitemaps, RSL, page HTML) goes through
  the same safe-fetch chokepoint; no ad-hoc `fetch()` calls are permitted elsewhere in the
  scanner or route handlers — enforced by code review and by there being exactly one exported
  fetch-capable function from `packages/scanner`.
- Part 2 ships unit tests for every rejection category above, plus integration fixtures for
  redirect-to-private, redirect loops, oversized bodies, and slow responses (SRS §35.4).
- The DNS rebinding residual risk is re-stated in `docs/security/THREAT_MODEL.md` and
  `docs/security/SSRF_SECURITY_MODEL.md` and must be included in any future security review.
