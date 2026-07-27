# GitHub Desktop Workflow

The day-to-day workflow for making a change, regardless of whether Claude Code, Codex, or plain
VS Code editing does the actual work. Development never happens directly on `main`.

1. **Fetch origin**, then **pull `main`** — always start from the latest reviewed state.
2. **Confirm no local changes are at risk** — check the Changes tab is empty, or stash/commit
   anything unrelated before switching branches.
3. **Create a focused branch** from `main`, named `feature/<short-name>`, `fix/<short-name>`,
   `chore/<short-name>`, `docs/<short-name>`, `release/<version>`, or `hotfix/<short-name>`.
4. **Develop** using Claude Code, Codex, or VS Code directly.
5. **Review changed files in GitHub Desktop** before committing — read the diff, not just the
   file list.
6. **Run the quality gate**: `pnpm quality` (format, lint, typecheck, unit+integration tests,
   `db:validate`, build). Fix anything it reports before committing.
7. **Commit** using a Conventional Commit message (`feat:`, `fix:`, `chore:`, `docs:`, etc.)
   describing _why_, not just _what_.
8. **Publish the branch** to `origin`.
9. **Open a pull request** using the repository's PR template
   (`.github/PULL_REQUEST_TEMPLATE.md`) — fill in every section, don't leave placeholders.
10. **Review CI and the preview deployment** — `.github/workflows/ci.yml` must pass, and
    `.github/workflows/deploy-preview.yml` runs automatically once it does (see
    `docs/deployment/GITHUB_ACTIONS_DEPLOYMENT.md`). Check the preview URL for anything visual.
11. **Update the branch** (merge or rebase `main` in) if it falls behind while the PR is open.
12. **Merge only after approval** — squash merge is preferred (see repo settings).
13. **Return to `main`** locally.
14. **Fetch and pull** the merged result.
15. **Delete the merged local branch** once confirmed merged, if GitHub Desktop hasn't already
    offered to.

Production deployment is a separate, deliberate act — see
`docs/deployment/GITHUB_ACTIONS_DEPLOYMENT.md`'s `deploy-production.yml` section. Merging a PR
never deploys production by itself.
