# External Prerequisites — App-Subdomain Migration Phase 1

Date: 2026-09-09. Every external-owner action required before Phase 4 cutover, with real
live-verified status where this session had read access, and honest `OWNER ACTION REQUIRED`
markers where it did not. **No status below is fabricated or assumed complete.**

## Cloudflare

| Item                                                         | Status                                  | Evidence                                                                                                                                                                                                                              |
| ------------------------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app.crawlpact.com` DNS record                               | **Does not exist**                      | Live `GET /zones/{crawlpact.com}/dns_records` — no `app` record of any type. Only `www` (CNAME), MX×3, TXT×3 (SPF/Zoho/Google site verification), DMARC TXT, DKIM TXT, and `AAAA` records for the apex, `preview`, and `e2e-fixture`. |
| Conflicting CNAME/record for `app.crawlpact.com`             | **None found**                          | Same query as above — clean, ready for a future Custom Domain attachment once host enforcement exists.                                                                                                                                |
| `app.crawlpact.com` Custom Domain attachment                 | **Not attached**                        | Live `GET /accounts/{id}/workers/domains` lists only `crawlpact.com`→`crawlpact-web`, `preview.crawlpact.com`→`crawlpact-web-preview`, `e2e-fixture.crawlpact.com`→`crawlpact-e2e-fixture`.                                           |
| **Phase 1 action**                                           | READY (design only)                     | `CLOUDFLARE_HOST_BOUNDARY_DESIGN.md` designs the required host-enforcement mechanism. **Do not attach the Custom Domain until that mechanism is built and deployed** — this is a Phase 3 gate, not a Phase 1 or Phase 2 action.       |
| `app-preview.crawlpact.com` (candidate preview app hostname) | **Does not exist**, candidate name only | Not invented-and-deployed per directive instruction — recorded as the recommended shape (mirrors the existing single-word `preview.` convention) pending an explicit Phase 2/3 decision.                                              |

## Google Identity Services

| Item                                                                                                         | Status                                                                                                                                                                                                                                                     | Evidence                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Integration mode                                                                                             | Verified: JS popup/callback (`ux_mode: "popup"`), not redirect                                                                                                                                                                                             | `PasskeyAuth.tsx:189-195`; browser does a same-origin `fetch("/api/auth/google")`, Google never POSTs to CrawlPact directly |
| Current Authorized JavaScript origin                                                                         | Production Google Web OAuth Client already configured for `https://crawlpact.com` (implied by working production Google sign-in; not independently re-checked via Google Cloud Console — no credential/MCP access to Google Cloud Console in this session) | ADR-0009                                                                                                                    |
| `https://app.crawlpact.com` as an Authorized JavaScript origin                                               | **OWNER ACTION REQUIRED** — this session has no Google Cloud Console access                                                                                                                                                                                | Cannot be verified or configured from this session                                                                          |
| `https://app-preview.crawlpact.com` as an Authorized JavaScript origin (if preview Google testing is needed) | **OWNER ACTION REQUIRED**, deferred until the hostname is decided and live                                                                                                                                                                                 | Same reason                                                                                                                 |
| No redirect URI needed                                                                                       | Confirmed — integration uses popup/callback mode only, so the directive's "do not add a redirect URI unless redirect mode is actually used" caution does not apply                                                                                         | `PasskeyAuth.tsx`                                                                                                           |

**Exact owner action, when ready (Phase 3, not now):**

```
Google Cloud Console → APIs & Services → Credentials
  → the existing Web application OAuth 2.0 Client (Client ID ends in
    .apps.googleusercontent.com, same one used for crawlpact.com)
  → Authorized JavaScript origins → Add https://app.crawlpact.com
  → (optionally) Add the preview app origin, once decided, for preview testing
```

Keep the existing `https://crawlpact.com` origin registered throughout the migration and rollback
window — do not remove it until Phase 4's apex-auth-redirect is permanently confirmed stable.

## Paddle

