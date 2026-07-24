# Claude Code Guide (CrawlPact-specific)

Repository-specific notes for Claude Code. General Claude Code usage questions belong to the
`claude-code-guide` agent/skill, not this file.

## Repo-local skills

- `.claude/skills/quality-gate/SKILL.md` — runs the full non-destructive local quality gate.
- `.claude/skills/security-review/SKILL.md` — focused review of scanner/auth/billing/admin
  security boundaries.
- `.claude/skills/release-audit/SKILL.md` — checks the production-readiness checklist against
  actual repository state.

Invoke these with `/quality-gate`, `/security-review`, `/release-audit` rather than
re-deriving the same checklist ad hoc each time.

## Team-level settings

`.claude/settings.json` is checked in and contains only safe, team-shared settings (see that
file's comments). Personal preferences, machine paths, and credentials belong in
`.claude/settings.local.json`, which is gitignored — never move something from there into the
checked-in file.

## Working with the monorepo

- Root scripts (`pnpm lint`, `pnpm typecheck`, etc.) already fan out across all workspace
  packages via `pnpm -r` — prefer them over running a tool inside a single package directory,
  so you don't miss a cross-package break.
- `packages/ui` has no build step; it's consumed as source by `apps/web`'s Vite/Astro pipeline.
  Don't add a bundler to it without a new ADR — that would contradict ADR-0003's "keep it
  simple for a solo founder" rationale.

## Nested instructions

Check for a nested `AGENTS.md` in the directory you're editing before assuming this file or the
root `CLAUDE.md` covers it — `packages/scanner/`, `packages/database/`, and
`apps/web/src/pages/api/` all have (or will have) area-specific rules.
