# Phase 2 Completion Report — Application-Origin Implementation

Date: 2026-09-09

## A. Verdict

```
PASS — PHASE 3 READY / OWNER ACTIONS QUEUED
```

Every applicable Phase 2 hard-gate item is genuinely satisfied, with real test evidence (including
two dual-origin cryptographic replay tests using a real WebAuthn authenticator, not documentation
assertions) — see Section M and `TEST_EVIDENCE.md`. Three external, owner-controlled actions
(Cloudflare Custom Domain attachment, Google Authorized JavaScript Origin, Paddle checkout-domain
approval) remain intentionally queued for Phase 3, exactly as Phase 1 left them.

## B. Starting state

- Branch: `fix/canonical-hash-fragment-links`
- SHA at Phase 2 start and end: `db4c3ea243fd0f18b81167371e4d62df2b778be5` (unchanged — no commit
  was created; every change remains staged/unstaged in the working tree, preserving the same state
  Phase 1 left, per instruction not to commit without being asked)
- Phase 1 staged state: fully preserved — verified via `git status`/`git diff` at Phase 2 start;
  nothing was reset, discarded, or silently unstaged
- Phase 1 verdict: `PASS — PHASE 2 READY / OWNER ACTIONS QUEUED` (confirmed, not re-litigated)

## C. Implementation summary

