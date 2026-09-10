# Phase 1–3 Closure — Starting State (live-verified, 2026-09-10)

This is the real current state, captured directly from git and the Cloudflare API in this
session — not copied from any earlier report. Where it confirms or contradicts an earlier report,
that is noted; earlier reports are left unedited (see the reconciliation matrix, still in
progress, for corrections).

## Git

```
branch: main (up to date with origin/main)
HEAD:   011b93970c4c98a4f2f3e2c0d909991983a56da1
status: clean except two new untracked docs files from the immediately prior turn
         (PADDLE_REACHABILITY_REMEDIATION_REPORT.md, exports/*.docx)
```

Last 6 commits: `011b939` (app-shell title/copy fix) → `bfb53c0` (docs whitespace) → `ec270cf`
(app-host reachability fix) → `043b4f0` (Custom Domain re-attachment + passkey continuity docs) →
`7c9c17d` (Static Assets alias boundary fix, #172) → `168d21f` (Phases 1–2 merge, #171).

## Cloudflare Worker (`crawlpact-web`, id `3d5f91afdf5245b0b067a7525e9e387f`)

**Bindings actually deployed in production** (confirms/contradicts several earlier-report
claims):

| Binding                                                                                                  | Value                                                                                    |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `PUBLIC_SITE_URL`                                                                                        | `https://crawlpact.com`                                                                  |
| `PUBLIC_APP_URL`                                                                                         | `https://app.crawlpact.com`                                                              |
| `PUBLIC_APP_ENV`                                                                                         | `production`                                                                             |
| `WEBAUTHN_RP_ID`                                                                                         | `crawlpact.com`                                                                          |
| `WEBAUTHN_RP_ORIGIN`                                                                                     | `https://crawlpact.com` (legacy field, per Phase 2 docs no longer read for verification) |
| `GOOGLE_CLIENT_ID`                                                                                       | `913355566806-nk8ut4qmjqpigmife8q213vlc4ifdksp.apps.googleusercontent.com`               |
| `PADDLE_ENVIRONMENT`                                                                                     | `production`                                                                             |
| `PADDLE_PRICE_ID_{SOLO,PRO,AGENCY}`                                                                      | set                                                                                      |
| `PUBLIC_PADDLE_CLIENT_TOKEN`                                                                             | `live_...` (live token, as expected)                                                     |
| `AUDIT_ENGINE_ENABLED` / `BILLING_ENABLED`                                                               | `true` / `true`                                                                          |
| Secrets (`PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `SESSION_SIGNING_SECRET`, `ABUSE_MONITORING_SECRET`) | present, values not readable via API (expected — write-only)                             |

**Correction to Phase 1's completion report**: Phase 1 described `PUBLIC_APP_URL` as "optional,
unconsumed by any code path." That was true _at Phase 1's own end_, but is stale now —
production's live binding shows a real value, and Phase 2/3 code (`lib/origin.ts`,
`toPublicUrl`, host classification) actively consumes it. The schema (`packages/config/src/env.ts`)
still marks it `.optional()`. This is a genuine current gap (Section 7 of the closure directive),
addressed separately below — not fixed in this pass yet, since tightening a Zod schema and its
~44 dependent test mocks is a real code change requiring its own review, not a read-only finding.

## Custom Domains (`GET /accounts/.../workers/domains`, this account's zones only)

| Hostname                    | Service (Worker)        | Cert           | Enabled |
| --------------------------- | ----------------------- | -------------- | ------- |
| `crawlpact.com`             | `crawlpact-web`         | `a70b3b4b-...` | yes     |
| `app.crawlpact.com`         | `crawlpact-web`         | `4b990f36-...` | yes     |
| `preview.crawlpact.com`     | `crawlpact-web-preview` | `79dc2c6d-...` | yes     |
| `e2e-fixture.crawlpact.com` | `crawlpact-e2e-fixture` | `fe460108-...` | yes     |

**Finding relevant to Section 8**: Preview already runs as a **separate Worker service**
(`crawlpact-web-preview`), not a shared deployment of `crawlpact-web`. There is **no**
`app-preview.crawlpact.com` or `app.preview.crawlpact.com` Custom Domain attached anywhere —
the nested Preview-app-origin design the closure directive asks about is genuinely not yet
built, exactly as Phase 1/2 left it ("future candidate," not started). No contradiction here,
just confirmed not-yet-done.

## `workers.dev` (Section 10)

```
GET /accounts/.../workers/scripts/crawlpact-web/subdomain
→ { "enabled": true, "previews_enabled": true }
```

Confirmed: the production `*.workers.dev` route for `crawlpact-web` is live at the account level.
This matches Phase 3's own finding (`<worker>.workers.dev/about/` → 200) — still true today, not
fixed yet. Disabling it is a real, deployable Cloudflare account-level change and is being held
for explicit owner sign-off before touching it (see the accompanying report to the owner).

## DNS (`crawlpact.com` zone, filtered to crawlpact.com records)

`www` CNAME → apex (proxied); 3× MX + SPF/DKIM/DMARC/Zoho/Google-site-verification TXT records
(mail/verification, unrelated to this migration, unchanged); AAAA records for `crawlpact.com`,
`app.crawlpact.com`, `preview.crawlpact.com`, `e2e-fixture.crawlpact.com` all present and proxied
(`100::`, Cloudflare's proxied-record placeholder — confirms IPv6 is proxied through Cloudflare
for all four hostnames). No unexpected or conflicting record found.

## Zone-wide security posture (`699fe9ba2a9a84e7e06ffbf7cd384ab5`, plan: **Free Website**)

| Control                                                   | State                                                                                                                                                              |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `browser_check` (BIC)                                     | `on` (zone-wide) — unchanged since the addendum's Configuration Rule was added                                                                                     |
| `security_level`                                          | `medium` — unchanged                                                                                                                                               |
| Configuration Rules (`http_config_settings`)              | exactly 1 rule: the addendum's `bic:false` carve-out for `app.crawlpact.com` on `/`, `/sign-in`, `/robots.txt` — still scoped as before, no drift                  |
| Custom WAF rules (`http_request_firewall_custom`)         | 0                                                                                                                                                                  |
| **Managed WAF ruleset** (`http_request_firewall_managed`) | **no entrypoint ruleset exists at all** — see note below                                                                                                           |
| DDoS L7 custom ruleset                                    | no entrypoint (Cloudflare's baseline DDoS protection still applies automatically at every plan tier; this only means no _custom override_ exists, which is normal) |
| Rate limiting ruleset                                     | none                                                                                                                                                               |
| Redirect Rules                                            | exactly 2, both scoped to `crawlpact.com`/`www.crawlpact.com` only (www→apex, apex HTTP→HTTPS) — never touch `app.crawlpact.com`                                   |
| Zero Trust Access                                         | not enabled on this account at all                                                                                                                                 |

**New finding, not previously documented anywhere in Phases 1–3**: this zone is on Cloudflare's
**Free Website plan**. The Cloudflare Managed Ruleset (OWASP-style managed WAF) is a paid-plan
feature — it is not merely "not overridden," it is **not available to enable at all** on this
plan. This is a genuine, pre-existing account-level fact, unrelated to the app-subdomain migration
or the Paddle remediation (nothing in this session's changes touched it, and there is nothing to
"turn on" without a plan upgrade). Flagged here rather than silently assumed away, per the
directive's own "resolve documentation contradictions" instruction — no earlier Phase 1–3 report
claimed Managed WAF was active, but none stated the plan tier either, so this closes an
unstated gap in the record rather than reporting a regression.

## Tooling actually available this session (Section 1's discovery requirement)

Connected and usable: Cloudflare (`cloudflare-api`, `cloudflare-bindings`, `cloudflare-builds`,
`cloudflare-observability`, `cloudflare-docs`), GitHub, WebSearch/WebFetch.

**Not connected, confirmed by direct probe, not assumed:**

- **Paddle MCP** — configured but fails to connect (`ENOTFOUND mcp.paddle.com`, a DNS/connection
  failure). The Paddle REST API itself is reachable in principle, but this session holds no
  Paddle API key in usable form (`PADDLE_API_KEY` is a write-only Cloudflare secret binding —
  its value cannot be read back through the Workers API). There is no route to query or change
  live Paddle checkout-domain status from inside this session. The owner-supplied screenshot
  (`app.crawlpact.com` → Action required, `crawlpact.com` → Approved) is therefore the only
  available source of Paddle status right now.
- **Google Cloud / OAuth console tooling** — no MCP server or equivalent connected. Confirms
  Phase 3's own finding is still accurate today: there is no automated route to read or modify
  the Google OAuth client's Authorized JavaScript Origins.
- **Google Search Console / GA4 / CrUX** — no MCP server connected. Same conclusion as Phase 3.

None of these three are "unconfigured because no one tried" — each was actively probed this
session and failed or was absent, consistent with (and in Paddle's/Google's case, identical to)
what the earlier Phase 1–3 reports already found.
