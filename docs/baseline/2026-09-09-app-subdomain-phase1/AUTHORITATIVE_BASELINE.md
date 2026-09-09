# Authoritative Baseline — App-Subdomain Migration Phase 1

Date: 2026-09-09
Scope: Phase 1 of the `crawlpact.com` / `app.crawlpact.com` origin-separation migration.
Status: baseline frozen at the start of Phase 1 work. All facts below were re-verified live
(git, Cloudflare API, Paddle API, production D1) rather than assumed from the planning document
that initiated this phase.

## Git

- Branch: `fix/canonical-hash-fragment-links`
- Starting HEAD: `db4c3ea243fd0f18b81167371e4d62df2b778be5`
- `main` at start of Phase 1: `bf97bd6ebd477f576a10bd300f861b8c29fbe73a`
- Worktree: clean (`git status --short` empty) at Phase 1 start
- Recent relevant commits: Phase 20 canonical trailing-slash contract (`db4c3ea`, `1cf2675`),
  Astro 7.2.2 → 7.2.10 security upgrade (`bf97bd6`), Phase 22 GSC-driven search intent (`9a2fe87`),
  Phase 23 authority/distribution baseline (`2ab69b5`, docs-only)
- The planning document that initiated this phase cited an "observed main SHA"
  (`ffad33018ea7224bb992798f9f9d6a8d37297c57`) that does **not** match any commit in this
  repository's current history on `main` or this branch. This is exactly the drift the same
  document told us to expect and re-verify — the baseline actually used for Phase 1 is the one
  recorded above, not the planning document's snapshot.
- Repository visibility: private GitHub repository (`github.com/rmtlbandara/CrawlPact`), confirmed
  via `git remote -v`. Treated as confidential per CLAUDE.md and standing user instruction
  regardless of GitHub's reported visibility setting.

## Runtime / dependency baseline

| Component                   | Version                                                                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Node                        | v22.23.1                                                                                                                         |
| pnpm                        | 9.15.0                                                                                                                           |
| Astro                       | 7.2.10                                                                                                                           |
| Wrangler                    | 4.123.0                                                                                                                          |
| `@cloudflare/workers-types` | 5.20260814.1                                                                                                                     |
| `@simplewebauthn/server`    | 13.3.2                                                                                                                           |
| `@simplewebauthn/browser`   | 13.3.0                                                                                                                           |
| Google auth integration     | Google Identity Services, JS popup/callback mode (not redirect)                                                                  |
| Paddle integration          | Paddle.js client-side overlay checkout + hosted customer portal; hand-rolled HMAC webhook verification (not the Paddle Node SDK) |

## Current production architecture (live-verified, not just read from code)

- **Cloudflare account**: "Tharindu Bandara" (`4d64c854d7af229f76656af508b72244`). The account also
  holds five unrelated Workers/zones (`lowerbillhome`, `nimblegrid`, `ezroamguide`, `echobuddha`,
  and their zones) belonging to other projects — not touched, not in scope.
- **Zone**: `crawlpact.com` (`699fe9ba2a9a84e7e06ffbf7cd384ab5`), active, Cloudflare-managed
  nameservers, registered via Namecheap.
- **Workers** (live-listed): `crawlpact-web` (production), `crawlpact-web-preview` (preview),
  `crawlpact-e2e-fixture` (a separate, unrelated fixture Worker used as an e2e scan target — not
  part of the public/app split).
- **Custom Domains attached** (live-verified via Cloudflare API, `GET
/accounts/{id}/workers/domains`):
  - `crawlpact.com` → `crawlpact-web` (production)
  - `preview.crawlpact.com` → `crawlpact-web-preview`
  - `e2e-fixture.crawlpact.com` → `crawlpact-e2e-fixture`
  - **`app.crawlpact.com` is not attached to anything. No DNS record of any kind exists for it**
    (`GET /zones/{id}/dns_records` returns no `app` record; only `www`, MX/TXT/DKIM/DMARC mail
    records, and `AAAA` records for the apex, `preview`, and `e2e-fixture`). This confirms the
    migration is genuinely greenfield for the app hostname — there is no partial/accidental
    production exposure to account for or remediate.
- **D1 databases**: `crawlpact-db` (`dd295b75-7376-4f05-8c50-fb0a63cc3cee`, production),
  `crawlpact-db-preview` (`e9c9f730-1f0d-4f4e-8775-db94126b12f0`, preview) — separate, isolated per
  ADR intent.
- **Assets / `run_worker_first`**: production's `assets` block has no `run_worker_first` key
  (defaults to asset-first dispatch — prerendered pages bypass the Worker entirely). Preview sets
  `run_worker_first: true`. This asymmetry is the exact hard constraint the migration plan calls
  out (see `CLOUDFLARE_HOST_BOUNDARY_DESIGN.md`).
- **Cron**: `0 3 * * *`, top-level only (monitoring sweep + data retention purge).

## Current production adoption / blast-radius baseline (live D1 aggregate counts, no PII)

Queried directly against `crawlpact-db` via read-only aggregate `COUNT(*)` statements. No email
addresses, session tokens, passkey credential IDs, or other identifying values were read or
recorded.