| Item                                | Status                                                                                                                               | Evidence                                                                                                                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Approved checkout domains           | **Exactly one**: `crawlpact.com` (`chedom_01kyfnvdzbbvxx40vr7b3hvz98`, `status: approved`, Apple Pay `verified`)                     | Live `checkoutDomains.list` call via Paddle API, this session, 2026-09-09                                                                                                                                      |
| `app.crawlpact.com` checkout domain | **Not registered with Paddle at all** — **OWNER ACTION REQUIRED** (no API exists to submit a checkout domain; Paddle Dashboard only) | Same live query — absent from the list entirely                                                                                                                                                                |
| Default payment link                | `https://crawlpact.com/pay` — **frozen, unchanged**                                                                                  | `docs/deployment/PADDLE_LIVE_CONFIGURATION.md`; Paddle exposes no read API for this account-level setting, so this is the documented record, consistent with the live checkout-domain evidence                 |
| Webhook destination                 | `https://crawlpact.com/api/billing/webhook` — **frozen, unchanged**                                                                  | Same source; webhook signature/idempotency logic independently re-verified from `apps/web/src/lib/billing/paddle-webhook.ts` and `webhook-processor.ts`                                                        |
| **Phase 1 action**                  | **DEFER SUBMISSION UNTIL PHASE 2/3 HOST BOUNDARY IS DEPLOYABLE**                                                                     | Per directive §17 — submitting `app.crawlpact.com` for Paddle review before it's a safely host-enforced, reachable origin would expose an unsafe/incomplete hostname for external review. Not done in Phase 1. |

**Exact owner action, when ready (Phase 3, after the app host is live and stable):**

```
Paddle Dashboard → Checkout → Domains → Add domain → app.crawlpact.com
  → wait for Paddle's approval/review (status moves pending_review → approved)
  → do not enable live app-host Paddle.js checkout until status = approved
```

## Google Search Console

| Item                                                     | Status                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Property type                                            | Not re-verified this session (no GSC API/MCP access) — prior recorded baseline (`docs/baseline/2026-09-07-phase20/SEARCH_CONSOLE_BASELINE.md`, `docs/baseline/2026-09-08-phase22/GSC_BASELINE.md`) states a Domain property for `crawlpact.com`, which — per Google's own documentation — covers all subdomains and protocols automatically. |
| New verification needed for `app.crawlpact.com` coverage | **No** — a Domain property already covers any future subdomain; this is a documentation fact, not something requiring live re-verification, and matches the directive's own expectation (§8: "no new verification is required for coverage").                                                                                                |
| Cutover gate                                             | **Not a blocker** — diagnostic only, per directive.                                                                                                                                                                                                                                                                                          |

## Summary table (directive's required format)

| Prerequisite                 | Current state                     | Required final state                                     | Phase 1 action                                     | Owner action                                      | Cutover gate                   |
| ---------------------------- | --------------------------------- | -------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------- | ------------------------------ |
| Cloudflare app Custom Domain | Not attached, no conflict         | Attached to `crawlpact-web`                              | Design only (`CLOUDFLARE_HOST_BOUNDARY_DESIGN.md`) | Attach after Phase 2 host enforcement ships       | Yes                            |
| DNS conflict                 | None found                        | None                                                     | Verified                                           | None needed                                       | Yes (re-verify at attach time) |
| TLS                          | N/A yet                           | Valid, Cloudflare-managed                                | Documented                                         | Automatic on Custom Domain attach                 | Yes                            |
| Google JS origin             | `crawlpact.com` only              | `+ app.crawlpact.com`                                    | Documented owner action                            | Add origin in Google Cloud Console                | Yes                            |
| Paddle app checkout domain   | Not submitted                     | Approved                                                 | Deferred by design                                 | Submit via Paddle Dashboard once app host is live | Yes                            |
| WebAuthn RP ID               | `crawlpact.com`                   | Unchanged                                                | Frozen                                             | None                                              | Yes (must remain unchanged)    |
| WebAuthn expected origin     | `https://crawlpact.com`           | `https://app.crawlpact.com` (dual-window, origin-pinned) | Design only (`WEBAUTHN_MIGRATION_CONTRACT.md`)     | None (code change, Phase 2/3)                     | Yes                            |
| GSC Domain property          | Covers subdomains already         | Unchanged                                                | Confirmed from docs                                | None                                              | No                             |
| GA/Clarity                   | Public-only, verified from source | Unchanged                                                | Verified                                           | None                                              | Yes                            |

No item above is marked complete unless it was independently, live-verified in this session or is
a documented, unambiguous platform fact (GSC Domain-property subdomain coverage). Every owner
action is explicitly `OWNER ACTION REQUIRED` or `DEFERRED`, never silently assumed done.
