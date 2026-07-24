# ADR-0001: Application Architecture

**Status:** Accepted
**Date:** 2026-07-22
**Owner:** Solo founder / Claude Code

## Context

CrawlPact (SRS §31) requires a public SEO website, an authenticated customer application, a
Super Admin application, Cloudflare D1 storage, scheduled Cloudflare execution (monitoring
cron), Paddle webhooks, passkey authentication, and same-origin API access, all maintainable
by one founder and legible to both Claude Code and a future Codex agent.

The SRS proposes a preferred structure of `apps/web` + `apps/worker` plus several packages,
but explicitly permits a single deployable Worker "if current Cloudflare and framework
support makes it materially simpler."

Verified current (2026) platform facts that inform this decision:

- The Astro Cloudflare adapter (`@astrojs/cloudflare`) builds directly to a Cloudflare Worker.
  Static assets are served from the build output directory and unmatched routes fall through
  to the Worker for on-demand (SSR) rendering — static and dynamic content already coexist in
  one Worker without a separate Pages/Workers split.
  ([Astro Cloudflare guide](https://docs.astro.build/en/guides/integrations-guide/cloudflare/))
- The adapter supports a **custom Worker entry point** (`main` in `wrangler.jsonc`) that
  imports `handle` from `@astrojs/cloudflare/handler` and exports a standard Worker object.
  This lets a single Worker export `fetch` (delegated to Astro) _and_ `scheduled` (for cron
  monitoring) from the same deployable artifact.
- Cloudflare D1 bindings are declared in `wrangler.jsonc` (`d1_databases`) and reachable from
  both the Astro request context (`context.locals.runtime.env`) and a custom `scheduled()`
  handler via the same `env` object — no second runtime is required to reach the database on a
  cron tick.
- Cloudflare Cron Triggers invoke a `scheduled()` export on the same Worker; no external
  scheduler is needed.
- Paddle's Node SDK (`@paddle/paddle-node-sdk`) and SimpleWebAuthn (`@simplewebauthn/server`)
  are both documented as compatible with the Workers runtime (with `nodejs_compat` enabled),
  so authentication and billing logic can run inside the same Worker as the public site.

Given these facts, splitting into `apps/web` (Pages) + `apps/worker` (API) would introduce a
second deployable, a second domain/route-proxying concern, and cross-origin session handling
for no functional benefit — every requirement can be met by one Worker.

## Decision

CrawlPact ships as **one Astro application, deployed as one Cloudflare Worker**
(`apps/web`), using `@astrojs/cloudflare` with a custom Worker entry
(`apps/web/src/worker.ts`).

- **Public site, customer application shell, and Super Admin shell** are all routes within
  the same Astro project (`src/pages/**`). Public marketing/content pages are prerendered
  (static) where possible; authenticated areas are server-rendered (SSR) per-request.
- **Same-origin API**: API routes live under `src/pages/api/**/*.ts` as Astro server
  endpoints (file-based routing). No separate router framework (e.g. Hono) is introduced —
  Astro's own router already provides this, and adding a second router inside the same
  process would duplicate responsibility for no benefit at this scale. This may be revisited
  in an ADR if the API surface grows enough to warrant extraction into an independently
  deployed Worker.
- **Scheduled execution**: `apps/web/src/worker.ts` exports a Worker object with `fetch`
  (delegating to Astro's `handle`) and `scheduled` (monitoring cron, implemented in Part 4).
  Cron expressions are declared in `wrangler.jsonc` under `triggers.crons`.
- **D1 binding**: a single `DB` binding declared in `wrangler.jsonc`, shared by request
  handlers and the scheduled handler.
- **Static assets**: produced by Astro's build (`dist/`) and served via Cloudflare Workers
  Static Assets, with SSR as the fallback for non-static routes — no separate CDN/Pages
  project.
- **Workspace packages** (`packages/*`) hold framework-agnostic, testable logic shared across
  routes and (eventually) the scheduled handler: `core` (shared types, zod contracts, result
  types), `scanner` (safe-fetch + policy evaluation, isolated per ADR-0005), `registry`
  (crawler registry types/access), `database` (D1 schema types + SQL migrations, ADR-0002),
  `ui` (design system + components, ADR-0003), `config` (shared tsconfig/eslint/env-validation
  presets).

## Alternatives Considered

1. **`apps/web` (Cloudflare Pages, static/SSR) + `apps/worker` (Hono API Worker)** — the SRS's
   literal preferred layout. Rejected for Part 1 because it requires either a second domain
   (breaking same-origin cookies) or a Pages-to-Worker service binding/proxy just to reach the
   API same-origin, plus a second `wrangler.jsonc`, a second deploy step, and duplicated env
   validation — pure overhead for a solo founder given the custom-entry-point capability now
   documented for the Astro adapter.
2. **Next.js on Cloudflare (via `@opennextjs/cloudflare`)** — viable, but heavier for a
   content-heavy, SEO-first marketing site than Astro's islands architecture, and the SRS
   explicitly recommends Astro for the public site (§31.1). Rejected.
3. **Remix/React Router full-stack** — similarly viable but abandons the SRS's Astro
   recommendation without a compelling reason. Rejected.
4. **Durable Objects for monitoring coordination** — deferred, not rejected. Part 1 has no
   monitoring scheduler yet. If per-domain scan locking later needs strong coordination beyond
   what D1 transactions/optimistic locking provide, a Durable Object will be introduced via a
   new ADR in Part 4 rather than being pre-built now.

## Deployment Model

- One Cloudflare Worker (`crawlpact-web`), one `wrangler.jsonc`, one D1 database per
  environment (local, preview, production).
- Environments: `local` (Miniflare via `wrangler dev` / Vite dev with platform proxy),
  `preview` (Cloudflare preview deployments per branch), `production` (`crawlpact.com`).
- Deploys are manual (`wrangler deploy`) until Part 1's explicit no-deploy constraint is
  lifted by the user; CI builds and validates but never deploys.

## Same-Origin API Strategy

All customer-facing and admin API endpoints are same-origin Astro server endpoints under
`/api/*`, sharing cookies, CSRF tokens, and CSP with the rendered pages. This satisfies SRS
§33's requirement for server-side authorisation without cross-origin cookie complexity.

## Scheduled-Handler Strategy

A single `scheduled()` export in `apps/web/src/worker.ts` dispatches by `controller.cron` to
named job functions in `packages/core` (e.g. monitoring sweep, registry drift re-evaluation).
Job implementations land in Part 4; Part 1 only establishes the export and a
`scheduled_job_runs` table to record executions.

## D1 Binding Strategy

Single binding name `DB` across all environments, pointing at environment-specific database
IDs recorded in `wrangler.jsonc` per environment block. See ADR-0002 for schema/migration
strategy.

## Static Asset Strategy

Astro's default build output is served as Workers Static Assets; no image CDN or separate
asset host is introduced in Part 1.

## Authentication/Session Strategy

Summarised here, detailed in ADR-0004: WebAuthn/passkey registration and assertion, D1-backed
sessions with a signed, HttpOnly, Secure session cookie, no passwords, no email.

## Why This Suits a Solo Founder

- One codebase, one deploy target, one place to reason about security boundaries.
- No cross-service network calls between "the site" and "the API" — fewer failure modes to
  operate and debug alone.
- Astro's static-by-default model keeps the SEO-critical public site fast without hand-rolled
  caching logic.

## Known Limitations

- All traffic (marketing, app, admin, API, cron) shares one Worker's CPU/memory limits and one
  deploy unit; a genuinely hot admin analytics query could theoretically affect the public
  site's cold-start budget. Cloudflare Workers' per-request isolate model makes this risk low
  in practice, but it is a tradeoff worth re-checking if traffic grows substantially.
- Extracting the API into an independently scaled Worker later is possible but not free: it
  would reintroduce the same-origin/session questions this ADR avoids. Treat extraction as a
  deliberate future ADR, not a default.

## Migration Path

If the API ever needs independent scaling or deployment cadence, the target migration is:
introduce `apps/worker` as a Hono-based Worker, move `src/pages/api/**` handlers there behind
a Cloudflare Service Binding from `apps/web`, and write a new ADR superseding this one before
making the change.
