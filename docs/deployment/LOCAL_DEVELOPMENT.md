# Local Development

## Prerequisites

- Node.js 22.12+ (pinned via `.nvmrc` / `package.json#engines`)
- pnpm 9+ (`corepack enable` will pick up the pinned version in `packageManager`)

## First-time setup

```bash
git clone <repo>
cd CrawlPact
pnpm install
cp .env.example .dev.vars      # apps/web reads this via Wrangler for local dev
pnpm db:migrate                 # applies packages/database/migrations to a local D1 sqlite file
pnpm db:seed                    # applies packages/database/seed/seed.sql (dev-only data)
```

## Running the app

```bash
pnpm dev            # astro dev (fast iteration; Cloudflare bindings via platformProxy)
pnpm --filter @crawlpact/web preview   # wrangler dev against the built output, closer to production
```

## Running checks

```bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm test:e2e        # requires `pnpm dev` running, or let Playwright start it (see playwright.config.ts)
pnpm test:a11y
pnpm db:validate
pnpm quality         # everything above except e2e/a11y/visual, plus build
```

## Common issues

- **"D1 binding not found" in `astro dev`** — Astro's own dev server does not expose Cloudflare
  bindings by default; the `platformProxy: { enabled: true }` option in `astro.config.mjs`
  handles this, but if it doesn't, fall back to `wrangler dev` directly.
- **Tailwind classes not applying to a `packages/ui` component** — confirm
  `apps/web/src/styles/global.css` still contains the `@source "../../../../packages/ui/src"`
  directive (see `docs/design/DESIGN_SYSTEM.md`).
