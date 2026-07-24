# AGENTS.md

Repository instructions for any AI coding agent (Claude Code today; OpenAI Codex or others in
future). Kept deliberately short and tool-agnostic — see `docs/` for everything else, and
`docs/agents/CODEX_HANDOFF.md` specifically if you are picking this project up without prior
context from Claude Code sessions.

## Repository purpose

CrawlPact is an AI crawler policy auditor and monitor (see
`docs/product/CRAWLPACT_FINAL_SRS.md` for the full specification). This is a Cloudflare
Workers + Astro + D1 monorepo managed with pnpm workspaces.

## Required reading order

1. `docs/product/CRAWLPACT_FINAL_SRS.md`
2. `docs/status/IMPLEMENTATION_STATUS.md`
3. `docs/architecture/adr/README.md`
4. `docs/status/REQUIREMENTS_TRACEABILITY.md`

## Setup

```bash
pnpm install
cp .env.example .dev.vars
pnpm db:migrate
pnpm db:seed
```

## Test commands

```bash
pnpm test:unit
pnpm test:integration
pnpm test:e2e       # needs `pnpm dev` running or let Playwright start it
pnpm test:a11y
pnpm test:visual
```

## Formatting and type-check commands

```bash
pnpm format:check   # pnpm format to fix
pnpm lint            # pnpm lint:fix to autofix
pnpm typecheck
pnpm db:validate     # migrations vs. Drizzle schema drift check
pnpm quality         # everything above (minus e2e/a11y/visual) + build
```

## Security-critical areas (read the nested AGENTS.md before touching)

- `packages/scanner/` — the only code allowed to fetch a customer-supplied URL (ADR-0005).
- `packages/database/` — migrations are hand-authored SQL, forward-only (ADR-0002).
- `apps/web/src/pages/api/` — same-origin API; every endpoint returns the standard envelope
  (`docs/api/API_CONTRACTS.md`) and validates input with a zod contract from `packages/core`.

## Files that must remain synchronised

- `packages/database/migrations/*.sql` ↔ `packages/database/src/schema/*.ts` (checked by
  `pnpm db:validate`).
- The visible FAQ in `apps/web/src/pages/index.astro` ↔ its `FAQPage` JSON-LD (same source
  array — do not let a future edit update one without the other).
- `docs/status/REQUIREMENTS_TRACEABILITY.md` ↔ actual implementation state, whenever a
  requirement's status changes.

## Documentation rules

- Update the relevant `docs/` file in the same change that makes it inaccurate — not later.
- Record material architecture decisions as a new ADR (`docs/architecture/adr/`), don't just
  change the code and hope it's self-explanatory.
- Never write a doc file that exists only to satisfy a checklist — content must be specific to
  what was actually built.

## Production deployment

Never deploy to production, and never push to a remote repository, without the user's explicit
permission for that specific action. CI validates and builds; it never deploys.

## Definition of done

`docs/release/DEFINITION_OF_DONE.md`.
