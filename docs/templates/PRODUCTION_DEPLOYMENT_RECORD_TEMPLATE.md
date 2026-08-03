# Production Deployment Record Template

**Metadata**: Date/time (UTC) · Deployer · Commit SHA deployed · Deployment workflow run link ·
Environment (production/preview)

**Scope**: What changed in this deploy — link the PR(s)/commit(s).

**Pre-deploy verification**: Migration status, `pnpm quality` result, any manual checks performed
before deploying.

**Evidence**: Deployment workflow's own output (build success, migration application, binding
verification). Link the actual run.

**Verification**: Post-deploy smoke-test result (`scripts/smoke-test.ts` or equivalent) — command,
result, timestamp.

**Risks**: Anything discovered during this deploy that wasn't expected (a real regression, a
config drift, an infrastructure surprise). Link to `docs/risks/ACTIVE_RISKS.md` if a new risk was
opened.

**Tests**: Which automated gates ran before this deploy was permitted (CI status, required checks).

**Production impact**: What actually changed for real users, in plain language.

**Rollback**: The exact rollback procedure for this specific deploy if a regression is found — link
`docs/release/ROLLBACK_RUNBOOK.md` and note anything deploy-specific (e.g. a migration that isn't
trivially reversible).

**Limitations**: Anything not verified post-deploy and why.

**Ownership**: Operations owner, unless otherwise noted.
