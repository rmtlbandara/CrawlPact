# Contributing

CrawlPact is currently developed by a solo founder with AI coding agents (Claude Code, and in
future OpenAI Codex). This document covers the mechanics of making a change correctly; for
project rules and philosophy see `AGENTS.md` and `docs/release/DEFINITION_OF_DONE.md`.

## Before you start

Read `docs/product/CRAWLPACT_FINAL_SRS.md` and `docs/status/IMPLEMENTATION_STATUS.md`. Don't
duplicate work already in progress or already decided against in an ADR.

## Making a change

1. Create a branch off `main`.
2. Make the change, including tests, in the same commit/PR as any documentation it affects.
3. Run `pnpm verify:push` locally (reproduces the required CI gate — format, lint, typecheck,
   unit/integration tests, build, and a Chromium E2E/accessibility smoke run against a
   production-like local server). `pnpm check:fast` gives quicker feedback while iterating.
4. Open a PR describing what changed and, if relevant, which SRS requirement(s) it addresses —
   reference the requirement ID from `docs/status/REQUIREMENTS_TRACEABILITY.md` where
   applicable.
5. Once CI is green, apply the `automerge` label to merge automatically — see
   `.github/workflows/merge-when-green.yml`. This repository's GitHub plan can't gate native
   auto-merge on required checks, so this label-gated workflow is the deliberate substitute; a PR
   without the label just sits open until merged manually.

## Commit and PR conventions

- Commit messages explain _why_, not just _what_ — the diff already shows what changed.
- Keep PRs scoped to one coherent change; a bug fix doesn't need an unrelated refactor riding
  along with it.

## Code style

Enforced by tooling, not convention alone: `pnpm format` (Prettier), `pnpm lint` (ESLint, zero
warnings), `pnpm typecheck` (strict TypeScript across every workspace package). Don't add a
lint-disable comment to silence a real issue.

## Architecture changes

A new dependency, a new external service integration, a new data flow across package
boundaries, or a change to the deployment topology needs a new ADR
(`docs/architecture/adr/ADR-NNNN-TITLE.md`) before or alongside the code change — see
`docs/architecture/adr/README.md` for the format.

## Database changes

Hand-authored SQL migration + matching Drizzle schema update, in the same change. See
`docs/data/MIGRATION_POLICY.md`. Never edit an applied migration.

## What will get a PR rejected

- Fabricated data presented as a real result (see `docs/testing/TEST_DATA_POLICY.md`).
- A silently reduced SRS requirement with no ADR or documented deferral.
- A production deploy or force-push performed without being explicitly asked for, in that
  session.
