# `PUBLIC_SITE_URL` Usage Audit — App-Subdomain Migration Phase 1

Date: 2026-09-09. Every runtime, config, script, and test usage of `PUBLIC_SITE_URL` and hardcoded
`crawlpact.com` literals, classified. This resolves every `SURFACE_SPECIFIC`/ambiguous item raised
during investigation by direct reference to `ORIGIN_AND_ROUTE_OWNERSHIP_MATRIX.md`'s frozen
classifications. **No Phase 1 change alters any of this runtime behavior** — this is a
classification and forward-plan document only; `same-origin.ts`, `BaseLayout.astro`, `sitemap.xml.ts`,
etc. are unmodified.

Classification key: `KEEP_PUBLIC_SITE_URL` / `MOVE_TO_PUBLIC_APP_URL` / `DERIVE_FROM_REQUEST_ORIGIN`
/ `SURFACE_SPECIFIC` / `REMOVE` (out of scope, not a URL).

## Runtime code

| File:line                                                        | What it does                                                                                                                  | Classification                                                                                             | Phase 2/3 action                                                                                                                                                                                                                          |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/astro.config.mjs:10`                                   | `site: process.env.PUBLIC_SITE_URL ?? "https://crawlpact.com"` — Astro `site`, drives canonical/OG/sitemap base at build time | `KEEP_PUBLIC_SITE_URL`                                                                                     | None — this build stays the public site's build. A genuinely dual-origin canonical model (if ever needed) is out of scope; Phase 2 keeps one build serving both hosts, with runtime host-detection layered on top, not two `site` values. |
| `apps/web/src/layouts/BaseLayout.astro:44`                       | `Astro.site ?? new URL("https://crawlpact.com")` — canonical URL, OG image, JSON-LD                                           | `KEEP_PUBLIC_SITE_URL`                                                                                     | None — `BaseLayout`/`MarketingLayout` are public-surface-only; the future `AuthLayout`/`AppLayout` don't emit public canonical metadata (`noindex` instead).                                                                              |
| `apps/web/src/pages/sitemap.xml.ts:32`                           | `site ?? new URL("https://crawlpact.com")` fallback                                                                           | `KEEP_PUBLIC_SITE_URL`                                                                                     | None                                                                                                                                                                                                                                      |
| `apps/web/src/pages/.well-known/security.txt.ts:13`              | Same `Astro.site` fallback pattern                                                                                            | `KEEP_PUBLIC_SITE_URL`                                                                                     | None                                                                                                                                                                                                                                      |
| `apps/web/src/pages/robots.txt.ts:24`                            | Hardcoded `Sitemap: https://crawlpact.com/sitemap.xml`                                                                        | `KEEP_PUBLIC_SITE_URL`                                                                                     | Phase 2 must add a **separate app-host `robots.txt`** response (disallow-all, **no** `Sitemap:` line at all — the app has no sitemap to point to)                                                                                         |
| `apps/web/src/pages/status/feed.xml.ts:37`                       | `site ?? new URL(getEnv().PUBLIC_SITE_URL)`                                                                                   | `KEEP_PUBLIC_SITE_URL`                                                                                     | None — `/status/feed.xml` is PUBLIC_ONLY                                                                                                                                                                                                  |
| `apps/web/src/lib/auth/same-origin.ts:21`                        | `assertSameOrigin()`'s single expected-origin CSRF check                                                                      | **`SURFACE_SPECIFIC` — resolved below**                                                                    | See "CSRF migration design" section                                                                                                                                                                                                       |
| `apps/web/src/pages/api/audit/[auditId]/share.ts:68`             | Builds `/shared/:token` URL against `PUBLIC_SITE_URL`                                                                         | `KEEP_PUBLIC_SITE_URL`                                                                                     | None — `/shared/:token` is classified PUBLIC_ONLY (stays on apex)                                                                                                                                                                         |
| `apps/web/src/pages/api/notifications/feed-token.ts:40`          | Builds `/feed/:token.xml` URL against `PUBLIC_SITE_URL`                                                                       | `KEEP_PUBLIC_SITE_URL`                                                                                     | None — the feed page itself is PUBLIC_ONLY                                                                                                                                                                                                |
| `apps/web/src/pages/feed/[token].xml.ts:43`                      | Feed's own base URL uses `PUBLIC_SITE_URL` (correct — `KEEP`), **but** the entries inside the feed link to `/app/domains/:id` | `SURFACE_SPECIFIC` — feed identity: `KEEP_PUBLIC_SITE_URL`; embedded entry links: `MOVE_TO_PUBLIC_APP_URL` | Phase 2: the feed's own `<link>`/`id` stays on `PUBLIC_SITE_URL`; each entry's deep link into a specific domain's dashboard view must resolve against `PUBLIC_APP_URL` instead, since `/app/domains/:id` will live on `app.crawlpact.com` |
| `packages/scanner/src/safe-fetch.ts:4`                           | Scanner UA string `"...(+https://crawlpact.com/scanner)"`                                                                     | `KEEP_PUBLIC_SITE_URL`                                                                                     | None — unrelated to which host serves the app; this is the crawler's public identification string                                                                                                                                         |
| `apps/e2e-fixture/wrangler.jsonc:14`                             | `e2e-fixture.crawlpact.com` custom domain                                                                                     | `KEEP`                                                                                                     | None — separate fixture Worker, unrelated to the public/app split                                                                                                                                                                         |
| `apps/web/src/lib/trust-config.ts`, `scripts/trust-validate.mjs` | `*@crawlpact.com` email addresses                                                                                             | `REMOVE` from scope                                                                                        | Email addresses, not URLs — unaffected                                                                                                                                                                                                    |

