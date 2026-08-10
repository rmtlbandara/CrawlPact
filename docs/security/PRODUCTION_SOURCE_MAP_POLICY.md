# Production Source Map Policy

**Level 1 document (Current authoritative).** Phase 13.

## Policy

No publicly-accessible production browser source map containing original TypeScript/source is
served. Client bundle privacy is not treated as an access-control mechanism regardless (see
`docs/governance/PUBLIC_PRIVATE_INFORMATION_CLASSIFICATION.md` "What cannot be made private") —
this policy is about not gratuitously handing out original source structure/comments, not about
relying on obscurity for security.

## Current state (verified this phase)

`apps/web/dist/client` (the publicly-served build output) contains **zero `.map` files**, and no
`.js`/`.css` file in that directory contains a `sourceMappingURL` comment — confirmed by direct
inspection of a real build. `apps/web/dist/server` (the SSR Worker bundle, never served to
browsers) was also checked and is clean.

This is Astro/Vite's own default behavior for a production build (client sourcemaps are opt-in,
not opt-out) — no explicit CrawlPact configuration currently disables them, meaning a future
`astro.config.mjs`/Vite config change that enables `build.sourcemap` could silently regress this.

## Enforcement

`pnpm repo-privacy:validate` checks `apps/web/dist/client` for `.map` files and
`sourceMappingURL` references whenever it's run after a build — wired into `scripts/verify-push.sh`
(runs both pre- and post-build) and `.github/workflows/ci.yml` (runs both pre- and post-build, so
CI actually exercises the post-build check against a real build artifact on every PR).

## If internal debug source maps are ever needed

Internal build/debug source maps may be generated and securely retained (e.g. uploaded to
Cloudflare's own internal observability tooling) if a genuine debugging need arises — but never
written into `apps/web/dist/client`, and never served by a public route. This has not been needed
to date.
