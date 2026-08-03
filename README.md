# CrawlPact

CrawlPact is the independent AI crawler policy audit and monitoring platform for agencies and
multi-site teams. It audits a website's publicly declared AI-crawler-policy signals — `robots.txt`,
`llms.txt`, RSL, Content Signals, and related HTTP/HTML signals — evaluates them against a
maintained crawler-purpose registry, detects conflicts, and generates evidence-based
recommendations. Public category: AI crawler policy audit and monitoring. Strategic category: AI
crawler policy governance.

CrawlPact audits **declared policy**, not real traffic. It does not enforce crawler obedience, does
not block or throttle any crawler, and does not prove actual crawler behaviour without server/CDN
traffic logs (which CrawlPact does not ingest). See
[`docs/product/PRODUCT_SCOPE.md`](docs/product/PRODUCT_SCOPE.md) for the full scope boundary and
[`docs/product/CRAWLPACT_FINAL_SRS.md`](docs/product/CRAWLPACT_FINAL_SRS.md) for the authoritative
specification.

## Current production status

- **Production**: [https://crawlpact.com](https://crawlpact.com)
- **Current state**: [`docs/status/CURRENT_STATE.md`](docs/status/CURRENT_STATE.md) — the single
  authoritative, evidence-linked description of what's currently live, in progress, or disabled.
- **Public status page**: [https://crawlpact.com/status](https://crawlpact.com/status)
- **Deployment verification**: every production deploy runs through
  [`.github/workflows/deploy-production.yml`](.github/workflows/deploy-production.yml)
  (`workflow_dispatch` + a typed confirmation string — never automatic) and a post-deploy smoke
  test (`scripts/smoke-test.ts`). See [`docs/deployment/DEPLOYMENT.md`](docs/deployment/DEPLOYMENT.md).

**This README is a snapshot, not a substitute for production evidence.** If it disagrees with
`docs/status/CURRENT_STATE.md` or a live check of `https://crawlpact.com`, those win.

## Current capabilities

Summarised from [`docs/status/CURRENT_STATE.md`](docs/status/CURRENT_STATE.md) — see that
document (and [`docs/baseline/2026-08-03/CAPABILITY_MATRIX.md`](docs/baseline/2026-08-03/CAPABILITY_MATRIX.md))
for exact status values and evidence per item, since "implemented" alone doesn't distinguish code
presence from production verification:

- **Anonymous audits and public audit results** — real scans, `verified-live` in production
- **Authentication and accounts** — passkey/WebAuthn only, `verified-live`
- **Saved domains, groups, batch import, CSV export**
- **Scheduled monitoring and manual re-scans** — a Workers-Free CPU-budget constraint applies at
  scale, see [`docs/risks/ACTIVE_RISKS.md`](docs/risks/ACTIVE_RISKS.md)
- **Notifications and a private Atom feed per user**
- **Billing and subscriptions** via Paddle — annual-only, three paid tiers; webhook processing
  `verified-live`, real paid checkout lifecycle not yet run
- **Agency capabilities** — client groups, batch import, branded client-safe shares
- **Crawler registry** — 23 crawlers across 9 operators, versioned releases, Super Admin
  governance UI
- **Public status page and incident tracking** — `verified-live`
- **Super Admin Control Center** — dashboard, user/subscription/domain/scan/registry/security
  administration, audit logging
- **Analytics** — first-party product events, plus Google Analytics on public marketing pages
  only (a disclosed, deliberate SRS §6.2 deviation — see
  [`docs/status/REQUIREMENTS_TRACEABILITY.md`](docs/status/REQUIREMENTS_TRACEABILITY.md) §6)
- **Security and trust pages, legal pages, SEO content** (22 crawler-reference pages, 20 guides,
  5 free tools)

## Product boundaries

CrawlPact explicitly does **not**:

- Enforce network-level crawler blocking (no WAF/reverse-proxy functionality)
- Guarantee any specific crawler's real-world compliance
- Prove real crawler access without traffic logs (which it does not ingest)
- Provide legal certification of any kind
- Perform broad, general-purpose SEO crawling (only a bounded, policy-relevant resource set per scan)
- Provide traffic-log analytics
- Treat optional signals (llms.txt, RSL, Content Signals) as universally adopted or enforced

Full detail: [`docs/product/PRODUCT_SCOPE.md`](docs/product/PRODUCT_SCOPE.md).

## Technology stack

Astro (public site + same-origin API) deployed as a single Cloudflare Worker, Cloudflare D1 (via
Drizzle ORM), Cloudflare KV (session-binding requirement only — real sessions are D1-backed),
Cloudflare R2 (agency-branding logo uploads only), Paddle (billing, merchant of record), Tailwind
CSS v4 + Radix UI, strict TypeScript, pnpm workspaces. See
[`docs/architecture/adr/`](docs/architecture/adr/README.md) for why.

## Repository structure

```text
apps/web/           Astro app: public site, same-origin API, Worker entry, tests
apps/e2e-fixture/    Standalone deterministic scan-target Worker for e2e tests (not part of the product)
packages/core/       API envelope, error codes, zod contracts, domain normalisation
packages/scanner/    SSRF-safe fetch chokepoint + scan orchestration (live in production)
packages/policy/     Conflict detection, findings, recommendations, scoring
packages/registry/   Crawler-purpose vocabulary and read-model types
packages/robots/     robots.txt parsing and evaluation
packages/database/   D1 SQL migrations (source of truth) + Drizzle schema mirror + seed data
packages/ui/         Design tokens + component library
packages/config/     Shared environment validation
scripts/             Build, deploy, smoke-test, registry, and documentation-validation tooling
docs/                Architecture, security, data, design, ops, status, risks, governance, roadmap
```

## Local development

Prerequisites: Node (see `.nvmrc`), pnpm 9.15.0 (see `packageManager` in `package.json`).

```bash
pnpm install
cp .env.example .dev.vars   # local placeholder values only — never a real secret
pnpm db:migrate
pnpm db:seed
pnpm dev
```

No secret values are ever required for local development — `.dev.vars` uses sandbox/placeholder
values throughout. Full setup and troubleshooting:
[`docs/deployment/LOCAL_DEVELOPMENT.md`](docs/deployment/LOCAL_DEVELOPMENT.md).

## Quality commands

| Command                                        | Does                                                                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `pnpm format` / `pnpm format:check`            | Prettier                                                                                                          |
| `pnpm lint` / `pnpm lint:fix`                  | ESLint                                                                                                            |
| `pnpm typecheck`                               | TypeScript across all workspace packages                                                                          |
| `pnpm test:unit`                               | Unit tests (Vitest)                                                                                               |
| `pnpm test:integration`                        | Integration tests against real local D1                                                                           |
| `pnpm db:validate`                             | Migration/schema-drift check                                                                                      |
| `pnpm registry:validate`                       | Crawler registry integrity checks (local D1 only)                                                                 |
| `pnpm build`                                   | Type-check (`astro check`) and build                                                                              |
| `pnpm quality`                                 | The full non-destructive local quality gate (format, lint, typecheck, unit+integration tests, db:validate, build) |
| `pnpm test:e2e` / `pnpm test:e2e:chromium`     | End-to-end tests (Playwright)                                                                                     |
| `pnpm test:a11y` / `pnpm test:a11y:chromium`   | Accessibility tests                                                                                               |
| `pnpm docs:validate`                           | Read-only documentation-governance validation (required files, status vocabulary, stale-claim detection)          |
| `pnpm baseline:validate`                       | Read-only Phase 0 baseline validation                                                                             |
| `pnpm smoke:preview` / `pnpm smoke:production` | Manual, human-triggered smoke test against a real deployed URL                                                    |

## Deployment overview

- **Mechanism**: GitHub Actions only. `deploy-preview.yml` deploys to the preview Worker;
  `deploy-production.yml` deploys to production and requires `workflow_dispatch` with a typed
  `"DEPLOY PRODUCTION"` confirmation — there is no automatic path to production.
- **Environments**: local, preview (`crawlpact-web-preview`), production (`crawlpact-web`) — see
  [`docs/deployment/ENVIRONMENTS.md`](docs/deployment/ENVIRONMENTS.md).
- **Migrations**: hand-authored SQL only (ADR-0002), applied via `wrangler d1 migrations apply`
  as part of the deploy workflow — never `drizzle-kit push` against a real database.
- **Smoke testing**: `scripts/smoke-test.ts` checks key routes (`/sign-in`, `/pay`, `/status`,
  including their honest-disabled/configured branches) against a real deployed URL — manual, not
  yet part of any automated gate.
- **Rollback**: [`docs/release/ROLLBACK_RUNBOOK.md`](docs/release/ROLLBACK_RUNBOOK.md).

## Documentation map

Start at [`docs/README.md`](docs/README.md) — the full documentation portal. Direct links:

- [Current state](docs/status/CURRENT_STATE.md)
- [Product scope](docs/product/PRODUCT_SCOPE.md)
- [SRS](docs/product/CRAWLPACT_FINAL_SRS.md)
- [Architecture](docs/architecture/ARCHITECTURE.md)
- [Active risks](docs/risks/ACTIVE_RISKS.md)
- [Changelog](CHANGELOG.md)
- [Security](docs/security/SECURITY_CHECKLIST.md)
- [Registry governance](docs/registry/CRAWLER_REGISTRY_GOVERNANCE.md)
- [Deployment](docs/deployment/DEPLOYMENT.md)
- [Phase reports](docs/reports/)
- [Historical archive](docs/archive/README.md)

## Contributing and governance

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Security issues: see [`SECURITY.md`](SECURITY.md).
Documentation update rules, source-of-truth precedence, and required completion reports:
[`docs/governance/DOCUMENTATION_GOVERNANCE.md`](docs/governance/DOCUMENTATION_GOVERNANCE.md).

## For AI coding agents

Start with [`AGENTS.md`](AGENTS.md) (tool-agnostic) or [`CLAUDE.md`](CLAUDE.md) (Claude Code
specific). Never deploy to production or push to a remote without explicit, in-the-moment
permission for that specific action.
