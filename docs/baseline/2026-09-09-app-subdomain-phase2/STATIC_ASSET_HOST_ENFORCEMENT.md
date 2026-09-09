# Static Asset Host Enforcement — Phase 2

Date: 2026-09-09. Implements `CLOUDFLARE_HOST_BOUNDARY_DESIGN.md`'s selective `run_worker_first`
design in `apps/web/wrangler.jsonc`.

## The change

Production's `assets` block gained:

```jsonc
"run_worker_first": [
  "/*",
  "!/_astro/*",
  "!/branding/*",
  "!/og/*",
  "!/favicon.png",
  "!/og-image.svg",
],
```

Worker-first for every document/navigation path; asset-first (unaffected, fast) for the small set
of genuinely immutable, non-HTML, non-hostname-sensitive build assets — re-derived from
`apps/web/public/`'s actual contents at implementation time (`_astro/` hashed JS/CSS,
`branding/*`/`og/*` static images, root-level `favicon.png`/`og-image.svg`). Exactly mirrors
Cloudflare's own documented pattern for this exact use case
(`["/api/*", "!/api/docs/*"]`, confirmed against current Cloudflare documentation fetched live
during Phase 1).

Preview's pre-existing `run_worker_first: true` (blanket, not selective) is unchanged.

## Why this was necessary before anything else in Phase 2 could be safe

Without it, `app.crawlpact.com/about/` would match the same `dist/client/about/index.html` asset
`crawlpact.com/about/` serves, bypassing `worker.ts` (and therefore the new host-boundary logic)
entirely — the exact duplicate-content hard gate `CLOUDFLARE_HOST_BOUNDARY_DESIGN.md` exists to
close. This is why `HOST_ROUTING_IMPLEMENTATION.md`'s logic is meaningful: without this config
change, it would simply never run for the paths that matter most.

## Live evidence gathered before implementing (not assumed)

Before writing this config, `preview.crawlpact.com` — which has run `run_worker_first: true` in
real production since Phase 20 — was queried directly:

```
curl -sI https://preview.crawlpact.com/about/
```

confirmed that a prerendered page served through `run_worker_first` still carries the full,
correct security header set (`content-security-policy`, `strict-transport-security`,
`x-content-type-options`, `x-frame-options`, `referrer-policy`, `permissions-policy`), matching
`public/_headers`' declared policy exactly, plus the preview-specific `x-robots-tag: noindex`
stamp. A bare `/about` request correctly 301-redirected to `/about/`. This resolves the exact
ambiguity `CLOUDFLARE_HOST_BOUNDARY_DESIGN.md` flagged as unverified ("do not assume
`public/_headers` behavior is still applied") — it does, empirically, on this exact platform
configuration, for the exact mechanism Phase 2 now also applies to production.

## Trailing-slash regression prevention

`worker.ts`'s trailing-slash redirect (`needsTrailingSlashRedirectPreview`, reused unchanged) is no
longer gated to `PUBLIC_APP_ENV === "preview"` — it now runs unconditionally, since production's
`run_worker_first` array now intercepts the same prerendered paths preview always has. This
directly prevents the exact regression Phase 20 already discovered and fixed once for preview:
`run_worker_first` bypasses Cloudflare's edge-level `_redirects`/`html_handling` for any
asset-matched path it intercepts, so the Worker must reimplement the canonical trailing-slash
redirect itself rather than relying on `public/_redirects` (which remains in place, unused for
these paths on production going forward, still functioning for any request that somehow bypasses
`run_worker_first`, e.g., a future negative pattern gap — defense in depth, not removed).

## Deployment caution — not yet shipped

**This is a real, deployable production behavior change**: every prerendered page on
`crawlpact.com` will run through `src/worker.ts` before being served, once this configuration is
actually deployed. It has not been deployed in this phase — Phase 2 is implementation and local/CI
validation only (per the Phase 2 directive's explicit deployment boundary, §42). Deploying it
requires the user's separate, explicit authorization, consistent with CLAUDE.md's "never deploy to
production without explicit in-the-moment permission" rule — this applies even though the change
itself does not attach any new Custom Domain and does not expose `app.crawlpact.com`.

## Test evidence

`worker.host-boundary.test.ts` proves the _logic_ this config makes reachable is correct (see
`HOST_ROUTING_IMPLEMENTATION.md`). The config's actual runtime effect on Cloudflare's real asset
dispatcher (latency, Worker-invocation cost, and the exact header/redirect behavior under the
_production_ `run_worker_first` array specifically, as opposed to preview's blanket `true`) cannot
be measured from static evidence — per the Phase 1 design document's own acknowledgment, this
requires an actual preview or controlled-production deployment, which is a Phase 3 action.
