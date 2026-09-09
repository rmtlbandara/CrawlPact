# Application-Origin Implementation — Phase 2

Date: 2026-09-09. Summary of what Phase 2 built against the Phase 1 contracts in
`docs/baseline/2026-09-09-app-subdomain-phase1/`. Full detail per area lives in this folder's
companion documents; this is the integration overview.

## What was built

| Area                             | Implementation                                                         | Detail                                                                                                                                                                                                                          |
| -------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trusted origin/host model        | `apps/web/src/lib/origin.ts` (new)                                     | `getPublicOrigin`/`getAppOrigin`/`getTrustedOrigins`/`isTrustedOrigin`/`classifyOrigin`/`classifyRequestOrigin`/`getValidatedRequestOrigin`/`toPublicUrl` — the single source of truth every other Phase 2 change reads through |
| Route ownership (executable)     | `apps/web/src/lib/route-ownership.ts` (new)                            | `isPublicOnlyPath` (reuses `route-registry.ts`'s canonical-slash lists), `isSensitivePath`                                                                                                                                      |
| Worker-level host boundary       | `apps/web/src/worker.ts` (extended)                                    | See `HOST_ROUTING_IMPLEMENTATION.md`                                                                                                                                                                                            |
| Static Assets enforcement        | `apps/web/wrangler.jsonc` production `assets.run_worker_first`         | See `STATIC_ASSET_HOST_ENFORCEMENT.md`                                                                                                                                                                                          |
| CSRF                             | `apps/web/src/lib/auth/same-origin.ts` (redesigned)                    | See `CSRF_ORIGIN_ENFORCEMENT.md`                                                                                                                                                                                                |
| WebAuthn origin pinning          | `apps/web/src/lib/auth/webauthn.ts` + 6 call sites                     | See `WEBAUTHN_ORIGIN_PINNING_IMPLEMENTATION.md`                                                                                                                                                                                 |
| Dedicated AuthLayout             | `apps/web/src/layouts/AuthLayout.astro` (new), `sign-in.astro` updated | See `AUTH_LAYOUT_AND_ANALYTICS_BOUNDARY.md`                                                                                                                                                                                     |
| App-host `robots.txt`            | `apps/web/src/pages/robots.txt.ts` (extended)                          | Host-aware: app surface gets its own disallow-all, no sitemap line                                                                                                                                                              |
| Conversion-flow link correctness | `apps/web/src/pages/feed/[token].xml.ts`                               | Embedded dashboard deep-links now prefer `PUBLIC_APP_URL` when configured (Phase 1's flagged finding)                                                                                                                           |

## Deliberate scope decision: no physical URL de-prefixing

Phase 1's ADR-0010 explicitly left full clean-URL de-prefixing (`app.crawlpact.com/domains`
instead of `.../app/domains`) **undecided** — "deferred, not rejected outright... not decided
here." Phase 2 makes that decision explicitly now: **de-prefixing is deferred beyond Phase 2**.

What Phase 2 _does_ implement:

- `app.crawlpact.com/` internally rewrites to the existing `/app` dashboard-or-sign-in-redirect
  implementation — this one case is unavoidable, since `/` is otherwise the public homepage in
  this build (see `HOST_ROUTING_IMPLEMENTATION.md`).
- `/sign-in`, `/admin/**`, `/api/**` already live at those exact unprefixed paths today, so they
  work correctly on the app host with no rewrite needed at all.
- `app.crawlpact.com/app/**` (the dashboard) continues to work at its current physical path.

What Phase 2 does **not** implement: `app.crawlpact.com/domains` (bare, de-prefixed) does not yet
resolve. A visitor must use `app.crawlpact.com/app/domains`. This is a real, intentional interim
state, not an oversight — implementing a general prefix-rewrite layer (query/method/body
preservation, loop prevention, forgery-proofing) for every dashboard path was judged
disproportionate scope for this phase relative to the directive's own permission to keep the
compatibility layer minimal ("do not force a risky physical source-tree rewrite... schedule
physical route cleanup separately"). Recommended for a future phase, not blocking Phase 3.

## Non-goals restated (unchanged from Phase 1/the Phase 2 directive)

No Cloudflare Custom Domain attached, no production redirects enabled, no WebAuthn origin
narrowed, no Paddle/Google external action taken, no CORS introduced, no second Worker, no
Cloudflare Pages project, no canonical/pricing/product changes. See `PHASE_2_COMPLETION_REPORT.md`
section N for the explicit production-impact statement.
