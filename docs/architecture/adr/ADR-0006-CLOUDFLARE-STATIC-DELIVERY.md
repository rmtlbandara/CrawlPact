# ADR-0006: Cloudflare Static Delivery Strategy (Workers Static Assets vs. Pages)

**Status:** Accepted
**Date:** 2026-07-26
**Owner:** Solo founder / Claude Code
**Supersedes:** Formalises and expands ADR-0001's "Static Asset Strategy" section; does not
change that decision.

## Context

The approved Cloudflare infrastructure plan asks for an explicit, evidence-based decision
between two static-delivery architectures:

- **Option A — one Worker + Workers Static Assets** (CrawlPact's current implementation, per
  ADR-0001).
- **Option B — split static marketing pages into a separate Cloudflare Pages project.**

The plan is explicit that Pages must not be chosen "merely because the plan advertises Pages,"
and that the simplest option preserving same-origin security, passkey reliability, SEO, static
performance, and preview isolation should win.

### Verified current facts informing this decision

From `docs/deployment/CLOUDFLARE_ARCHITECTURE_AUDIT.md` (Phase 1 audit, 2026-07-26):

- CrawlPact already runs as a single Cloudflare Worker with Workers Static Assets
  (`assets: { directory: "./dist", binding: "ASSETS" }`, `apps/web/wrangler.jsonc:6-10`).
  Astro's built output is served directly; unmatched routes fall through to SSR.
- Same origin serves the public marketing site, the authenticated customer app, the Super Admin
  shell, and all `/api/**` endpoints — one domain, one cookie jar, one CSRF/WebAuthn origin.
- Passkey authentication (ADR-0004) validates `rpId`/origin against the exact page origin during
  every WebAuthn ceremony.

From `docs/deployment/CLOUDFLARE_RESOURCE_LIMITS.md` (Phase 0 verification, 2026-07-26):

- Workers Static Assets on the Free plan: 20,000 files per Worker version, 25 MiB per file — far
  more than CrawlPact's current static output needs.
