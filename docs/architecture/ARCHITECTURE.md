# Architecture

Canonical architecture reference. Material decisions are recorded as ADRs in
[`docs/architecture/adr/`](./adr/README.md) — this document summarises the current state;
when the two disagree, the ADRs win.

## Shape

CrawlPact ships as **one Astro application deployed as one Cloudflare Worker** (`apps/web`),
per [ADR-0001](./adr/ADR-0001-APPLICATION-ARCHITECTURE.md). There is no separate API Worker.

```text
apps/
  web/                  Astro app: public site, same-origin API, worker entry, tests
    src/pages/          File-based routes, including src/pages/api/**
    src/worker.ts        Custom Worker entry: fetch (Astro) + scheduled (cron)
    wrangler.jsonc        D1 binding, cron triggers, static assets, env vars

packages/
  core/                 API envelope/errors, zod contracts, domain normalisation
  scanner/              SSRF-safe fetch chokepoint (ADR-0005) and IP classification
  registry/             Crawler-purpose vocabulary and read-model types
  database/             D1 SQL migrations (source of truth) + Drizzle schema mirror (ADR-0002)
  ui/                   Design tokens + component library (ADR-0003)
  config/               Shared env validation (zod) used by the Worker at boot
```

## Request flow

1. A request hits the Cloudflare Worker (`apps/web/src/worker.ts`).
2. Static assets are served directly by Workers Static Assets; everything else falls through
   to Astro's SSR handler.
3. Page routes render server-side (dynamic) or are prerendered at build time (marketing/content
   pages — see `export const prerender = true` on those pages).
4. API routes (`src/pages/api/**`) validate input with `@crawlpact/core` zod contracts, return
   the standard envelope (`docs/api/API_CONTRACTS.md`), and are the only place D1 is queried.
5. Cron ticks invoke `scheduled()` in `worker.ts`, which dispatches to the monitoring sweep
   (`lib/monitoring.ts`) and the data-retention purge (`lib/data-retention.ts`) — both real,
   implemented, tested logic (Part 4 onward), not a placeholder.

## Storage

D1 is the primary datastore (ADR-0002). **R2 was adopted 2026-07-30 for one narrow use case only
— agency-branding logo uploads** (binding `AGENCY_LOGOS`), per
`docs/data/D1_R2_DATA_PLACEMENT_POLICY.md`'s revisit-trigger entry; this corrects this
document's prior "no R2 is used" claim (Phase 1, 2026-08-03). Nothing else uses object storage —
`docs/data/D1_R2_DATA_PLACEMENT_POLICY.md` (2026-07-26) records the evidence-based decision not
to adopt it yet, and the concrete triggers that would reopen that decision. Static delivery
(Workers Static Assets vs. Cloudflare Pages) is formalised in
[ADR-0006](./adr/ADR-0006-CLOUDFLARE-STATIC-DELIVERY.md).

## Module boundaries

- Nothing outside `packages/scanner` is permitted to make a network request to a
  customer-supplied target — see [ADR-0005](./adr/ADR-0005-SCANNER-ISOLATION.md) and
  `docs/security/SSRF_SECURITY_MODEL.md`.
- Nothing outside `packages/database` defines table shape — migrations are the source of
  truth; `schema.ts` is a typed mirror, checked by `pnpm db:validate`.
- `packages/ui` has no dependency on `packages/core`/`database` — it is pure presentation and
  can be reused by any future surface (customer app, Super Admin) without pulling in
  server-only code.

## Current implementation state

Authentication (passkeys, ADR-0004), billing (Paddle, ADR unwritten — see
`docs/security/BILLING_SECURITY.md`), monitoring scheduling, the scanner (ADR-0005), and the
Super Admin console are all implemented, not just architected for — see
`docs/status/IMPLEMENTATION_STATUS.md` for the authoritative current state and
`docs/status/REQUIREMENTS_TRACEABILITY.md` for per-requirement traceability.
