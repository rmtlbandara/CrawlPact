# AGENTS.md — packages/scanner

Read this before touching anything here. See also
`docs/architecture/adr/ADR-0005-SCANNER-ISOLATION.md` and `docs/security/SSRF_SECURITY_MODEL.md`.

## The one rule that matters

This package is the **only** place in the entire codebase permitted to resolve or fetch a
customer-supplied URL. If you find yourself writing a `fetch()` call against a scan target
anywhere else (a route handler, another package), stop — route it through here instead.

## Before adding a new fetch path

1. Every candidate URL must pass through IP classification (`src/ip-classification.ts`) for
   every resolved address, not just the initial hostname.
2. Every redirect hop must be re-validated from scratch — do not assume a validated initial
   target makes its redirect destinations safe.
3. Add a unit test for the specific rejection category before adding the code that triggers it
   (private/loopback/link-local/multicast/reserved/cloud-metadata, literal IP, oversized
   response, redirect loop, slow response).

## What's implemented

`ip-classification.ts`, the safe-fetch pipeline (`safe-fetch.ts`: timeouts, size limits,
redirect-following with per-hop re-validation, request counting), and the full scan orchestrator
(`orchestrator.ts`, fetching robots.txt/llms.txt/llms-full.txt/RSL/homepage/sitemap) are complete
and tested. `signals/*.ts` (`parseLlmsTxt`, `parseRsl`, `parseContentSignals`, `parseHtmlSignals`,
`parseXRobotsTag`) are pure parsers with no fetch of their own — they run both during a scan (for
conflict detection) and again at report-read time against the persisted snapshot
(`apps/web/src/lib/get-scan-report.ts`), so a signal parser must stay a pure function of its input
text with no side effects or hidden state, since it's called from two different contexts.

## Never

- Impersonate a third-party crawler's user agent.
- Retain cookies from a scanned target.
- Execute target-controlled script.
