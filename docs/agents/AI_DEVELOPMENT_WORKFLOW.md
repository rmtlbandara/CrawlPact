# AI Development Workflow

How Claude Code (and later, Codex) should approach a unit of work in this repository.

## 1. Orient before changing anything

Read `docs/status/IMPLEMENTATION_STATUS.md` and `docs/status/REQUIREMENTS_TRACEABILITY.md`
first. Don't assume a feature is missing (or present) — check.

## 2. Check the SRS and ADRs before an architectural choice

If a task requires choosing between two implementation approaches and no ADR already covers
it, that is a signal to either follow the simplest option consistent with existing ADRs, or —
if the choice is genuinely material (new dependency, new data flow, new external service) —
write a new ADR before implementing.

## 3. Implement with tests, not after

Add the unit test alongside the logic it covers, not as an afterthought. For anything touching
the scanner, auth, billing, or admin, add the specific negative-case test (the SSRF rejection,
the invalid signature, the cross-account access attempt) — not just the happy path.

## 4. Keep the docs and the code in the same change

If a change makes a `docs/` file inaccurate, fix that file in the same commit/turn. A stale doc
is worse than no doc, because it actively misleads the next session (human or agent).

## 5. Run the quality gate before declaring anything done

`pnpm quality`, plus `pnpm test:a11y` for UI changes. Do not report success without having run
these and looked at the actual output.

## 6. Update status docs at the end of a meaningful unit of work

`docs/status/IMPLEMENTATION_STATUS.md` (current phase, what changed, what's next) and
`docs/status/REQUIREMENTS_TRACEABILITY.md` (status of any requirement the work touched).

## 7. Never fabricate evidence

A requirement is "Tested" or "Verified" only if a test actually exercises it and actually
passed — not because it looks like it should work. If you cannot verify something (e.g. no
production Cloudflare account is connected), say so plainly rather than guessing.
