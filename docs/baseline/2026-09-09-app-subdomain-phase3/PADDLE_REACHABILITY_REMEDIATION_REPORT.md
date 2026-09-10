# Paddle Checkout-Domain Reachability Remediation — Report

Status as of 2026-09-10. This report picks up where `PHASE_3_COMPLETION_REPORT.md` left off: that
report recorded `app.crawlpact.com` submitted to Paddle for checkout-domain approval as an
external, owner-only action. Paddle's automated reviewer subsequently returned **two consecutive
`ACTION_REQUIRED` responses** ("we can't reach your domain") against a domain that was already
confirmed HTTPS-reachable by every tool available in this session. This report documents both
remediation rounds, the final root-cause hypothesis, the exact changes made, and the full
production validation evidence. It does not replace `PHASE_3_COMPLETION_REPORT.md` — it is a
continuation of the same Phase 3 sequence, scoped to this one blocker.

## Verdict

**Ready for a Paddle manual re-review.** All owner-approved remediation is deployed to Production
and independently reverified. Paddle resubmission itself was explicitly withheld — that action
belongs to the domain owner, not to Claude Code, and was not taken.

## Why this took two rounds

Paddle's `ACTION_REQUIRED` message gives no diagnostic detail beyond "we can't reach your
domain," and Paddle does not expose its reviewer's request signature (headers, IP range, or
robots.txt handling) for a standard seller account. Both rounds were therefore built on the
evidence actually available — direct production `curl`/DNS/TLS checks plus a systematic sweep of
every Cloudflare control that can reject or challenge a request — rather than on Paddle's own
diagnostics, which don't exist for this account tier.

## Round 1 — commit `ec270cf`

**Hypothesis:** the app host had no real, unauthenticated landing content at `/` at all — an
unauthenticated visitor was rewritten straight to `/app`, which redirected to `/sign-in`, and
`robots.txt` disallowed the entire host (`Disallow: /`). A `robots.txt`-respecting reviewer
requesting `/` would never see the destination content, and Google's own guidance confirms a page
blocked by `robots.txt` never has its `noindex` observed either way.

**Changes:**

- `apps/web/src/worker.ts` — the app-surface root handler now serves a dedicated public landing
  page (`/app-shell`) directly with a 200, no redirect, whenever the request carries no session
  cookie; an authenticated request continues rewriting to `/app` unchanged.
- `apps/web/src/pages/app-shell.astro` (new) — the public, unauthenticated landing page for
  `app.crawlpact.com/`. Reuses `AuthLayout` so `noindex` and the absence of marketing
  analytics/nav carry over automatically.
- `apps/web/src/pages/robots.txt.ts` — `APP_ROBOTS_TXT` changed from a blanket `Disallow: /` to
  `Allow: /` plus explicit `Disallow:` on real application prefixes only (`/app`, `/admin`,
  `/api/`, `/audit/`, `/shared/`, `/dev/`). Approved by the owner as an explicit robots/indexing
  decision, reasoned in the file's own doc comment: being crawlable is what lets a compliant
  reviewer or Googlebot actually observe the independent `noindex` signals
  (`middleware.ts`'s `X-Robots-Tag`, `AuthLayout`'s `<meta>` tag) that already exist and are
  unaffected by this change.
- `apps/web/src/layouts/AuthLayout.astro` / `apps/web/src/pages/terms.astro` — added a Refund
  Policy link (`/terms#refunds`) to the footer shown on `/` and `/sign-in`, and an `id="refunds"`
  anchor on the existing Terms §12 heading, so Paddle's policy-link check resolves to real content.
- `apps/web/src/middleware.ts` — comment-only clarification; `/app-shell` was already covered by
  the existing `path.startsWith("/app")` non-indexable-route rule, no functional change.

Deployed to Production, verified live, regression suite green. Paddle re-reviewed and returned a
**second** `ACTION_REQUIRED`.

## Round 2 — commit `011b939` + Cloudflare Configuration Rule

**Hypothesis, ranked by evidence:**

1. **(Primary, evidence-supported)** The page title (`"CrawlPact – Sign in"`) and a single
   sign-in-first layout could read to an automated reviewer as a login wall rather than a real
   product front door, independent of HTTP status.
