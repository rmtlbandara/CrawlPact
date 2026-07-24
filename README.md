# CrawlPact

**AI Crawler Policy Auditor & Monitor.** Audit and monitor a website's publicly declared AI
crawler policy — vendor-neutral, evidence-based, no AI model or installation required.

The full specification lives at [`docs/product/CRAWLPACT_FINAL_SRS.md`](docs/product/CRAWLPACT_FINAL_SRS.md)
and is the authoritative source of truth for this project. Start there, then
[`docs/status/IMPLEMENTATION_STATUS.md`](docs/status/IMPLEMENTATION_STATUS.md) for what's
actually built right now.

## Stack

Astro (public site + same-origin API) deployed as a single Cloudflare Worker, Cloudflare D1
(via Drizzle ORM), Tailwind CSS v4 + Radix UI, strict TypeScript, pnpm workspaces. See
[`docs/architecture/adr/`](docs/architecture/adr/README.md) for why.

## Quick start

```bash
pnpm install
cp .env.example .dev.vars
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Full setup and troubleshooting: [`docs/deployment/LOCAL_DEVELOPMENT.md`](docs/deployment/LOCAL_DEVELOPMENT.md).

## Common commands

| Command                                                                          | Does                                                                               |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `pnpm dev`                                                                       | Start the Astro dev server                                                         |
| `pnpm build`                                                                     | Type-check (`astro check`) and build                                               |
| `pnpm lint` / `pnpm lint:fix`                                                    | ESLint                                                                             |
| `pnpm format` / `pnpm format:check`                                              | Prettier                                                                           |
| `pnpm typecheck`                                                                 | TypeScript across all workspace packages                                           |
| `pnpm test:unit` / `test:integration` / `test:e2e` / `test:a11y` / `test:visual` | Test layers — see [`docs/testing/TEST_STRATEGY.md`](docs/testing/TEST_STRATEGY.md) |
| `pnpm db:migrate` / `db:seed` / `db:validate`                                    | Local D1 migrations, dev seed data, schema-drift check                             |
| `pnpm quality`                                                                   | The full non-destructive local quality gate                                        |

## Repository layout

```text
apps/web/          Astro app: public site, same-origin API, Worker entry, tests
packages/core/      API envelope, error codes, zod contracts, domain normalisation
packages/scanner/   SSRF-safe fetch chokepoint (not yet wired to a live scanner — see status)
packages/registry/  Crawler-purpose vocabulary and read-model types
packages/database/  D1 SQL migrations (source of truth) + Drizzle schema mirror
packages/ui/        Design tokens + component library
packages/config/    Shared environment validation
docs/               Everything else — architecture, security, data, design, ops, status
```

## Project status

This is early-stage, foundation work. The public marketing site is functional; the scanner,
authentication, monitoring, billing, and Super Admin are architected (schema, ADRs, typed
contracts exist) but not implemented. See
[`docs/status/IMPLEMENTATION_STATUS.md`](docs/status/IMPLEMENTATION_STATUS.md) for specifics —
this README will not be kept as current as that file, so defer to it when they disagree.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Security issues: see [`SECURITY.md`](SECURITY.md).

## For AI coding agents

Start with [`AGENTS.md`](AGENTS.md) (tool-agnostic) or [`CLAUDE.md`](CLAUDE.md) (Claude Code
specific). Never deploy to production or push to a remote without explicit, in-the-moment
permission for that specific action.
