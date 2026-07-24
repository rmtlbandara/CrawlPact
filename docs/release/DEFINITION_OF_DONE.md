# Definition of Done

Applies to any change, at any scale (a component, an endpoint, a full development "Part").

## Every change

- [ ] Strict TypeScript compiles with no errors (`pnpm typecheck`)
- [ ] Lint passes with zero warnings (`pnpm lint`)
- [ ] Formatting matches Prettier (`pnpm format:check`)
- [ ] Relevant unit tests exist and pass
- [ ] No secret, credential, or production URL is committed
- [ ] No SRS requirement is silently reduced or skipped without an approved ADR
- [ ] Documentation affected by the change is updated in the same change (not deferred)
- [ ] No fabricated data is presented as a real product outcome (audits, testimonials, metrics)

## A UI-facing change additionally needs

- [ ] Default, hover, focus, active, disabled states considered (loading/error where relevant)
- [ ] Keyboard operable; visible focus state
- [ ] Checked at 360px, 768px, and 1280px at minimum
- [ ] No new colour-only status indicator
- [ ] Passes the automated a11y smoke test for any new route (`pnpm test:a11y`)

## A schema change additionally needs

- [ ] A new hand-authored SQL migration (never an edit to an applied one)
- [ ] `packages/database/src/schema/*.ts` updated to match
- [ ] `pnpm db:validate` passes
- [ ] `docs/data/DATA_MODEL.md` updated if the change is structural

## A security-relevant change (auth, billing, scanner, admin) additionally needs

- [ ] The relevant `docs/security/*.md` file updated
- [ ] A test for the specific failure mode being defended against (not just the happy path)

## Part-level "done" (this document's primary use)

A development Part is done when every task in its mission statement is either genuinely
complete with evidence, or explicitly deferred with a reason recorded in
`docs/status/IMPLEMENTATION_STATUS.md` and `docs/status/KNOWN_RISKS.md` — never silently
dropped.
