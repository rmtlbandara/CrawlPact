# Phase 4 Readiness Report

Status as of 2026-09-10, immediately following PR #173's Production compatibility deployment.
This report supersedes the **status** claims of every earlier Phase 1–3 document where they
conflict — it does not rewrite or remove any historical evidence.

## A. Verdict

```
BLOCKED_PENDING_OWNER_VALIDATION
```

Paddle approval — the one hard gate this session's own tooling could never close by itself — is
now closed. Every other item this session's tooling _could_ safely verify or fix has been
verified or fixed. What remains blocking Phase 4 is exactly the set of items that require either
tooling genuinely not connected to this session (Google OAuth console, GSC, GA4, CrUX) or a real,
live, authenticated interaction only the account owner can perform (physical passkey approval, a
real Google account sign-in, browser-based cookie/CSRF inspection). None of these were skipped,
guessed at, or marked PASS without evidence — see Sections I, K, L, M, N, O below for the exact
list.

**Phase 4 has not started.** No apex→app redirect, CTA change, or traffic-migration switch was
enabled by this deployment.

## B. Final Production Git SHA

```
b23e176849dcbb11b4abe9aa2184084c31a2ed1b
```

Squash-merge of PR #173 into `main`. Tree-verified identical to the Preview-tested candidate
(`2a2d15a8b966d1cf915ab1a064d1cc8ba7c471e9`) before deployment — `git diff 2a2d15a b23e176 --stat`
returned empty, and both commits' tree hash is `c6b47f8f6c3c2c0907446e1255707b758490fafe`.

## C. Worker deployment/version

```
Deployment: 8eacde5b-46b9-4c3f-92be-9d3c63de43fc
Version:    a73071e7-afe8-465a-a4cf-fee0237cb5f3
Deployed:   2026-09-10T14:36:46Z
```

