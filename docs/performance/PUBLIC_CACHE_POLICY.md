# Public cache policy

Stage 11F/11G (Phase 11, Database, Storage, Retention and Performance Hardening). What this
codebase caches, how, why each category is safe, and — the load-bearing decision this document
records — why Cloudflare's Workers Cache feature is deliberately **not turned on** yet, even
though the header-level groundwork for it is now in place.

## Two independent caching layers in this codebase

1. **Prerendered marketing pages** (home, guides, crawler directory, platform pages — every file
   with `export const prerender = true`, 24 pages as of this phase). These are static HTML served
   directly off the Workers Assets binding (`apps/web/wrangler.jsonc`'s `assets` config) and never
   invoke the Worker or its middleware at all. Their headers come from `apps/web/public/_headers`,
   not from any code path this document changes. Cloudflare's Assets binding already applies its
   own default caching to these (content-addressed, immutable build output) — no application code
   controls or needs to control that; it is out of scope here.
2. **SSR responses** (everything else — `output: "server"` is this app's default, 42 pages plus
   every `/api/*` route as of this phase). These run through `apps/web/src/middleware.ts` on every
   request. This document is about this layer.

## The deny-by-default default (implemented this phase)

`middleware.ts` now sets `Cache-Control: private, no-store` on every SSR response that doesn't
already carry its own `Cache-Control` header. Before this phase, SSR responses carried no
`Cache-Control` at all — harmless _today_ only because Cloudflare Workers Cache
(`cache.enabled` in `wrangler.jsonc`) has never been turned on for this Worker. That header-less
state was quietly one config flag away from a real problem: per Cloudflare's own documented
behavior, **a response with no `Cache-Control` header is not "uncached" once Workers Cache is
enabled** — RFC 9111 heuristic freshness applies, and a bare `200` response is cached for up to 2
hours by default. Every `/admin/*`, `/app/*`, `/audit/*`, `/shared/*`, and `/api/*` response was
one flag flip away from being briefly, silently cacheable — a real cross-user data-leak shape.
Deny-by-default closes that regardless of whether or when caching is ever turned on.

Verified in `apps/web/src/middleware.test.ts`: a route that sets no `Cache-Control` gets
`private, no-store`; a route that already set its own (the public opt-ins below) is never
overridden; this applies identically to HTML pages, `/admin/*`, and `/api/*` JSON responses.

## Explicit public opt-ins (the only routes this phase made cacheable)

Each of the following sets its own `Cache-Control: public, max-age=N` **before** the middleware
default would apply — every one was individually read in full to confirm it renders identical
content for every visitor (no `getPageSession`/cookie/auth-state branching) before being added:

| Route               | TTL                           | Why it's safe                                                                                                                                                                                                                                                            |
| ------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/status.astro`     | 30s (pre-existing, unchanged) | Public system status, identical for everyone; short TTL because service health should read fresh.                                                                                                                                                                        |
| `/changelog.astro`  | 300s                          | Reads `registryVersions` from D1, but the result is identical for every visitor — no session read.                                                                                                                                                                       |
| `/scanner.astro`    | 300s                          | Reads only an env flag (`AUDIT_ENGINE_ENABLED`), not per-request/per-user state.                                                                                                                                                                                         |
| `/for/[slug].astro` | 300s                          | Reads live `getPlanCatalog()` from D1 (Phase 7's vertical pages), but the result is identical for every visitor per slug — no session read. Also directly reduces the D1 read this page makes per-request once caching is enabled (see the SSR/D1-reduction note below). |

Verified in `apps/web/src/middleware.test.ts` via static source checks (the same pattern
`security-headers.test.ts` already uses for `public/_headers` — an Astro page can't be rendered
inside this repo's vitest suite, so presence-in-source is the honest limit of what's testable here
without a real Astro render).

**`/pricing.astro` was considered and explicitly excluded.** It reads `getPageSession()` and
branches its rendered output on whether the visitor is signed in
(`isAuthenticated={session !== null}`, a conditional block rendered only for signed-in visitors).
Caching it publicly would risk serving one visitor's authenticated view to another — exactly the
cross-user leak this whole policy exists to prevent. It keeps the safe `private, no-store` default.

## Why Workers Cache (`cache.enabled`) is not turned on this phase

Cloudflare's Workers Cache is a real, distinct feature (`wrangler.jsonc`'s `cache.enabled`,
confirmed via Cloudflare's own docs this phase — not previously configured anywhere in this
repo) that, once enabled, checks the cache **before invoking the Worker on every single request**
for this single-default-export Worker (this codebase has no named entrypoints to scope it to).
Enabling it is safe _in principle_ now that the deny-by-default header discipline above exists,
but this phase stops short of flipping it on, for reasons specific to this session rather than a
general objection:

1. **No real edge-cache verification is possible from this sandboxed session.** Workers Cache is
   Cloudflare's own edge infrastructure — it cannot be exercised by this repo's Miniflare-backed
   test harness, only by a real deployed Worker (`Cf-Cache-Status` response header). The header
   correctness above is fully verified; the _actual caching behavior it would enable_ is not, and
   this phase's own "measure before optimizing" discipline says that gap should be closed with a
   real preview-environment check before flipping a Worker-wide flag that changes caching
   behavior for every route simultaneously — not assumed correct from documentation alone.
2. **Blast radius.** A misconfiguration here (a route that should be public and isn't, or worse, a
   route that ends up cacheable and shouldn't) affects every visitor at once, immediately, with no
   gradual rollout. That is a materially different risk profile from every other change in this
   phase, which is why it gets a higher verification bar rather than being bundled in casually.
3. **CLAUDE.md's standing rule**: deployments and infrastructure-behavior changes with this kind
   of blast radius get fresh, explicit, in-the-moment approval — this document records the
   groundwork as done and ready, and defers the flag itself to that approval point (Stage 11I
   preview verification, or a dedicated follow-up), rather than bundling an unverified
   infrastructure-behavior change into a large phase merge.

## What turning it on later actually requires (so it's not new design work)

1. Add `"cache": { "enabled": true }` to `apps/web/wrangler.jsonc` (both production and preview
   environments).
2. Deploy to preview first. For each route category above (public opt-in, admin, app, api,
   shared-report), issue two requests and confirm `Cf-Cache-Status`: `MISS` then `HIT` for the
   public opt-ins; `BYPASS` for everything else (per Cloudflare's own documented bypass rule for
   `private`/`no-store` responses).
3. Specifically re-verify `/shared/[token].astro` and `/audit/[auditId].astro` — both are
   "public" in the sense of requiring no login, but carry per-recipient/per-audit sensitive
   content keyed by an unguessable token/id in the URL itself, not a cookie. They correctly get
   the safe `private, no-store` default today (confirmed: neither sets its own `Cache-Control`),
   but because their sensitivity is URL-keyed rather than cookie-keyed, they deserve an explicit,
   deliberate "still correctly bypassed" check before caching is ever enabled — cookie-based
   automatic-bypass reasoning does not apply to them the way it does to `/admin`/`/app`.
4. Only after that preview verification passes does this become a production deploy, under the
   same fresh-explicit-approval rule as any other production change.

## SSR/D1 read reduction for vertical pages — which mechanism was chosen, and why not the others

The Phase 11 prompt named three candidate mechanisms for reducing `for/[slug].astro`'s live
`getPlanCatalog()` D1 reads (roughly 8 reads/request — 2 queries × 4 plans): a bounded Cache API
layer, a versioned catalog cache, or per-invocation memoisation. This phase implements none of
those directly — it reduces the read _frequency_ instead, via the public Cache-Control opt-in
above. Once Workers Cache is enabled (see above), repeat requests to the same vertical-page URL
are served entirely from the edge without the Worker — and therefore `getPlanCatalog()` — running
at all, which is a strictly larger reduction than any of the three named alternatives would
achieve on their own:

- **Per-invocation memoisation** was checked and found to add nothing here — `getPlanCatalog()` is
  already called exactly once per request in this file (confirmed by reading it in full), so there
  is no _intra-request_ duplicate call to memoise away.
- **A bounded Cache API (`caches.default`) layer** was considered and deliberately not built this
  phase: it would need its own cache-key/versioning design to avoid the exact failure mode the
  prompt itself warns against (serving a stale price after a real `plan_prices` change), and its
  actual behavior — like Workers Cache — cannot be verified from this session's sandboxed test
  harness, only from a real deployed Worker. Layering a second, unverified caching mechanism on
  top of the header-level one above would add risk without a measured need: at today's near-zero
  real traffic (Stage 11A baseline), this page's D1 read cost has no measured impact to fix.
- **A versioned catalog cache** is effectively what enabling Workers Cache already gives this
  page for free once turned on — the "version" is the URL, and Cloudflare invalidates on
  TTL expiry, not on a manually-maintained version counter this codebase would need to keep
  correct.

If real measured traffic later shows this page's D1 read cost matters _independent_ of whether
Workers Cache is enabled (e.g., a future phase decides not to enable edge caching after all), the
Cache API option above is the next thing to build — its design considerations are recorded here so
that decision doesn't start from zero.

## What this phase did not need to touch

Every other SSR route (`/admin/*`, `/app/*`, `/api/*`, `/audit/*`, `/shared/*`, `/pay`,
`/sign-in`) was already correctly private in intent — this phase's contribution was making that
_enforced_ (deny-by-default) rather than _incidental_ (simply never having set a public header),
which is the difference that actually matters once/if Workers Cache is ever enabled.
