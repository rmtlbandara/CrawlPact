# CDN Cache Policy

**Status:** Policy defined 2026-07-26 (Phase 13 of the Cloudflare infrastructure-alignment brief).
**Implementation status:** Not yet implemented. This document defines the intended policy; adding
explicit `Cache-Control` headers to match it is deferred to a follow-up pass (see
`docs/status/IMPLEMENTATION_STATUS.md`), since it is a code change and was explicitly out of scope
for this documentation/analysis pass.

## Current state (as audited)

Per `docs/deployment/CLOUDFLARE_ARCHITECTURE_AUDIT.md`: Astro's build for `@astrojs/cloudflare`
auto-generates a `_headers` file giving hashed static assets under `/_astro/*` an immutable,
`max-age=31536000` (one year) `Cache-Control` header. **No explicit cache-header configuration
exists for anything else** — every SSR/dynamic response uses whatever default caching behaviour
Cloudflare/Astro apply, which has not been audited for correctness against the sensitivity rules
below. This is a real, disclosed gap (already tracked in
`docs/performance/PERFORMANCE_AND_COST.md`), not newly introduced by this document.

## Policy

### Long-lived immutable cache (already correctly implemented)

Applies to: hashed JavaScript, hashed CSS, versioned images, favicons, public brand assets — i.e.
anything under `/_astro/*` or any future content-hashed static path.

- `Cache-Control: public, max-age=31536000, immutable`
- Already correct today via Astro's Cloudflare adapter's auto-generated `_headers`. No change
  needed.

### Controlled public cache (not yet implemented — a real gap)

Applies to: homepage, pricing, guides, crawler directory pages, methodology, public changelog —
i.e. every `prerender = true` marketing/content route (23 files per the architecture audit).

- **Intended policy**: `Cache-Control: public, max-age=<short>, stale-while-revalidate=<longer>`
  (e.g. `max-age=300, stale-while-revalidate=3600` as a starting point) for prerendered content
  that changes only on redeploy, so Cloudflare's edge can serve repeat requests without hitting
  the Worker at all.
- **Invalidation**: since these are prerendered (built once, then static until the next deploy),
  a new deploy naturally invalidates old cached responses once the edge cache's TTL expires — no
  explicit purge mechanism is required for content correctness, only a bounded staleness window
  (the `max-age` above) between deploy and full cache turnover.
- **Not yet implemented**: no explicit header is set on these routes today; they currently rely on
  Cloudflare/Astro defaults, which have not been verified to match this intended policy. This is
  the concrete follow-up action this document identifies.

### Never publicly cache (security-critical — must be verified, not assumed)

Applies to: customer dashboard (`/app/**`), account pages, passkey/sign-in routes, billing routes,
Super Admin (`/admin/**`), private reports (`/audit/[auditId]`), Atom feeds
(`/feed/[token].xml`), shared reports containing private data (`/shared/[token]`), Paddle webhooks
(`/api/billing/webhook`), any future authenticated R2 downloads, audit API results
(`/api/audit/**`).

- **Intended policy**: `Cache-Control: private, no-store` on every one of these routes.
- **Why this matters more than the "controlled public cache" gap**: the brief's explicit,
  named failure mode is "one user receives another user's private audit result through CDN
  caching." A shared-report route (`/shared/[token].astro`) or an authenticated report view
  (`/audit/[auditId].astro`) being cached at Cloudflare's edge — even briefly, even
  unintentionally — could serve one visitor's response to a different visitor hitting the same
  URL path if the cache key doesn't account for the token/session correctly. **This has not been
  independently verified in this pass** (verifying response headers requires either a live
  deployment or a request-level test against the built Worker, both out of scope for a
  documentation-only pass) — it is recorded here as the single highest-priority item in the
  planned follow-up work, not as a confirmed-safe state.
- Astro's SSR responses (`prerender = false`) are not cached by Cloudflare's default edge-cache
  behaviour for dynamic Worker responses in the way static assets are — but this project-specific
  claim was not independently re-verified against a dedicated official source during this pass,
  and given the stakes (private data), it should be explicitly tested (real request, inspect
  response headers, confirm no `Cache-Control: public` or shared-cache-eligible header appears)
  before or during first production deployment, not assumed correct because it's "probably fine."

## What determines caching, per the brief's own framework

- **Anonymous vs. authenticated**: authenticated routes (`/app/**`, `/admin/**`) are never
  publicly cacheable regardless of content sensitivity, since a cached authenticated response
  could leak between sessions.
- **Sensitivity**: private report/billing/security content is never cacheable even if
  technically anonymous-reachable via a token (shared reports, Atom feeds) — the token itself is
  the secret, and caching risks exposing it to the wrong requester.
- **Staleness tolerance**: marketing/content pages tolerate a few minutes of staleness after a
  content update; nothing else does.
- **`noindex`**: routes marked `noindex` (app, admin, auth) should also not be publicly
  cached — the two properties usually travel together but are not the same thing, and both
  should be checked independently when a new route is added.
- **Target-specific content**: audit reports render content derived from a customer-supplied
  target domain — the response is unique per `auditId`/token, never safe to cache at a shared
  (non-per-URL) cache key even if the URL itself looks stable.
- **Cache-key privacy**: no cache key should ever be derived from anything that isn't already
  part of the public URL (i.e. never let a session cookie or auth header silently become part of
  what Cloudflare uses to decide cache-hit/miss) — Cloudflare's default cache key is
  URL + a few standard headers, which should be verified (not assumed) to exclude
  `Cookie`/`Authorization` for any route that must never be shared across users.
- **Report token security**: shared-report tokens (`sharing.ts`) are the access-control boundary
  for that route; caching must never bypass or weaken that boundary by serving a cached response
  to a request presenting a different (or revoked) token than the one that produced it.

## Testing (planned, not yet implemented)

The brief asks for response-header tests. These are deferred to the same follow-up pass as the
header implementation itself (Phase 13/20 code work), since testing headers that don't exist yet
would only assert the current (unverified) default behaviour rather than a deliberate policy. Once
implemented, tests should assert, per route category above: the exact `Cache-Control` value present
on marketing pages; `private, no-store` (or equivalent) present on every authenticated/private
route; and that two different tokens/sessions hitting structurally-identical URLs never receive
each other's cached response.

## Related documents

- `docs/deployment/CLOUDFLARE_ARCHITECTURE_AUDIT.md` — current-state evidence this policy is
  built on.
- `docs/performance/PERFORMANCE_AND_COST.md` — the pre-existing, disclosed "no Cache-Control layer"
  gap this document formalises a policy for.
- `docs/status/KNOWN_RISKS.md` — tracks the deferred implementation as an open item.
