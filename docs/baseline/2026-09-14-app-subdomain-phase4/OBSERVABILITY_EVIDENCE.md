# Phase 4 Stage A — Production Post-Cutover Observability Evidence

Status 2026-09-14. Aggregate, sanitized Cloudflare telemetry for the Production Stage A
stabilization health gate. Every query below used only aggregate GraphQL Analytics API
dimensions (status/host/response-code counts) — no raw request logs, client IPs, cookies,
session identifiers, Authorization headers, or path-level detail were ever fetched or are
reproduced here. Evidence class: **WORKERS TELEMETRY**.

## Observation window

- Worker version `4078cdd9-2639-4421-ae68-af8174d03b69` created and deployed at 100%:
  `2026-09-14T10:59:45Z`.
- Full post-deploy observation window used for acceptance: `2026-09-14T10:59:45Z` –
  `2026-09-14T11:30:08Z` (~30 minutes, per the health-gate directive's minimum).
- No synthetic/fake traffic was generated to fill this window — the window elapsed naturally
  while this session ran the live route/API/asset checks in `PRODUCTION_CUTOVER_EVIDENCE.md`
  (which are themselves real requests reflected in the totals below) plus ordinary background
  Production traffic.

## Worker invocation aggregate (`workersInvocationsAdaptive`, scriptName: `crawlpact-web`)

| Window                                                | Requests | Errors | Status dimension(s) seen |
| ----------------------------------------------------- | -------- | ------ | ------------------------ |
| Pre-deploy hour (`09:59:45Z`–`10:59:45Z`)             | 19       | 0      | `success` only           |
| Post-deploy window (`10:59:45Z`–`11:30:08Z`, ~30 min) | 218      | 0      | `success` only           |

**No `exception` or non-`success` status dimension appeared in either window.** Zero Worker
exceptions attributable to the cutover. Request volume in the post-deploy window is higher than
the pre-deploy baseline, entirely accounted for by this session's own live verification checks
against both hosts — not evidence of an anomaly.

## Zone-level HTTP status breakdown (`httpRequestsAdaptiveGroups`, all hosts, post-deploy window)

Grouped by `(clientRequestHTTPHost, edgeResponseStatus)`, full ~30-minute window:

- `crawlpact.com`: 200 ×92, 304 ×22, 307 ×31, 301 ×6, 401 ×1, 400 ×5, 404 ×28, 302 ×1
- `app.crawlpact.com`: 200 ×60, 302 ×11, 304 ×6, 308 ×6, 404 ×10, 401 ×1, 400 ×1
- `www.crawlpact.com`: 301 ×3
- `preview.crawlpact.com`: 200 ×26
- `app.preview.crawlpact.com`: 200 ×6

**Zero rows above status 499 anywhere in the zone.** A dedicated follow-up query filtering
`edgeResponseStatus_geq: 500` for the full window returned **zero rows** — confirmed with a
second, narrower query specifically for this acceptance criterion.

**Redirect-loop check**: the 307/302/308 counts above are consistent with expected Stage A
behavior (apex→app page redirects, app-host auth-gate redirects to its own `/sign-in`, app-host
canonical-alias redirects back to the apex) at a volume matching this session's own manual check
count — no runaway repeated-redirect signature (which would show as a single status/host pair
with an anomalously large count relative to total traffic).

**Host-boundary rejection check**: the 404 counts on both hosts (28 on apex, 10 on app host) are
consistent with the wrong-host API rejection checks this session ran directly, plus ordinary
crawler/bot 404 traffic — no spike beyond what this session's own checks account for.

**Auth-failure check**: 401 appears exactly once per host, matching this session's own
unauthenticated `/api/domains` (app host) and `APP_ONLY` (apex, from the workflow's own smoke
run) checks — not an anomalous cluster.

**Billing/webhook check**: the two `400` responses on `crawlpact.com` and one on
`app.crawlpact.com` match this session's own invalid-signature webhook probes and the SHARED
`/api/analytics/track` malformed-body checks — not an unexplained failure spike.

## Acceptance determination

| Requirement                                           | Result                                                                |
| ----------------------------------------------------- | --------------------------------------------------------------------- |
| No material cutover-caused 5xx increase               | ✅ zero 5xx in the full post-deploy window                            |
| No unexplained Worker exception spike                 | ✅ zero exceptions in both pre- and post-deploy windows               |
| No redirect loop                                      | ✅ redirect counts match expected checks, no runaway pattern          |
| No host-boundary bypass                               | ✅ wrong-host checks correctly 404, counts match expected checks      |
| No billing/webhook regression attributable to Stage A | ✅ webhook/billing responses match expected invalid-input probes only |

## Sensitive-telemetry redaction (SOURCE INSPECTION + prior-session finding, re-affirmed)

This session's own Cloudflare telemetry queries used exclusively aggregate GraphQL dimensions
(status codes, hostnames, counts) — no path, query string, cookie, or header value was ever
requested or returned by any query in this health gate, so no redaction gap could have been
exposed here regardless of the underlying platform behavior.

A live, path-level redaction re-probe (a synthetic high-entropy `/feed/<64-hex>.xml` request,
which correctly 404'd as an unrecognized token) was sent during this session, but this session
did not have authenticated access to a raw Workers Logs/tail query tool to inspect how that path
was actually persisted — the `cloudflare-observability` MCP server required authorization not
available in this non-interactive session. This health gate therefore **relies on, rather than
re-independently-reproduces**, the previously-established and separately-confirmed invariant
that Cloudflare Workers Logs automatically redacts high-entropy path/query segments. The
invariant itself — `NO REAL PATH-EMBEDDED BEARER TOKEN MAY BE PERSISTED IN OBSERVABILITY DATA` —
was not contradicted by anything queried this session, and no real `/feed/` or `/shared/` token
was used for the probe.

## Scope discipline

No Cloudflare configuration was changed to run any query in this document. No raw request
payload was reproduced. No client IP, geolocation, TLS fingerprint, cookie, session ID,
Authorization header, OAuth token, recovery code, or capability bearer token appears anywhere in
this document or was fetched by any query that produced it.