2. **(Primary, evidence-supported)** Cloudflare's **Browser Integrity Check** (zone-wide `on`)
   combined with **Security Level `medium`** was the one remaining Cloudflare control, out of a
   full sweep, capable of silently challenging a non-browser automated reviewer without producing
   a 4xx/5xx this session could observe from its own vantage point.

Systematically ruled out first, by direct Cloudflare API inspection rather than assumption: Zero
Trust Access (not enabled), custom WAF rules (zero), Managed WAF overrides (none), IP Access Rules
(empty), Page Rules (empty), Redirect Rules (scoped only to apex/www, never `app.crawlpact.com`),
rate limiting (no ruleset), Super Bot Fight Mode (not available on this plan), and UA-based
blocking (seven different UAs all returned identical 200s).

**Changes, both explicitly owner-authorized in advance:**

1. `apps/web/src/pages/app-shell.astro` — title changed to lead with the same product tagline the
   marketing homepage uses (`${BRAND.productName} — ${BRAND.tagline}`, i.e.
   `"CrawlPact — AI crawler policy, verified."`) instead of `"CrawlPact – Sign in"`; body now
   leads with `BRAND.descriptions.medium` before offering **two equally-weighted actions** — "Sign
   in" and "Visit crawlpact.com" — rather than one dominant sign-in CTA. `/sign-in` itself was left
   completely untouched; it keeps its own sign-in-specific title and remains the real,
   dedicated sign-in route.
2. **One Cloudflare Configuration Rule**, created via the Rulesets API
   (`http_config_settings` phase, zone `699fe9ba2a9a84e7e06ffbf7cd384ab5`):

   ```json
   {
     "id": "689db52e511b4346a1b142aefc9c11ce",
     "action": "set_config",
     "action_parameters": { "bic": false },
     "expression": "(http.host eq \"app.crawlpact.com\") and (http.request.uri.path in {\"/\" \"/sign-in\" \"/robots.txt\"})",
     "enabled": true
   }
   ```

   Ruleset ID: `09d08617a0e649918f1ad9a6465c98c9`. Exact-path matching only (not prefix), scoped to
   exactly one host and three paths. This is an external Cloudflare configuration change, not a
   code change — it is recorded here rather than in git.

   **Explicitly not done, by owner instruction:** no global Browser Integrity Check change, no BIC
   change for `crawlpact.com` or preview hosts, no Managed WAF/DDoS disabling, no IP allowlisting
   for unverified Paddle IP ranges, no attempt to spoof or fingerprint Paddle's reviewer, no
   zone-wide Security Level reduction, no `security_level = essentially_off`, no change to
   `/app`/`/admin`/`/api/*` protection.

## Deployment record

|                   | Round 1                                             | Round 2 (current live)                                                          |
| ----------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- |
| Commit            | `ec270cf`                                           | `011b939`                                                                       |
| Worker deployment | `b52148b7-db7c-49d8-a576-482f338f38bc`              | `b0dfdff2-03da-4bbe-8403-aadf755a1851`                                          |
| Worker version    | `ff6deab8-27cb-4493-affe-11c799946ec4`              | `5aacab1e-4e29-46ca-8f0c-886ee1f9794c`                                          |
| Deployed at       | (same session, prior to Round 2)                    | `2026-09-10T05:42:23Z`                                                          |
| Rollback target   | `0e74c80d` / `4e618afc-3071-4bbd-91df-8fbc6bf5db4f` | `b52148b7-db7c-49d8-a576-482f338f38bc` / `ff6deab8-27cb-4493-affe-11c799946ec4` |

A separate, unrelated whitespace-only Prettier fix (`bfb53c0`, markdown emphasis-marker style) was
committed between the two rounds per explicit owner instruction to keep it out of the remediation
commit.

CI: one E2E run (`34440397834`) showed 3 failures on the Round 2 push, all in
authenticated-dashboard/pricing flows (`audit-conversion.spec.ts`, `pricing.spec.ts`,
`saved-domain-timeline.spec.ts`) that do not touch `/` or `app-shell.astro` at all — matched the
session's already-established pre-existing CI-runner resource-contention flake pattern.
`gh run rerun 34440397834 --failed` came back fully green, confirming it was not a regression.

## Final production validation (Round 2, post-deploy)

**A. Reachability** — `/`, `/sign-in`, `/robots.txt` on `app.crawlpact.com`: HTTPS GET/HEAD all
200; HTTP GET `/` → 301 to HTTPS; no `cf-mitigated` header on any request; IPv4 and IPv6 both 200;
TLS certificate valid with `app.crawlpact.com` in the SAN; four representative User-Agents
(browser, generic HTTP client, crawler-like, empty) all 200, no challenge.

