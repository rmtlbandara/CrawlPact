---
Document owner: Engineering owner
Status: current-authoritative (Phase 1, Workstream 20)
---

# Dependency PR Decisions — 2026-09-17

12 open Dependabot PRs, re-evaluated beyond CI status alone: changelog/release-note content,
runtime relevance to this specific Worker/Astro/Cloudflare stack, and — for the one pairing that
matters — whether partner packages are actually in sync. No PR was merged in this pass; this
records the classification and the reasoning behind it.

## Merge candidates (green CI, real evidence, no structural concern)

- **#188** `deps-dev` group (7 dev-dependency bumps) — dev-only, CI green.
- **#186** `zod` 4.4.3 → 4.6.2 — CI green; zod's v4 minor releases have not historically carried
  breaking schema-behavior changes.
- **#142** `@paddle/paddle-js` 1.6.4 → 1.6.5 — CI green, patch release.
- **#184 + #151** `@simplewebauthn/server` 13.3.2 → 14.0.1 and `@simplewebauthn/browser` 13.3.0 →
  14.0.0 — **recommend merging together, not separately**. The v14 changelog's only breaking
  change is a raised minimum runtime (Node LTS 22.x+ / Deno v2.4+) — no API-shape changes to the
  registration/authentication ceremony functions this codebase calls. More importantly, both PRs'
  CI is fully green _including_ the real WebAuthn ceremony tests (this repo's virtual-authenticator
  integration tests actually exercise registration/authentication against the bumped library, not
  just a typecheck) — concrete behavioral evidence, not just a changelog read. Still recommend one
  more explicit local passkey smoke test before merging, per CLAUDE.md's own instruction to treat
  SimpleWebAuthn major bumps with extra care, and merge server+browser as one change (their wire
  protocol is versioned as a pair) — never one without the other.

## Do not merge without investigation (real, reproduced CI failures)

- **#187** `astro` 7.2.10 → 7.3.2 — Both the quality job and the E2E/accessibility job fail. The
  public 7.3.x changelog itself looks low-risk on paper (an MDX `<script>`/`<style>` escaping fix,
  an `astro:assets` startup-error fix, a new `--ignore-lock` preview flag) — nothing that obviously
  explains a real failure in this codebase. That mismatch is exactly why "the changelog looks safe"
  is not sufficient evidence either way — something in this specific app's build or E2E path
  breaks against 7.3.2 that isn't visible from the release notes alone. Needs its own isolated
  branch and failure-log inspection before any merge decision.
- **#185** `@astrojs/cloudflare` 14.2.1 → 14.3.1 — Same dual failure. Here the changelog gives a
  concrete, plausible mechanism: 14.3.0 adds a Cloudflare `finalize()` response handler that "also
  finalizes the response after downstream Hono handlers run, with cookies produced during
  rendering and the adapter's default Cloudflare CDN cache headers applied automatically." This
  codebase's `worker.ts` (`fetchWithPreviewSearchIsolation`) does extensive custom response
  handling — CSP/HSTS/`X-Robots-Tag` headers, host-boundary rewrites, canonical redirects — before
  Astro's own handler runs. An adapter now automatically applying its own default cache headers to
  the _finalized_ response is a believable source of real conflict with that existing logic, not
  just CI noise. Recommend testing this bump in isolation with explicit attention to response
  headers on a representative request, not bundled with the Astro core bump above even though
  Dependabot opened them separately.
- **#183** `react-dom` + `@types/react-dom` 19.2.8 → 19.3.0 — Fails both jobs. Also a structural
  concern independent of CI: this bumps `react-dom` alone, to 19.3.0, while `react` itself stays at
  19.2.8 in `package.json` — no matching `react` bump PR currently exists among the 12 open. Do not
  introduce a `react`/`react-dom` minor-version skew; wait for (or manually pair with) a `react`
  bump to the same 19.3.x line before merging either.
- **#136** `browser-actions/setup-chrome` 2.1.2 → 2.2.0 — CI-infrastructure action, stale since
  2026-08-24 (opened before many subsequent merges to `main`). Fails both jobs; re-run against
  current `main` before deciding whether the failure is this bump or drift.

## Ambiguous — re-run against current `main` before deciding

- **#182** `lucide-react` 1.31.0 → 1.44.0, **#181** `pnpm/action-setup` 6.0.10 → 6.1.0, **#149**
  `@astrojs/react` 6.0.2 → 6.0.5 — quality passes, only the E2E/accessibility job fails on each.
  None of the three is a plausible direct cause of an E2E failure on its own merits (an icon
  library version bump, a GitHub Actions setup-tool version, and a minor Astro React-integration
  patch) — all three are also stale (opened 2026-08-24 through 2026-09-07, before several
  subsequent merges to `main`), so this may simply be drift against an old base rather than a real
  regression from any of these bumps. Re-run CI after rebasing onto current `main` before
  classifying further.

## What changed from the first-pass triage

The initial pass (Workstream A/B) classified by CI status alone. This pass adds: real changelog
content for the four highest-relevance bumps, the `react`/`react-dom` version-skew finding (not
visible from CI status), and a concrete hypothesis for _why_ the Cloudflare adapter bump fails
(rather than just noting that it does). No classification flipped from "don't merge" to "merge" or
vice versa — the additional research reinforced the original split rather than changing it.
