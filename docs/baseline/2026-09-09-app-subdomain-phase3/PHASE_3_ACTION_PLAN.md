# Phase 3 Action Plan — Prepared, Not Executed

Date: 2026-09-09. This is the exact sequence Phase 3 requires, in order, each gated on the
previous step's evidence, per the Phase 3 directive's own critical safety principle (never attach
the app Custom Domain before the host-enforcement Worker is deployed and proven). **Nothing below
has been executed.** Each numbered step names who must authorize it and why.

## 1. Commit and push the Phase 1+2 work

**Needs: explicit go-ahead to commit, and a separate explicit go-ahead to push** (standing
instruction: never push without asking, even for a small follow-up, regardless of earlier
approvals in this conversation).

Proposed shape: one or a small number of logical commits on the current branch
(`fix/canonical-hash-fragment-links`) or a new branch, grouped roughly as (a) Phase 1 docs/ADR/
non-behavioral config, (b) Phase 2 implementation + tests, (c) Phase 3 docs as they're produced —
open to whatever grouping matches this repo's convention once confirmed. If this repo's practice
requires a reviewed PR before merge to `main` (CLAUDE.md doesn't state one either way), a PR would
be opened rather than pushed directly to `main`; the current branch already tracks
`origin/fix/canonical-hash-fragment-links`, so it may make sense to land there first and let the
existing review process apply the rest of the way — this itself is a repo-convention question
worth confirming rather than assuming.

## 2. Deploy to Preview

**Needs: explicit go-ahead to deploy.** Uses the existing `deploy-preview.yml` CI workflow (or the
equivalent local `pnpm deploy:preview`, per ADR-0007 — CI is preferred since it also runs binding
verification and smoke tests automatically). No new hostname, no new Worker — the existing
`crawlpact-web-preview` Worker and its existing D1/KV/R2.

After deploy: record the deployed commit SHA and Preview Worker version, then validate — public
Preview regression (representative pages, trailing-slash, headers, canonical), and the same for
the app-surface logic (simulated via the same techniques used in `worker.host-boundary.test.ts`,
now against the real deployed Worker rather than a mock). Preview does not yet have an
`app-preview.crawlpact.com` Custom Domain either (Phase 1 left this hostname as a documented
candidate, not provisioned) — provisioning it is itself a Cloudflare action requiring the same
authorization as step 4 below, just for Preview instead of production.

## 3. Deploy to Production (compatibility version — no Custom Domain change yet)

**Needs: explicit go-ahead to deploy to production**, separate from the Preview go-ahead. This is
the deployment `STATIC_ASSET_HOST_ENFORCEMENT.md` already flagged as a real, deployable production
behavior change (every prerendered page now runs through the Worker before being served) — it
changes real production traffic's request path even though it exposes no new hostname.

Immediately after: the full public-production regression check from the Phase 3 directive's
Workstream L (homepage, pricing, audit, sign-in, `/app`, crawlers, guides, tools, methodology,
status, privacy, terms, sitemap.xml, robots.txt, `/pay`) plus the existing-passkey/Google/recovery/
logout checks from Workstream M — proving the compatibility deployment itself didn't break
anything, before touching DNS at all.

## 4. Attach `app.crawlpact.com` as a Cloudflare Custom Domain

**Needs: explicit go-ahead**, and only after step 3's regression check is clean — this is the
Phase 3 directive's own non-negotiable ordering rule. DNS/TLS provisioning is automatic once
attached (same mechanism that provisioned `preview.crawlpact.com`); re-verify independently after
(DNS resolution, certificate, HTTPS, correct Worker response) rather than trusting the dashboard's
own success message.

## 5. Direct app-host validation

Once live: the host-boundary proof (a public page redirects, `/sign-in` and `/app` work,
unrecognized-host rejection still holds), cookie isolation, CSRF sibling-origin rejection — all
against the real domain this time. No additional authorization needed beyond step 4's, since this
is read/observe-only against infrastructure already authorized.

## 6. Google Authorized JavaScript Origin

**This session has no Google Cloud Console access at all — I cannot perform this step under any
authorization.** It must be done by the user directly: Google Cloud Console → the existing Web
OAuth Client → Authorized JavaScript origins → add `https://app.crawlpact.com`, keeping the
existing `https://crawlpact.com` origin in place. Tell me once done so validation can proceed.

## 7. The real existing-passkey continuity test

**This cannot be performed by me under any authorization — it requires physical interaction with
your own platform/hardware authenticator.** This is the single hard cutover gate the Phase 3
directive calls out explicitly (§31) as something a software/mocked test can never substitute for.
Once `app.crawlpact.com` is live (step 4) and reachable, I'll give you the exact URL
(`https://app.crawlpact.com/sign-in`) and walk through what to check; you complete the actual
sign-in with one of the 4 existing production passkeys, and report back what happened (success,
error, unexpected prompt) so I can record real evidence rather than a simulated stand-in.

## 8. Paddle checkout-domain submission

**Needs: explicit go-ahead**, only after step 5 confirms the app host is genuinely safe and stable
— submitting an unsafe/incomplete hostname for review would be the wrong sequencing (Phase 1/2
already deferred this for exactly that reason). No API exists for submission; it is a Paddle
Dashboard action. If I don't have Dashboard access, this is also an owner action with exact steps
recorded in `PHASE_3_EXTERNAL_ACTION_QUEUE.md` (Phase 2 evidence) — otherwise I can drive it
through the Paddle MCP tools available in this session once authorized, and will record the actual
resulting status (`pending_review`/`approved`/etc.), never representing a non-`approved` state as
approved.

## What I will not do regardless of authorization

Enable a permanent apex→app redirect, narrow WebAuthn to the app origin exclusively, remove apex
auth compatibility, change the WebAuthn RP ID, add `Domain=crawlpact.com` to the session cookie,
introduce CORS, create a second Worker or a Pages project, change Paddle products/prices/webhook
destination, or complete a real paid Paddle transaction merely to prove a checkout overlay opens.
These are Phase 4 actions or explicitly out of scope per the Phase 3 directive itself.