- Cloudflare Pages, by contrast, states plainly that "requests to static assets are free and
  unlimited" — but **only** for requests that do not invoke a Pages Function. This is a genuine,
  real advantage Pages has that Workers Static Assets does not automatically share: a Workers
  Static Assets response is served by the same Worker that also handles SSR/API traffic, so (as
  far as this ADR could verify) it draws from the same shared 100,000-requests/day Workers Free
  budget that the audit form, dashboard, and API endpoints also draw from. **This specific
  request-accounting interaction (whether Cloudflare's edge cache in front of Workers Static
  Assets serves repeat hits without touching the Worker's own request counter) was not
  independently verified against a dedicated official source during this pass** — flagged
  honestly rather than asserted either way. It is the one technical point that could argue for
  Pages if static-asset traffic ever becomes a meaningful fraction of the 100,000/day ceiling.

## Decision

**Continue with Option A: one Cloudflare Worker plus Workers Static Assets.** Do not introduce a
second Cloudflare Pages project for CrawlPact's marketing pages.

This reaffirms ADR-0001's existing choice; it does not change it. The reasoning is unchanged and,
if anything, strengthened by two Parts of real production build-out since ADR-0001 was written:
passkey authentication (ADR-0004), CSRF protection, and the Super Admin shell all now depend on
same-origin behaviour in ways that were only theoretical when ADR-0001 was accepted.

## Alternatives Considered

### Option B — split static marketing pages into Pages

**Potential advantages** (per the plan's own list): git-based Pages preview workflow; separate
static-site deployments; independent public-content deployment; unlimited, request-limit-exempt
static-asset serving (see the flagged caveat above).

**Disadvantages that make this the wrong choice for CrawlPact today:**

- **Same-origin security breaks.** Marketing pages (`crawlpact.com`) and the app/API
  (currently also `crawlpact.com`) would need either two domains (breaking the shared session
  cookie ADR-0004 relies on) or a subdomain split (`www.crawlpact.com` for Pages,
  `app.crawlpact.com` for the Worker) plus cross-origin CORS/cookie configuration for anything
  that needs both — e.g. the homepage's audit form, which posts to `/api/audit` same-origin
  today (`apps/web/src/pages/index.astro`, `AuditForm.tsx`).
- **WebAuthn origin fragmentation.** `WEBAUTHN_RP_ID`/`WEBAUTHN_RP_ORIGIN` are pinned to one
  origin (ADR-0004, `docs/deployment/CLOUDFLARE_CONFIGURATION.md`). Splitting marketing content
  onto a Pages subdomain while sign-in/app/admin stay on the Worker's origin doesn't break
  passkeys directly (the RP ID would still point at the Worker's domain), but it does mean the
  "one origin, one config" simplicity ADR-0001/0004 were built around is gone — two deploy
  targets, two sets of environment variables, two places a misconfiguration could diverge.
- **CSRF handling doubles up.** CrawlPact's CSRF defence (`docs/security/THREAT_MODEL.md`) is
  Origin/Referer-based against a single expected origin; a two-origin architecture means either
  loosening that check to accept both origins (weakening it, which ADR-0005/security review
  would need to re-approve) or proxying all mutating requests back through one origin anyway —
  at which point the split has bought no real isolation.
- **Preview-environment consistency breaks.** Today, one `wrangler.jsonc` `env.preview` block
  gives a single, consistent preview environment for the whole app (`ADR-0001`,
  `docs/deployment/CLOUDFLARE_CONFIGURATION.md`). A Pages split would mean two independent
  preview systems (Pages' own git-branch previews vs. Workers' `env.preview`) that would need to
  be kept in sync manually, or accept that "preview" means something different for marketing
  pages than for the app — a real, avoidable maintenance burden for a solo founder.
- **Duplicate configuration and operational documentation.** Two `wrangler`/Pages configs, two
  sets of environment variables, two deploy commands, two places for secrets/D1 bindings to be
  (correctly or incorrectly) wired.

None of Option B's advantages solve a problem CrawlPact actually has today. The one genuine
technical edge (unlimited, request-budget-exempt static serving) is a real consideration **only**
if the Workers Free 100,000-requests/day ceiling becomes a binding constraint from static-asset
traffic specifically — which, for a pre-launch product with no real production traffic yet, is
not the case, and is a narrower, revisitable question (see "Effects" below) rather than a reason
to adopt a second deployment architecture today.

## Effects

- **Request-accounting effect:** Workers Static Assets responses are believed to draw from the
  same shared Workers Free 100,000-requests/day budget as all other traffic to this Worker (SSR,
  API, cron-internal fetches do not count here, only inbound HTTP hits do — see
  `CLOUDFLARE_RESOURCE_LIMITS.md` #1). This was not independently confirmed against a dedicated
  official source distinguishing "Workers Static Assets served via Cloudflare's edge cache" from
  "a fresh Worker invocation" — flagged as a concrete follow-up verification item, not asserted.
  If it turns out cached static hits are exempt (as they likely are, given Cloudflare's CDN
  caches static assets at the edge the same way it does for any other cacheable response), this
  section should be updated once confirmed.
- **SEO effect:** No change — prerendered marketing pages (`prerender = true` in `apps/web/src/pages/**`)
  continue to be built statically and served identically regardless of this decision; SEO
  behaviour is a function of Astro's static output and `BaseLayout.astro`'s metadata, not of
  which Cloudflare product serves the resulting files.
- **WebAuthn effect:** No change — RP ID/origin remain pinned to the single Worker domain,
  avoiding the fragmentation risk described above.
- **Preview effect:** No change — `env.preview`'s existing D1/vars separation (ADR-0001, Part 3
  Step 26 fix) continues to be the one and only preview mechanism.
- **Cost effect:** No change in Cloudflare product cost (Workers Static Assets has no separate
  charge on Free or Paid); the real cost driver remains Worker CPU time for SSR/API/scan work
  (see `docs/operations/SCAN_CAPACITY_BUDGET.md`), which this decision does not affect either way.
- **Migration cost:** Zero today (no migration performed). If ever revisited, migrating marketing
  pages to Pages later would require: a second Cloudflare project, DNS/subdomain planning, CORS
  and CSRF-origin-list changes, and duplicating (or service-binding) the shared design-system
  package (`packages/ui`) into the Pages build — a non-trivial but bounded effort, not a rewrite.
- **Rollback path:** Not applicable — no change was made; this ADR only formalises and evidences
  the status quo.

## Migration Path (if ever revisited)

Introduce a Cloudflare Pages project for `apps/web`'s prerendered routes only, keep `apps/web`'s
Worker serving SSR/API/admin under a distinct subdomain, add that subdomain to the CSRF
allowed-origin list, and write a new ADR superseding this one — trigger conditions: (a) verified
confirmation that Workers Static Assets requests meaningfully consume the shared request budget
**and** static-asset traffic alone approaches a material fraction of 100,000/day, or (b) marketing
content velocity/authoring needs (e.g. non-engineer content editors wanting git-based preview
links) that the current single-repo, single-deploy model cannot reasonably serve.