## Config / build / CI

| File                                                                                                                                        | Classification                                                        | Phase 1 status                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.env.example`, `packages/config/src/env.ts`, `apps/web/src/env.d.ts`                                                                       | `KEEP_PUBLIC_SITE_URL` as the anchor                                  | **Done this phase** — `PUBLIC_APP_URL` added alongside as an optional, validated, unconsumed field                                                                                                                                                                                                                                                                             |
| `apps/web/wrangler.jsonc` (production `vars`, `env.preview.vars`)                                                                           | `KEEP_PUBLIC_SITE_URL`                                                | **Done this phase** — `PUBLIC_APP_URL` added to both blocks with documented future values (`https://app.crawlpact.com`, `https://app-preview.crawlpact.com`); neither hostname has DNS/Custom Domain attached                                                                                                                                                                  |
| `scripts/build.sh`                                                                                                                          | `KEEP_PUBLIC_SITE_URL`                                                | **Done this phase** — exports `PUBLIC_APP_URL` per build target alongside `PUBLIC_SITE_URL`, unused by anything downstream yet                                                                                                                                                                                                                                                 |
| `scripts/verify-push.sh`, `.github/workflows/ci.yml` (both spots)                                                                           | `KEEP_PUBLIC_SITE_URL`                                                | **Done this phase** — `PUBLIC_APP_URL=http://localhost:4321` added alongside for local/CI env parsing                                                                                                                                                                                                                                                                          |
| `package.json`'s `smoke:preview`/`smoke:production` scripts                                                                                 | `SURFACE_SPECIFIC`                                                    | Deferred — Phase 3/4 needs a second smoke-test invocation against the app origin once it's live. Per the user's own standing note, local `pnpm quality`/`verify:push` never exercise `scripts/smoke-test.ts` against a live Worker — only the actual `smoke:preview`/`smoke:production` CI jobs do, so this is the one gate that will actually catch an app-origin regression. |
| `scripts/smoke-test.ts:193-199`                                                                                                             | Hardcoded `crawlpact.com`/`www.crawlpact.com` redirect-check fixtures | `SURFACE_SPECIFIC`                                                                                                                                                                                                                                                                                                                                                             | Deferred — needs app-origin equivalents (e.g., `app.crawlpact.com/app` → 200/redirect assertions) once Phase 3 stands up the compatibility deployment |
| `.github/workflows/deploy-preview.yml` (Lighthouse check URL)                                                                               | `SURFACE_SPECIFIC`                                                    | Deferred — no app-origin Lighthouse target exists or is needed until app pages get their own CI gate                                                                                                                                                                                                                                                                           |
| 44 integration test files under `apps/web/tests/integration/**` (`mockEnv`/`ORIGIN` pattern via `test-helpers.ts`'s `TEST_ORIGIN` constant) | `KEEP_PUBLIC_SITE_URL` as-is                                          | Deferred — once the CSRF check becomes a route-aware allowlist (below), `test-helpers.ts` will need a second `APP_ORIGIN` constant, and the CSRF/WebAuthn/Google-lookalike-origin negative tests will need updating to assert the new two-origin behavior. **Not done in Phase 1** — doing so now would be premature since the allowlist doesn't exist yet.                    |

## CSRF migration design — resolving `same-origin.ts`'s `SURFACE_SPECIFIC` entry

Current code (`apps/web/src/lib/auth/same-origin.ts`):

```ts
export function assertSameOrigin(request: Request): void {
  if (SAFE_METHODS.has(request.method)) return;
  const expectedOrigin = new URL(getEnv().PUBLIC_SITE_URL).origin;
  const origin = request.headers.get("Origin");
  if (origin) {
    if (origin !== expectedOrigin) throw new ApiError("FORBIDDEN", "Cross-site request blocked.");
    return;
  }
  const referer = request.headers.get("Referer");
  if (referer && new URL(referer).origin === expectedOrigin) return;
  throw new ApiError("FORBIDDEN", "Cross-site request blocked.");
}
```

This must **not** become a naive two-origin allowlist accepting either origin for every route —
that would let a public-origin page CSRF an app-origin mutation and vice versa, which is exactly
the "sibling-subdomain CSRF" risk the directive calls out. The Phase 2 design (not implemented in
Phase 1):

1. `assertSameOrigin` gains a required `expectedSurface: "public" | "app"` parameter (or
   equivalent explicit input — no implicit inference from the request path).
2. `requireSession`/`requireAdminSession` (which currently call `assertSameOrigin()` internally
   for every `APP_ONLY` route in the ownership matrix) always pass `"app"` — since every route
   that requires a session is, per the matrix, an `APP_ONLY` route and will only ever be called
   from `app.crawlpact.com` post-cutover.
3. The one `SHARED_SAME_ORIGIN_SURFACE` route (`/api/analytics/track`) explicitly checks the
   request's own actual `Origin` against **whichever configured origin matches the incoming
   request's Host header** — i.e., same-origin-to-itself, never cross-origin — this is the one
   place a request's own Host is consulted to pick which of the two configured origins is
   "expected," and it must reject a request whose `Origin` doesn't match its own `Host`.
4. `PUBLIC_ONLY` mutating endpoints (audit intake/continuation-create) keep exactly today's
   behavior: expected origin = `PUBLIC_SITE_URL`'s origin, unconditionally.
5. The Paddle webhook (`SERVER_TO_SERVER_PUBLIC`) never calls `assertSameOrigin` at all — unchanged.

This design keeps the CSRF check a strict allowlist scoped per-route by the ownership matrix,
never a blanket "either origin is fine" check. It is deferred to Phase 2 implementation; Phase 1
only records the design so Phase 2 doesn't have to re-derive it from scratch.

## Docs (breadth note)

`crawlpact.com` appears narratively across ~100+ files in `docs/**` (changelog entries, phase
reports, baseline snapshots). These are historical/descriptive records of what was true when
written and are **not reclassified individually** — rewriting historical documents to pretend they
always reflected a two-origin architecture would violate the "historical documents stay historical"
rule (directive §22). The current authoritative docs that were updated as part of Phase 1's
non-behavioral configuration work are listed in `PHASE_1_COMPLETION_REPORT.md`'s Files Changed
section.