Deployed via `deploy-production.yml` (`workflow_dispatch`, typed `DEPLOY PRODUCTION` confirmation,
ancestor check, CI-succeeded-for-this-exact-SHA check, all passed) — run
[34489405944](https://github.com/rmtlbandara/CrawlPact/actions/runs/34489405944), conclusion
`success`.

## D. Rollback target

```
Deployment: b0dfdff2-03da-4bbe-8403-aadf755a1851
Version:    5aacab1e-4e29-46ca-8f0c-886ee1f9794c
Corresponds to commit: 011b939 (previous production commit)
```

No persistent-state (D1/KV/R2) change was introduced by this deployment — PR #173 is
configuration/routing/reconciliation only, confirmed by its diff — so Worker rollback to this
target remains safe if ever needed.

## E. Preview evidence

Deployed to Preview first (`deploy-preview.yml`, `workflow_dispatch` with explicit
`commit_sha=2a2d15a`), confirmed built from the exact PR #173 SHA. Live-validated before
Production: the `/for/*`/`/research/*` alias fix (all four alias forms → single clean canonical
redirect, no malformed `.../index.html/` target), general non-regression (`/`, `/sign-in`,
`/about/`, `/app`, `/admin`, `/robots.txt` all correct), and the corrected
`PUBLIC_APP_URL=https://app.preview.crawlpact.com` live on the deployed Preview Worker. The
workflow's own build/migrate/seed/deploy/binding-verification/smoke-test/Lighthouse-budget steps
all passed. Full detail in the conversation record; not duplicated here.

## F. Cloudflare hostname matrix

| Hostname                             | Classification                | State                                                                                                                                                                                   |
| ------------------------------------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crawlpact.com`                      | PUBLIC                        | Live, canonical, unchanged                                                                                                                                                              |
| `app.crawlpact.com`                  | APP                           | Live, Custom Domain attached to `crawlpact-web`, Paddle-approved                                                                                                                        |
| `www.crawlpact.com`                  | REDIRECT_ONLY                 | 301 → apex, unchanged                                                                                                                                                                   |
| `preview.crawlpact.com`              | PREVIEW                       | Live, Custom Domain attached to `crawlpact-web-preview`                                                                                                                                 |
| `e2e-fixture.crawlpact.com`          | Test infrastructure only      | Unrelated to production app, unchanged                                                                                                                                                  |
| `<account>.workers.dev` (production) | **unclassified — still open** | Still enabled; disabling it was explicitly held for owner sign-off, not included in PR #173. Redundant exposure, not a broken security boundary, but should be resolved before Phase 4. |
| `app.preview.crawlpact.com`          | Candidate only, not attached  | Corrected to a WebAuthn-valid hostname this pass; no DNS/Custom Domain exists                                                                                                           |

## G. Paddle Approved evidence

Independently confirmed via the Paddle API (not just the owner's dashboard screenshot),
re-verified again immediately after this Production deployment to confirm the deploy didn't
disturb it:

```
crawlpact.com      chedom_01kyfnvdzbbvxx40vr7b3hvz98   approved   (unchanged since 2026-07-26)
app.crawlpact.com  chedom_01m24mn1cqys7mcn80rgt6t4t2   approved   updated_at 2026-09-10T11:10:42Z
```

Both show `payment_method_verification.apple_pay.status: "verified"`. Not resubmitted, not
touched.

## H. Paddle checkout evidence

**Not attempted this pass.** Opening a live Paddle checkout overlay on `app.crawlpact.com`
requires browser automation (none connected to this session — confirmed by direct tool-catalog
search) or the owner's own live interaction. Server-side price resolution (`plan-mapping.ts`) is
unchanged by PR #173 and was not touched. **Blocks Phase 4** per the directive's own gate list —
genuinely not performed, not assumed passing.

## I. Google configuration and E2E evidence

**Cannot verify or perform.** No Google Cloud/OAuth Console MCP or equivalent tooling is
connected to this session (confirmed by direct probe, consistent with every earlier Phase 3
finding). Whether `https://app.crawlpact.com` is registered as an Authorized JavaScript Origin
remains unknown to this session. Real Google Sign-In E2E requires both that configuration and
either browser automation (unavailable) or the owner's live interaction. **Blocks Phase 4.**

## J. WebAuthn evidence

`WEBAUTHN_RP_ID=crawlpact.com` reconfirmed live on the deployed production Worker, unchanged.
Origin-pinning code (`auth/webauthn.ts`) untouched by PR #173. Full unit + security suites green
(CI run [34489405944](https://github.com/rmtlbandara/CrawlPact/actions/runs/34489405944)'s
sibling CI run on `main` — see Section S). The existing pre-migration passkey continuity PASS
(real human test, Phase 3) is carried forward unchanged, since nothing WebAuthn-relevant changed.
**New**-passkey registration/authentication against the live app origin was **not performed this
pass** — it requires a physical authenticator and either browser automation (unavailable) or the
owner's live interaction. **Blocks Phase 4's own stated RISK-036 acceptance criteria.**

## K. Session-cookie evidence

**Not independently re-proven live this pass** — requires a real authenticated browser session,
unavailable to this session. Source-level guarantee re-read and confirmed unchanged:
`buildSessionCookie`/`buildClearedSessionCookie` in `apps/web/src/lib/auth/session.ts` remain
host-only (`Path=/`, `HttpOnly`, `Secure` outside local, `SameSite=Lax`, no `Domain` attribute) —
zero lines of that file were touched by PR #173. "Expected by code reading" and "verified live" are
kept distinct, per this repo's own established practice. **Blocks Phase 4's own stated RISK-036
acceptance criteria.**

## L. CSRF live evidence

Server-level integration suite (`csrf.integration.test.ts`, 4 sibling-origin tests) passes,
unchanged, confirmed green in this pass's CI run. **Live proof against a real authenticated
session was not performed** — same limitation as Section K. **Blocks Phase 4's own stated
RISK-036 acceptance criteria.**

## M. Recovery/authenticated-app evidence

**Not performed this pass.** Recovery-code validation and authenticated `/app`/`/admin` smoke
both require a real authenticated session (browser automation unavailable, or the owner's live
interaction). Nothing in PR #173 touches recovery or authenticated-app code paths.

## N. Audit/pricing continuation evidence

**Not performed this pass.** The public-audit-to-app-sign-in continuation flow and the
pricing→sign-in→billing flow both require a real, live, multi-step browser session. Nothing in
PR #173 touches continuation, pricing, or billing code paths — Phase 2/3's existing evidence for
these flows is unchanged and carried forward, but not independently re-proven live this pass.

## O. SEO/GSC

**Cannot verify.** No Search Console MCP/API tooling connected (confirmed by probe). Does not
block Phase 4 on its own (SEO hygiene, not a security/auth gate) but should be resolved before
customer traffic moves.

## P. GA4/Clarity

**Cannot verify with connected tooling this pass** (no GA4/Clarity API access). Source-level
guarantee unchanged: `AuthLayout` (used by both `/` and `/sign-in` on the app host) has no GA/
Clarity import, structurally — unmodified by PR #173.

## Q. CrUX/Lighthouse

CrUX: not queried this pass (no connected tooling). Lighthouse: the Preview deploy's own budget
check ran and passed against this exact SHA (Section E) — no material performance regression
introduced by this reconciliation's changes (route-registry.ts logic and env-schema validation
are both effectively invisible to page-load performance).

## R. Monitoring/observability

**Not assessed or changed this pass.** Phase 3 previously found Workers Observability/Logs
disabled; this pass neither enabled it nor built an alternative. This remains an open item for
Phase 4 planning — Phase 4 must not begin with zero cutover-monitoring signal, but implementing
that is a distinct, unauthorized-this-pass change, not something to do incidentally here.

## S. Quality/CI

Fresh CI run against the exact deployed commit (`b23e176`), not reused from before deployment:

- Run [34485586428](https://github.com/rmtlbandara/CrawlPact/actions/runs/34485586428) on `main`:
  first attempt had 1 job (`Chromium E2E + accessibility smoke`) fail with 2 timeout errors in
  `home.spec.ts`'s passkey sign-in/registration setup helpers — nothing in PR #173's diff touches
  auth flows, hydration helpers, or that test file. Re-ran the failed job in isolation per this
  repo's own established evidence standard for the known Miniflare/D1 resource-contention
  flakiness pattern: came back fully green (`format/lint/typecheck/unit/integration/build`,
  `Chromium E2E + accessibility smoke`, and the aggregate `CI` gate all `success`). Confirmed as
  pre-existing flakiness, not a regression, by reproduction + isolated rerun, not by assumption.
- `pnpm db:validate`: 56/56 tables consistent (verified earlier this pass on the identical tree).
- Full local suite (format/lint/typecheck/unit 677/677/integration 394/394/security 45/45/build)
  was run and green on this exact tree before it was ever merged (see PR #173's own history) —
  not re-run a third time locally post-deploy, since CI already re-validated the identical
  post-merge commit fresh.

## T. Residual non-blocking risks

- Production `workers.dev` remains enabled — redundant exposure, not a broken boundary; held for
  explicit owner sign-off (Section F).
- `WEBAUTHN_RP_ORIGIN` legacy field remains bound and unread for verification — harmless while
  retained, decision on removal deferred to the Phase 4 rollback-window.
- `/dev/components` runtime-protection finding from Phase 1 was not re-checked this pass
  (unrelated to the app-subdomain migration specifically) — should be tracked to closure
  independently rather than silently dropped.
- Cloudflare Managed WAF is unavailable on this account's Free plan (a cost/plan decision, not a
  technical gap this migration created or can close).
- The Browser Integrity Check exception for `app.crawlpact.com` remains exactly as Paddle approved
  it — intentionally not touched. Recorded as a **non-blocking post-migration hardening item**:
  reassess only after Phase 4 cutover has completed successfully and the application has
  stabilized, preferring to test restoration of BIC on `/sign-in` first (see
  `docs/deployment/CLOUDFLARE_CONFIGURATION.md`'s dedicated section).

## U. Exact Phase 4 switch inventory

Not executed this pass — listed for future planning only:

- Header "Sign in" / "Create account" CTA destinations
- Pricing-page CTAs
- Public audit CTA
- Email/notification app-links
- `/sign-in`, `/app`, nested legacy `/app/*` route retirement/de-prefixing
- API wrong-host retirement
- Google apex-origin eventual cleanup (once app-origin-only is proven stable)
- WebAuthn migration-window narrowing (removing dual-origin compatibility)
- Stale environment/config cleanup (`WEBAUTHN_RP_ORIGIN`, etc.)
- The permanent apex→app redirect itself

## Summary

Since the last reconciliation pass, Paddle approval closed — independently confirmed via API, not
just the owner's screenshot — and PR #173 (the alias fix, env-schema tightening, and Preview
WebAuthn correction) is now live in Production, validated on both apex and app hostnames with the
exact same rigor used throughout this migration. The Cloudflare BIC exception that unblocked
Paddle was deliberately left untouched, as instructed, and is now documented as an intentional,
load-bearing configuration rather than a temporary workaround.

What remains is not a list of unknowns — it is a short, specific, already-enumerated list of items
that need either tooling this session doesn't have (Google OAuth console, GSC, GA4, CrUX) or the
owner's own live interaction (Paddle checkout, Google Sign-In, new-passkey registration, cookie
and CSRF live proof, recovery, authenticated smoke, continuation flows). Phase 4 has not started
and will not start until those close.