| Metric                                                                    | Count |
| ------------------------------------------------------------------------- | ----- |
| Total user accounts                                                       | 3     |
| Non-admin user accounts                                                   | 2     |
| Admin user accounts                                                       | 1     |
| Accounts with `status = 'active'`                                         | 3     |
| Registered passkey credentials                                            | 4     |
| Google-linked accounts (`oauth_accounts`)                                 | 1     |
| Recovery codes outstanding                                                | 20    |
| Total session rows (all-time, incl. expired/revoked)                      | 89    |
| **Currently active sessions** (`revoked_at IS NULL AND expires_at > now`) | **0** |
| **Currently active admin sessions**                                       | **0** |
| Subscriptions                                                             | 2     |
| Billing customers (Paddle-linked)                                         | 1     |
| Monitored domains                                                         | 11    |
| Domain groups                                                             | 1     |
| Audit continuation records (all-time)                                     | 3     |
| Shared report links                                                       | 1     |
| Admin role assignments                                                    | 1     |
| Pilot participants                                                        | 0     |
| Transactions (all-time)                                                   | 5     |

**Conclusion**: this repeats and reconfirms the historical "essentially no external activated
population" baseline from prior phases, and adds a specific new fact — **zero currently-active
sessions** — meaning the one-time reauthentication cost of the eventual WebAuthn/session-origin
cutover (Phase 4) would affect at most a handful of accounts, none of whom are mid-session right
now. This is the lowest-risk possible window for the migration, consistent with prior phase
baselines; it was independently re-verified rather than copied forward.

## Paddle live-configuration baseline (live-verified via Paddle API)

- `checkoutDomains.list` → exactly one approved checkout domain: `crawlpact.com`
  (`chedom_01kyfnvdzbbvxx40vr7b3hvz98`, `status: approved`, Apple Pay `verified`).
  **`app.crawlpact.com` is not registered with Paddle at all** — it will need to be submitted via
  the Paddle Dashboard (no API exists for submission) and approved before any live checkout can be
  opened from that origin. This is a hard external prerequisite for Phase 3/4, not Phase 1.
- Default payment link and webhook destination remain `https://crawlpact.com/pay` and
  `https://crawlpact.com/api/billing/webhook` per `docs/deployment/PADDLE_LIVE_CONFIGURATION.md`
  (Paddle exposes no read API for the account-level default-payment-link setting, so this is
  taken from the existing documented record, consistent with the live checkout-domain evidence
  above).

## Search Console / GA4 / CrUX baseline

**Not independently re-verifiable in this Phase 1 session** — no Google Search Console, GA4, or
CrUX API/MCP credential is available to this session, and the repository contains no script that
fetches live GSC/GA4/CrUX data (only `scripts/analytics-validate.mjs`, which is a static
source-code boundary check, not a live API pull). The most recent recorded baselines are the
Phase 20–22 snapshots already committed at `docs/baseline/2026-09-07-phase20/SEARCH_CONSOLE_BASELINE.md`,
`docs/baseline/2026-09-08-phase20/{GA4_BASELINE.md,CRUX_FIELD_DATA_STATE.md,SEARCH_CONSOLE_BASELINE.md}`,
and `docs/baseline/2026-09-08-phase22/GSC_BASELINE.md`. Per this phase's evidence-driven rule, these
are **not re-presented here as fresh evidence** — they are dated snapshots from 2026-09-07/08 and
should be treated as historical context only. Refreshing them is an **owner action** (requires GSC/
GA4 dashboard or credentialed API access this session does not have) and is not a Phase 1 blocker:
this migration does not depend on current search/analytics performance figures, only on the
existing code-level GA/Clarity route boundary, which was independently verified from source (see
`docs/status/CURRENT_STATE.md` cross-reference and the SEO/analytics findings below).

## Auth/security current-state (verified from source, `apps/web/src/lib/auth/**`)

- **Session cookie**: `crawlpact_session`, `Path=/`, `HttpOnly`, `SameSite=Lax`, `Secure` outside
  local, **no `Domain` attribute** (`session.ts`). Host-only, confirmed absent in both the
  cookie-setting and cookie-clearing code paths.
- **WebAuthn**: `WEBAUTHN_RP_ID=crawlpact.com`, `WEBAUTHN_RP_ORIGIN=https://crawlpact.com` in
  production `vars`. The signed challenge-token payload (`{purpose, challenge, ...}`) carries **no
  origin field** — `expectedOrigin`/`expectedRPID` are read fresh from env at verification time,
  not bound per-ceremony. This confirms the migration document's dual-origin risk is real and
  unaddressed today.
- **CSRF**: `assertSameOrigin()` checks the request's `Origin` (falling back to `Referer`) against
  a single configured origin, `new URL(PUBLIC_SITE_URL).origin`. No allowlist mechanism exists.
- **Google auth**: JS popup/callback mode (`ux_mode: "popup"`); browser POSTs the credential
  same-origin to `/api/auth/google`; Google itself never calls CrawlPact directly.
- **Sign-in page**: `sign-in.astro` currently uses `MarketingLayout` (marketing chrome, header,
  footer, and the analytics-consent banner island all mount there), though `/sign-in` is already
  excluded from the GA/Clarity route allowlist so the scripts themselves don't render. This
  confirms the planning document's "sign-in needs a dedicated AuthLayout" requirement is real —
  today sign-in is architecturally a marketing page for layout purposes, not an app/auth page.

Full detail for each of the above lives in the companion Phase 1 documents in this folder.

## Documentation-state correction

CLAUDE.md's "read first" list references `docs/status/IMPLEMENTATION_STATUS.md`. That file has
been archived — it now lives at `docs/archive/implementation-history/IMPLEMENTATION_STATUS.md`.
The actively maintained equivalent is `docs/status/CURRENT_STATE.md`. This is a pre-existing
documentation drift unrelated to this migration; it is noted here rather than silently worked
around, per the "do not base implementation purely on stale docs" rule. It is out of this
migration's scope to fix CLAUDE.md itself; flagged for the user/maintainer separately.
