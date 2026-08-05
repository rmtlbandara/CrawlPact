# Performance budgets

Stage 11G (Phase 11). The enforced CI gate (`scripts/lighthouse-check.mjs`, run against the real
deployed preview Worker by `.github/workflows/deploy-preview.yml`) and how it got its numbers —
not aspirational targets invented separately from what's actually measured.

## The budget

| Metric               | Threshold  | Measured against (real production, Stage 11G)                                |
| -------------------- | ---------- | ---------------------------------------------------------------------------- |
| Performance score    | ≥ 85       | 94–99 across every tracked page (see `PHASE_11_PAGE_PERFORMANCE_RESULTS.md`) |
| Accessibility score  | ≥ 95       | 100 on every tracked page                                                    |
| Best Practices score | ≥ 85       | 92 on every tracked page                                                     |
| SEO score            | ≥ 90       | 100 on every tracked page                                                    |
| LCP                  | ≤ 3,000 ms | 1,579–2,940 ms on every tracked page                                         |
| CLS                  | ≤ 0.1      | 0 on every tracked page, every run, since Phase 7's own baseline             |

Every threshold is set below this phase's own real measured floor, not at it — real production
network variance (confirmed directly this phase: the same unchanged page scored anywhere from 71
to 99 across a short run sequence, see the "methodology finding" in
`PHASE_11_PAGE_PERFORMANCE_RESULTS.md`) means a threshold set exactly at the measured value would
false-fail on ordinary noise. The gap between threshold and real measurement is deliberate
headroom, not slack that should be tightened — tightening it would just convert real variance into
false CI failures.

## Why gate on the median of 3 runs, not one run

Before this phase, `lighthouse-check.mjs` ran each page once and gated directly on that single
run. This phase changed that to running each page `RUNS_PER_PAGE = 3` times and gating on the
median — a direct response to the same real finding above: a single run is not a reliable signal,
in either direction. Gating on one run risks two failure modes simultaneously: blocking a genuinely
fine deploy because one run hit test-machine/network noise, and letting a genuinely regressed
deploy through because it happened to get a lucky run. The median of three is a standard, simple
mitigation for exactly this — no page passes or fails on a single bad or good sample.

Every run (not just the median) is written to a JSON artifact
(`LIGHTHOUSE_ARTIFACT_DIR/lighthouse-results.json`, uploaded by the CI workflow on every run —
success or failure, 30-day retention) specifically so a suspicious pass (a median that barely
cleared threshold) or a failure can be inspected against its full run-by-run data afterward,
not just the console summary.

## Page template coverage

One representative page per distinct template archetype, matching the set this project's a11y
suite already treats as representative:

| Path                    | Template archetype                                              | Rendering mode       |
| ----------------------- | --------------------------------------------------------------- | -------------------- |
| `/`                     | Homepage                                                        | Prerendered (static) |
| `/pricing`              | Pricing (live plan-catalog reads)                               | SSR                  |
| `/sample-report`        | Free-tool report preview (Phase 4's primary conversion surface) | Prerendered (static) |
| `/crawlers/amazonbot`   | Crawler directory entry                                         | Prerendered (static) |
| `/for/agencies`         | Vertical landing page (Phase 7, live plan-catalog reads)        | SSR                  |
| `/platforms/cloudflare` | Platform guide (Phase 7)                                        | Prerendered (static) |

`/sample-report` was added this phase — it existed before Phase 11 but had no representative page
in this list despite being a primary conversion surface (SRS §30, Phase 4's "let a visitor see a
full report before running their own audit" flow). Every other template archetype already had
coverage; this was the one real gap found by checking every `prerender`/rendering-mode page against
this list.

## What this budget does not cover

- **Field data (real user Core Web Vitals)**, not lab data — this gate only ever measures a
  synthetic Lighthouse run against a specific network/CPU throttling profile, never real visitor
  experience. See `docs/design/EVIDENCE_OBSERVATORY_REDESIGN_SPEC.md` §12/§15 for why field data
  isn't collected by this product today.
- **Every page on the site** — six representative templates stand in for the whole site's
  templates, not an exhaustive per-URL check, which would be disproportionate CI cost for a
  founder-scale project (ADR-0003 spirit) for marginal additional signal once the representative
  set is chosen correctly.
- **`/admin/*` and `/app/*` pages** — deliberately excluded. These are private, session-gated
  dashboards; Lighthouse's lab methodology (an unauthenticated, cold, incognito-style page load)
  cannot meaningfully measure them, and they are not the pages a prospective customer's first
  impression depends on the way the six above are.
