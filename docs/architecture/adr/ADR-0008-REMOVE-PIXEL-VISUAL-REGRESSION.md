# ADR-0008: Remove Pixel-by-Pixel Visual Regression; Replace With Deterministic Responsive Smoke Tests

**Status:** Accepted
**Date:** 2026-07-29
**Owner:** Solo founder / Claude Code

## Context

`.github/workflows/visual-regression.yml` ran a `compare` job on every push/PR: 13 public routes
plus 2 authenticated routes, each captured across 7 viewport projects (105 screenshots), diffed
pixel-for-pixel against a committed baseline (210 PNGs, ~51MB across `-darwin`/`-linux` platform
suffixes). It also ran a full dependency install, browser install, production build, D1 migration,
D1 seed, and dev-server startup on every invocation — a heavy, required gate.

This suite has a well-documented history of instability, not a one-off:

- `docs/status/KNOWN_RISKS.md` records a run **immediately after regenerating the baseline from
  that same commit's own render** still failing 10 of 105 tests (~9.5%), scattered across 6 of 7
  viewport projects and 7 of 13 routes — including real pixel-dimension mismatches (e.g.
  1024×1320 vs 1024×1319) as well as sub-pixel diffs.
- The suspected root cause at the time was the `networkidle`-only readiness signal. Commit
  `51f984b` replaced it with a real readiness helper (`waitForVisualReadiness`: waits for
  `document.fonts.ready`, disables animations/transitions/caret blinking, polls
  `document.documentElement.scrollHeight` across two animation frames until it stabilizes).
- **That fix did not resolve the flakiness.** The very next push to `main` after this fix landed
  (workflow run `30468598615`) still failed the `compare` job. Chasing this further would mean
  continuing to invest in a pixel-comparison system that has now failed to stabilize across two
  separate root-cause attempts.
- The `update-baseline` job (the only path that can change the baseline) auto-commits regenerated
  PNGs straight back to whatever branch it was run against, using the workflow's own
  `GITHUB_TOKEN`. Combined with the flakiness above, this created a cycle of
  regenerate-baseline → still-flaky-compare → regenerate-again visible in recent `main` history
  (`c5a8c5c`, `68ee8be`, `d1d8638`), none of which fixed the underlying problem.

## Decision

Remove the pixel-comparison system entirely:

- Deleted: `.github/workflows/visual-regression.yml`, `playwright.visual.config.ts`,
  `apps/web/tests/visual/**` (spec file, readiness helper, and all 210 committed baseline PNGs),
  the `test:visual` package script.
- Replaced with `apps/web/tests/e2e/responsive-smoke.spec.ts`: functional assertions (no
  horizontal overflow, main heading visible, forms/buttons reachable, mobile nav opens and closes,
  keyboard focus visible) at the three SRS breakpoints (360/768/1280px), across the same
  representative routes plus the authenticated customer and Super Admin shells. These assertions
  fail only on real broken layout, not on font rendering or anti-aliasing differences between
  platforms — the exact class of noise that produced the 9.5% flake rate above. It runs as part of
  the required E2E job, not a separate workflow.
- Added `pnpm ui:review` (`scripts/ui-review.ts`): captures current screenshots into a git-ignored
  `artifacts/ui-review/` for a human to eyeball. Never a CI gate, never committed, never a release
  blocker.

## Alternatives considered

- **Keep chasing readiness fixes**: rejected — the `networkidle` → `waitForVisualReadiness`
  attempt was the obvious next fix and it didn't work; there's no strong reason to expect a third
  attempt would.
- **Add a `maxDiffPixelRatio` tolerance broadly**: rejected as a first resort — a blanket tolerance
  large enough to absorb the observed ~0.01–0.02 diff ratios would also mask a real regression of
  the same magnitude, defeating the suite's purpose. The two authenticated-route tests already
  carried `maxDiffPixelRatio: 0.02` as a precedent and were not immune either (the underlying noise
  likely existed there too, just usually within tolerance).
- **Keep it as a non-required, manual `workflow_dispatch` check**: considered per the original
  remediation brief's fallback path. Rejected for now because a system that fails ~1 in 10 runs on
  an unchanged commit provides little diagnostic value even as an optional signal, and would still
  carry the full install/build/D1 cost whenever a human did choose to run it. Revisit if a future
  need for real pixel-level regression detection arises — starting from a from-scratch design
  rather than resurrecting this one.

## Consequences

- CI no longer blocks merges on a system that failed identical, unchanged commits roughly 1 time
  in 10 — a meaningful reliability and speed win for the required PR/merge gate.
- ~51MB of committed baseline PNGs are removed from the repository.
- Real layout/overflow regressions are still caught, just via deterministic functional assertions
  instead of pixel diffing — see `apps/web/tests/e2e/responsive-smoke.spec.ts`.
- Subtle purely-visual regressions (a color token drift, a spacing nudge that doesn't cause
  overflow) are no longer caught automatically. `pnpm ui:review` gives a human a fast way to spot
  these manually; SRS §10.56/§10.57's visual-quality intent is satisfied by the combination of
  responsive functional tests, the existing accessibility suite, and this manual review path,
  rather than by automated pixel equality.
- `docs/testing/TEST_STRATEGY.md`, `docs/testing/VISUAL_QA_MATRIX.md`,
  `docs/release/RELEASE_CHECKLIST.md`, and `docs/status/REQUIREMENTS_TRACEABILITY.md` are updated
  to stop describing a pixel-comparison suite that no longer exists.
