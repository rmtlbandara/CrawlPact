# CLAUDE.md

Instructions for Claude Code working in this repository. Keep this file short — canonical
detail lives in `docs/`.

## Read first, in order

1. `docs/product/CRAWLPACT_FINAL_SRS.md` — the authoritative specification. It outranks
   everything else, including this file, unless an approved ADR explicitly records an
   authorised deviation.
2. `docs/status/IMPLEMENTATION_STATUS.md` — what's actually built vs. planned right now.
3. `docs/architecture/adr/README.md` — accepted architecture decisions.
4. `docs/status/REQUIREMENTS_TRACEABILITY.md` — which SRS requirement maps to which code/test.

## Non-negotiable rules

- **Never silently skip, shorten, or reinterpret an SRS requirement.** If something can't be
  done as specified, say so explicitly and record it in `docs/status/KNOWN_RISKS.md` — don't
  quietly build something smaller and call it done.
- **Never present mocked, fabricated, or synthetic data as a real product outcome.** A
  disabled/unimplemented feature must say so honestly (see `AUDIT_ENGINE_ENABLED` in
  `.env.example` and how `/api/audit` behaves). Clearly-labelled synthetic UI examples (e.g. the
  landing page's report preview) are fine; anything that could be mistaken for a real result is
  not.
- **Never deploy to production, or push to a remote repository, without the user's explicit,
  in-the-moment permission.** This applies even if a previous session was authorised — ask
  again.
- **Preserve security boundaries.** All scanner network calls go through the safe-fetch
  chokepoint (`packages/scanner`, ADR-0005) — never add a second place that fetches a
  customer-supplied URL. See `docs/security/`.
- **Migrations are hand-authored SQL, forward-only.** Never edit an applied migration or use a
  schema-push tool against a real database (ADR-0002).

## Before finishing any non-trivial change

Run `pnpm quality` (format, lint, typecheck, unit+integration tests, db:validate, build). For UI
changes, also run `pnpm test:a11y` and check the change at 360px/768px/1280px. Update any
`docs/` file the change makes inaccurate — documentation debt is not acceptable debt here.

## Definition of done

See `docs/release/DEFINITION_OF_DONE.md` — it applies to every change, not just releases.

## Specialised areas

Nested `AGENTS.md`/`CLAUDE.md` files exist where a directory has genuinely different rules:
`packages/scanner/`, `packages/database/`, and the auth/billing/admin routes under
`apps/web/src/pages/api/`. Read the nearest one before working in that area.
