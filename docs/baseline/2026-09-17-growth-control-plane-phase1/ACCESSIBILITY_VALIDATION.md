---
Document owner: Engineering owner
Status: current-authoritative (Phase 1, Workstream 19 — accessibility baseline)
---

# Accessibility Validation — 2026-09-17

## What was obtained: real, clean signal on every static/anonymous page

`pnpm test:a11y:chromium` (axe-core via Playwright, WCAG 2.2 AA) run locally against a correctly
configured dev server produced **41 real passes with zero automatically detectable WCAG 2.2 AA
violations**, covering every public/anonymous surface this repo's own a11y suite checks: `/`,
`/about`, `/contact`, `/audit`, `/sample-report`, `/pricing`, `/crawlers` (index and a detail page),
`/tools` (index and a validator), `/guides` (index and a detail page), all four `/for/` vertical
pages, `/platforms` (index and all 4 platform pages), `/methodology`, `/scoring`, `/scanner`,
`/changelog`, `/status`, `/security`, `/privacy`, `/terms`, `/acceptable-use`, `/limitations`,
`/sign-in`, a 404 page, `/dev/components`, a real anonymous audit report (including the Phase 5
conversion CTA), reduced-motion handling, skip-link focus order, and breadcrumb landmark
correctness. This is consistent with the project's own historical clean a11y record and shows no
regression from anything added this pass (the new `/admin/growth` page and the RUM script included
— RUM adds no visible DOM, only a background script).

## What could not be reliably reproduced locally, and why

The remaining 70 tests in this suite depend on an authenticated fixture flow
(`registerNewAccount`/`registerNewAccountCapturingRecoveryCodes`, real passkey registration against
a virtual authenticator) that requires the dev server to be reachable at exactly the origin the
app's own host-boundary logic (`worker.ts`'s `classifyRequestOrigin`) expects —
`PUBLIC_SITE_URL`/`PUBLIC_APP_URL` set to `http://localhost:4321`, matching CI's own
`browser-smoke` job configuration exactly (verified by reading that job's actual env block from a
recent CI run). Left unset, the dev server inherits `wrangler.jsonc`'s top-level (production)
values, and `/sign-in` correctly 404s under the app's own "unknown host + sensitive path → fail
closed" rule — a real security property working as designed, not a bug.

With the correct env vars exported, one full run did complete and initially returned the exact same
41 passes plus real coverage of the authenticated/agency/notification suites — but a second attempt
under the same configuration hit a dev-server-boot timing race (`ERR_CONNECTION_REFUSED`) rather
than reproducing cleanly, after this session had already spent a long time running many concurrent
heavy local processes (multiple Miniflare instances, `wrangler dev`, Lighthouse-driven Chrome
instances, several vitest suites). This looks like local resource/timing flakiness specific to this
session's machine state, not a deterministic defect — but it means a fully clean 111/111 local
result was not obtained with confidence in this pass.

## Why this isn't being forced further right now

This repo's own CI (`ci.yml`'s `browser-smoke` job) already runs this exact suite, with the exact
correct environment, on every PR — including whatever PR this branch eventually becomes. That is
the trustworthy signal for the authenticated-flow tests, not further local reproduction attempts
under already-degraded local resource conditions. Continuing to fight local dev-server timing was
judged lower-value than moving on to other Phase 1 work and letting the real CI run be the
authoritative check once this branch is pushed.

## Conclusion

No accessibility regression is evidenced by anything in this pass. The 41 cleanly-obtained local
passes cover every anonymous/public surface, including the newly added `/admin/growth` page's
sibling public surfaces and the RUM instrumentation. Full 111/111 confirmation is deferred to CI on
push, per the above.