| Area                      | Summary                                                                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Trusted host model        | New `lib/origin.ts` — exact-match-only origin registry, self-referential validation, no header-based trust                              |
| Route ownership           | New `lib/route-ownership.ts` — executable `isPublicOnlyPath`/`isSensitivePath`, reusing `route-registry.ts`                             |
| Static Assets enforcement | Production `wrangler.jsonc` gained a selective `run_worker_first` array, live-verified against preview's real production behavior first |
| App route mapping         | `/` internally rewrites to `/app` on the app surface; full de-prefixing deliberately deferred (documented scope decision)               |
| AuthLayout                | New `AuthLayout.astro`, structurally free of marketing analytics; `sign-in.astro` migrated to it                                        |
| CSRF                      | `same-origin.ts` redesigned to self-referential arrival-origin matching, not a broad allowlist                                          |
| WebAuthn origin pinning   | Challenge tokens now carry a server-derived, signed origin; finish verification is pinned to it; all 6 ceremony call sites updated      |
| App APIs                  | No code change needed — the CSRF redesign and unchanged session/route-handler code already work correctly same-origin on either host    |
| Analytics boundary        | Extended `ga-boundary.test.ts` to cover `AuthLayout`                                                                                    |
| SEO boundary              | `robots.txt.ts` now serves a distinct disallow-all, no-sitemap response on the app surface                                              |
| Conversion continuity     | Fixed the one Phase-1-flagged link (`feed/[token].xml.ts`'s embedded dashboard deep-links now prefer the app origin when configured)    |

Full detail per area: `APPLICATION_ORIGIN_IMPLEMENTATION.md`, `HOST_ROUTING_IMPLEMENTATION.md`,
`CSRF_ORIGIN_ENFORCEMENT.md`, `WEBAUTHN_ORIGIN_PINNING_IMPLEMENTATION.md`,
`AUTH_LAYOUT_AND_ANALYTICS_BOUNDARY.md`, `STATIC_ASSET_HOST_ENFORCEMENT.md`.

## D. Host behavior matrix (real implemented behavior, proven by `worker.host-boundary.test.ts` and `csrf.integration.test.ts`)

| Host                                | Route                                  | Method | Result                                                                                |
| ----------------------------------- | -------------------------------------- | ------ | ------------------------------------------------------------------------------------- |
| apex (`crawlpact.com`)              | `/about/`                              | GET    | public 200 (unchanged)                                                                |
| app (`app.crawlpact.com`)           | `/about/`                              | GET    | 308 redirect to `https://crawlpact.com/about/`                                        |
| app                                 | `/about` (no slash)                    | GET    | 308 redirect to `https://crawlpact.com/about/` (single hop, canonical slash included) |
| app                                 | `/about/`                              | POST   | 404 (rejected, never replayed to apex)                                                |
| apex                                | `/sign-in`                             | GET    | unchanged, fully functional (migration-compatibility)                                 |
| app                                 | `/sign-in`                             | GET    | app auth page, dedicated `AuthLayout`                                                 |
| apex                                | `/app/**`                              | GET    | migration-compatibility, unchanged                                                    |
| app                                 | `/`                                    | GET    | rewritten internally to `/app` (dashboard or sign-in redirect)                        |
| app                                 | `/app/domains`                         | GET    | works (legacy-prefixed path, not yet de-prefixed)                                     |
| app                                 | public mutation (e.g. `/about/`)       | POST   | reject (404)                                                                          |
| unknown host (e.g. `*.workers.dev`) | `/sign-in`, `/app`, `/admin`, `/api/*` | any    | reject (404)                                                                          |
| unknown host                        | `/about/`                              | GET    | still served (no boundary to enforce for public content)                              |
| app                                 | `/api/account` PATCH, `Origin: app`    | —      | 200 (accepted)                                                                        |
| app                                 | `/api/account` PATCH, `Origin: apex`   | —      | 403 (sibling-origin rejected)                                                         |
| apex                                | `/api/account` PATCH, `Origin: app`    | —      | 403 (sibling-origin rejected)                                                         |

## E. Static Assets implementation

See `STATIC_ASSET_HOST_ENFORCEMENT.md` in full. Summary: selective `run_worker_first` array
(`["/*", "!/_astro/*", "!/branding/*", "!/og/*", "!/favicon.png", "!/og-image.svg"]`) on
production, mirroring Cloudflare's own documented pattern, verified against current Cloudflare
documentation. Live-evidence-based (not assumed) confirmation that `_headers`/trailing-slash
behavior survives `run_worker_first` came from directly querying `preview.crawlpact.com` (already
running this way in real production) before writing any code. **Not yet deployed** — this is a
real production behavior change requiring separate deployment authorization.

## F. CSRF implementation

See `CSRF_ORIGIN_ENFORCEMENT.md` in full. Previous model: fixed expected origin from
`PUBLIC_SITE_URL`. New model: self-referential — the request's own validated arrival origin, never
a broad two-origin allowlist. Migration-compatibility behavior: automatic, no per-route table
needed, since a legitimate request always arrives on some trusted origin with a matching `Origin`
header regardless of which phase the migration is in. Negative-test evidence: 4 new sibling-origin
tests in `csrf.integration.test.ts`, all passing, against real D1-backed sessions and real route
handlers.

## G. WebAuthn implementation

See `WEBAUTHN_ORIGIN_PINNING_IMPLEMENTATION.md` in full. RP ID: unchanged (`crawlpact.com`).
Challenge payload change: added `origin: string`, server-derived, never client-supplied. Begin:
derives and signs the validated request origin. Finish: passes the signed origin as
`expectedOrigin` to SimpleWebAuthn, re-validates it's still trusted, and separately confirms the
finish request itself arrived on some trusted origin. Dual-origin capability: yes, each ceremony
independently pinned. Cross-origin rejection tests: yes — 2 tests (registration and authentication)
using a real software WebAuthn authenticator prove a ceremony begun on one trusted origin is
rejected if actually completed on the other, per the authenticator's own signed
`clientDataJSON.origin`. Legacy challenge-token behavior: rejected safely (`challenge_invalid`), no
crash, no silent bypass. No challenge tokens or credential material appear anywhere in this report
or its evidence files.

## H. Sessions

Confirmed unchanged and re-verified from source this phase: `crawlpact_session`, `Path=/`,
`HttpOnly`, `SameSite=Lax`, `Secure` outside local, **no `Domain` attribute**, in both
`buildSessionCookie` and `buildClearedSessionCookie`. No cross-subdomain token transfer of any
kind was introduced. Zero lines of `session.ts` were touched this phase.

## I. Authentication/analytics

`AuthLayout` implemented and in use on `sign-in.astro`. GA absent (structurally — no import).
Clarity absent (structurally). Analytics-consent banner absent (structurally). Google Identity
Services popup/callback architecture fully preserved, no code change to that flow — only the
origin it will eventually run from changes, once Phase 3 attaches the app host.

## J. Billing

`/pay` remains apex — no code touched it. Webhook remains apex — no code touched it, signature/
idempotency logic re-verified unchanged from source. App checkout code was already same-origin
correct before this phase (it calls its own `/api/billing/checkout` relative to whichever origin
it's loaded from) and needed no change — the CSRF redesign is what makes that same-origin call
correctly authorized on the app host once it exists. **Live app-domain Paddle approval is not
complete** — not independently claimed as verified; still queued for Phase 3 (Section D of
`PHASE_3_EXTERNAL_ACTION_QUEUE.md`).

## K. Conversion flows

`continuation`, `plan`, `interval` query parameters: no code touched their handling in
`sign-in.astro`, `app/continue.astro`, or the continuation-consumption API — they remain relative-
redirect-based, which is correct precisely because a relative redirect stays same-origin as
wherever `/sign-in` itself was reached from (verified by re-reading `sign-in.astro`'s existing
`isSafeRelativeRedirect`-guarded redirect construction; no regression risk since nothing in that
logic changed). The one genuine link-correctness gap Phase 1 flagged (`feed/[token].xml.ts`'s
embedded per-notification dashboard links) was fixed to prefer the app origin once configured,
falling back to the current (public-origin) behavior otherwise — re-verified against
`atom-feed-hardening.integration.test.ts` and `notifications-flow.integration.test.ts`, both still
passing.

## L. Files changed

**New files:**

- `apps/web/src/lib/origin.ts`, `apps/web/src/lib/origin.test.ts`
- `apps/web/src/lib/route-ownership.ts`, `apps/web/src/lib/route-ownership.test.ts`
- `apps/web/src/worker.host-boundary.test.ts`
- `apps/web/src/lib/auth/webauthn.test.ts`
- `apps/web/src/layouts/AuthLayout.astro`
- `docs/baseline/2026-09-09-app-subdomain-phase2/` (this folder, 9 documents)

**Modified — implementation:**

- `apps/web/src/worker.ts` (host boundary, root rewrite, generalized trailing-slash)
- `apps/web/src/lib/auth/same-origin.ts` (CSRF redesign)
- `apps/web/src/lib/auth/webauthn.ts` (origin pinning)
- `apps/web/src/pages/api/auth/{register,login,passkeys}/{begin,finish}.ts` (6 files — pass `request` through)
- `apps/web/src/pages/robots.txt.ts` (host-aware dispatch)
- `apps/web/src/pages/feed/[token].xml.ts` (app-origin-preferring dashboard links)
- `apps/web/src/pages/sign-in.astro` (AuthLayout)
- `apps/web/wrangler.jsonc` (production `run_worker_first`)
- `packages/config/src/env.ts` (comments only — `WEBAUTHN_RP_ORIGIN` marked legacy/unused, `PUBLIC_APP_URL` comment updated for Phase 2 consumption)

**Modified — tests:**

- `apps/web/src/layouts/ga-boundary.test.ts`, `apps/web/src/lib/robots-txt.test.ts`,
  `apps/web/src/worker.preview-isolation.test.ts` (extended/fixed for Phase 2)
- `apps/web/tests/integration/csrf.integration.test.ts` (4 new sibling-origin tests)
- `apps/web/tests/integration/test-helpers.ts`,
  `apps/web/tests/integration/auth-flow.integration.test.ts`,
  `apps/web/tests/integration/google-auth-flow.integration.test.ts` (placeholder-host compatibility
  fix, required by the CSRF redesign, not a feature change)
- 8 further integration test files: mechanical `http://x` → real-trusted-host fixes only
  (`admin-webhooks`, `agency-workspace-portfolio`, `billing-checkout-and-plan-change`,
  `audit-abuse-prevention`, `atom-feed-hardening`, `billing-webhook`, `notifications-flow`, plus the
  two above)

**No changes** to: `middleware.ts`, `session.ts`, `route-registry.ts`, Paddle billing logic, Google
auth logic (beyond the shared CSRF helper it already called), any database migration, any public
page content, canonical/sitemap logic, or product pricing/entitlements.

Full diff stat: 38 files changed pre-documentation, 696 insertions / 130 deletions (`git diff
--stat`), plus this phase's documentation folder.

## M. Tests

See `TEST_EVIDENCE.md` for the complete, exact breakdown. Summary:

| Suite                                       | Result                                                                                                                                                                                               |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                                        | 603/603 passing (52 files; +65 tests vs. Phase 1's 538)                                                                                                                                              |
| Integration                                 | 394/394 passing (56 files; +4 tests vs. Phase 1's 390) — one transient local-infra timeout reproduced, isolated, and shown not to recur, per the directive's own guidance for this exact known issue |
| Security                                    | 45/45 passing                                                                                                                                                                                        |
| Build                                       | Passing                                                                                                                                                                                              |
| Typecheck                                   | 0 errors                                                                                                                                                                                             |
| Lint                                        | 0 warnings                                                                                                                                                                                           |
| Format                                      | Clean                                                                                                                                                                                                |
| Dependency audit                            | 0 critical (20 pre-existing non-critical, unchanged from Phase 1)                                                                                                                                    |
| 15 content/registry/docs/privacy validators | All passing individually                                                                                                                                                                             |

No failing suite is reported as green anywhere in this document.

## N. Production impact

```
No production application-origin cutover occurred.
No app.crawlpact.com production Custom Domain was attached.
No root→app production redirects were enabled.
No Paddle endpoint was moved.
No parent-domain session cookie was introduced.
```

All four statements are true. The one caveat, stated plainly rather than glossed over: the
production `wrangler.jsonc` change (`run_worker_first`) is real, deployable, production-affecting
configuration — but it has not been deployed. Deploying it is a distinct, separately-authorized
action from writing it, exactly as `STATIC_ASSET_HOST_ENFORCEMENT.md` documents.

## O. Owner action queue for Phase 3

See `PHASE_3_EXTERNAL_ACTION_QUEUE.md` for the full sequenced version. Summary:

- **Cloudflare**: attach `app.crawlpact.com` Custom Domain — only after Phase 2's code (including
  the `run_worker_first` change) is deployed to production and confirmed stable.
- **Google**: add `https://app.crawlpact.com` as an Authorized JavaScript Origin — after Custom
  Domain attachment.
- **Paddle**: submit `app.crawlpact.com` for checkout-domain approval — only after direct-host
  validation (including the real-passkey regression gate) passes.

## P. Phase 3 handoff

Exact sequence (also in `PHASE_3_EXTERNAL_ACTION_QUEUE.md`):

1. Deploy this phase's code to Preview; validate the selective `run_worker_first` array's real
   behavior there first (Preview currently uses the blanket `true` form).
2. Deploy to production (same code, still no Custom Domain change); run a full regression check
   against real production — homepage, a sample of prerendered pages, `/sign-in`, `/app`, `/admin`
   all unchanged. Requires separate deployment authorization.
3. Only after step 2 is confirmed stable, attach the `app.crawlpact.com` Custom Domain.
4. Add the Google Authorized JavaScript Origin.
5. Run the direct-host validation set — critically, the real-existing-passkey regression gate,
   which cannot be performed before `app.crawlpact.com` is live.
6. Only after step 5, submit Paddle for checkout-domain approval.
7. Run the full `PHASE_2_TEST_CONTRACT.md` suite (inherited from Phase 1, unchanged as the
   authoritative test contract) against the real attached domain.
8. Only after every gate above passes: Phase 4 may begin planning the permanent apex→app redirect.
   Phase 3 itself must not enable it.
