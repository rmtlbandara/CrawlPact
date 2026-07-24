# Codex Handoff

For OpenAI Codex (or any agent besides Claude Code) picking up this repository without prior
session context.

## Start here

1. `AGENTS.md` (root) — the tool-agnostic instructions; treat it as your primary brief.
2. `docs/product/CRAWLPACT_FINAL_SRS.md` — the specification. It is authoritative.
3. `docs/status/IMPLEMENTATION_STATUS.md` — ground truth on what exists.
4. `docs/architecture/adr/README.md` — decisions already made; don't re-litigate them without a
   new ADR.

## What "CLAUDE.md" is, and why it doesn't apply to you

`CLAUDE.md` contains Claude Code-specific tool guidance (which skill to invoke, etc.). It
duplicates none of the substantive project rules — those all live in `AGENTS.md` and `docs/`,
specifically so a different agent isn't missing anything by skipping the Claude-specific file.
You do not need to read `CLAUDE.md`.

## Conventions this repo relies on that may differ from your defaults

- **Migrations are hand-authored SQL, forward-only** (`packages/database/migrations/*.sql`).
  Do not generate migrations from a schema-diff tool.
- **One accessible primitive library** (Radix UI) for interactive components — see
  `docs/architecture/adr/ADR-0003-UI-COMPONENT-STRATEGY.md` before adding any UI dependency.
- **One Cloudflare Worker, not a split frontend/API deployment** — see
  `docs/architecture/adr/ADR-0001-APPLICATION-ARCHITECTURE.md` before proposing a different
  topology.
- **No fabricated data ever presented as a real result** — this is checked for, not just
  requested; see `docs/testing/TEST_DATA_POLICY.md`.

## Handoff etiquette

If you make a decision Claude Code would have written an ADR for, write the ADR — the format in
`docs/architecture/adr/` is tool-agnostic. Keep `docs/status/IMPLEMENTATION_STATUS.md` current
regardless of which agent is doing the work, so the next session (any tool) starts oriented.