**B. Page content** — title `"CrawlPact — AI crawler policy, verified."`; H1 `"CrawlPact"`;
tagline `"AI crawler policy, verified."`; description is `BRAND.descriptions.medium`
("CrawlPact is an independent AI crawler policy audit and monitoring platform. It shows what a
website currently tells search, training, retrieval, and agent crawlers, preserves evidence,
explains conflicting signals, and detects both website-policy and verified crawler-registry
changes."); two equal CTAs ("Sign in", "Visit crawlpact.com").

**C. Cloudflare control state** — zone-wide `security_level` confirmed **unchanged** (`"medium"`)
before and after the Configuration Rule was created; zone-wide `browser_check` confirmed
**unchanged** (`"on"`) — only the three-path, one-host carve-out applies. Managed WAF and DDoS L7
rulesets untouched (0 changes). Exactly one rule exists in the `http_config_settings` phase
(confirmed no pre-existing overlap before creating it).

**D. Private-route protection, freshly reverified against the live deployment, unauthenticated, no
cookie:**

```
app.crawlpact.com/app          → 302
app.crawlpact.com/admin        → 302
app.crawlpact.com/api/domains  → 401
```

WebAuthn RP ID confirmed still `crawlpact.com` (unnarrowed to the app origin) via a live
`/api/auth/login/begin` challenge response.

**E. Policy links** — Terms → 200, Privacy → 200; Refund Policy anchor
(`/terms#refunds` → `<h2 id="refunds">12. Refunds</h2>`) resolves to real refund content.

**F. Indexing state** — `X-Robots-Tag: noindex, nofollow, noarchive` and
`<meta name="robots" content="noindex, nofollow">` both present on `/` and `/sign-in`; app-host
`robots.txt` matches the approved Round 1 policy exactly; marketing sitemap contains 0 app URLs;
apex `crawlpact.com` SEO/robots/`/` unchanged (200).

**G. Full regression suite, freshly re-run against the deployed commit:**

| Suite                                                                                          | Result                                                                    |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `format:check`                                                                                 | pass                                                                      |
| `lint`                                                                                         | pass, 0 warnings                                                          |
| `typecheck`                                                                                    | pass, 0 errors (553 files; pre-existing unrelated deprecation hints only) |
| Passkey/WebAuthn (`webauthn.test.ts`)                                                          | 9/9 pass                                                                  |
| Google OAuth (`google.test.ts`)                                                                | 15/15 pass                                                                |
| Host-boundary (`worker.host-boundary.test.ts`)                                                 | 27/27 pass                                                                |
| Robots (`robots-txt.test.ts`)                                                                  | 17/17 pass                                                                |
| Route-registry + route-ownership                                                               | 81/81 pass                                                                |
| Security suite (`test:security` — CSRF, admin-security, atom-feed-hardening, abuse-prevention) | 45/45 pass, 8/8 files                                                     |
| Full unit suite (`test:unit`)                                                                  | 659/659 pass, 52/52 files                                                 |
| `build`                                                                                        | pass, no errors                                                           |

Working tree clean after the build (the pre-existing root `.dev.vars` build-safety check was
satisfied the same way as every prior build this session: moved aside immediately before
`pnpm build`, restored immediately after).

## What was explicitly not done

- **Paddle domain was not resubmitted.** Resubmission is the owner's own action, to be taken after
  reviewing this report.
- **No Paddle settings, products, webhooks, or client-token were changed.**
- **No Google OAuth change** beyond the one already-authorized origin addition recorded in
  `PHASE_3_COMPLETION_REPORT.md`.
- **No global Cloudflare security reduction** — see the Configuration Rule scope above.

## Rollback readiness

Current rollback chain, newest first: `5aacab1e-4e29-46ca-8f0c-886ee1f9794c` (live) →
`ff6deab8-27cb-4493-affe-11c799946ec4` → `4e618afc-3071-4bbd-91df-8fbc6bf5db4f`. The Cloudflare
Configuration Rule (`689db52e511b4346a1b142aefc9c11ce`) can be disabled or deleted independently of
any Worker rollback, since it is a separate zone-level object. No rollback was required at any
point in either remediation round.
