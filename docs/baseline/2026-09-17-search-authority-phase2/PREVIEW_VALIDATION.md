---
Document owner: Engineering owner
Status: current-authoritative (Phase 2, §18/§49 — Preview validation of the merged Phase 2 batch)
---

# Preview Validation — 2026-09-18

Validates `main` at `c28c7bc` (PRs #204-208) on the live Preview environment
(`https://preview.crawlpact.com`), deployed automatically by `deploy-preview.yml` once CI passed
(no owner action required — this workflow is `workflow_run`-triggered on CI success, unlike
Production which requires a typed confirmation).

## CI note

The first post-merge CI run on `c28c7bc` failed one job (`Chromium E2E + accessibility smoke`),
in tests entirely unrelated to this phase's changes (`saved-domain-timeline.spec.ts`,
`notifications-monitoring-reliability.spec.ts`), with the same `Workers runtime canceled this
request because it detected that your Worker's code had hung` signature seen earlier this session
on PR #207 (corrected 2026-09-19: an earlier version of this note wrongly said #205, whose only
first-attempt failure was Prettier formatting). Reran via `gh run rerun --failed`: passed clean on the second attempt, confirming
infrastructure flakiness, not a real regression — consistent with this session's established
pattern for this exact failure signature.

## Live checks performed

- `GET /` → `200`, `x-robots-tag: noindex, nofollow, noarchive, nosnippet` (Preview correctly
  non-indexable).
- `GET /observatory/`, `/crawlers/claudebot/`, `/guides/`,
  `/guides/applebot-vs-applebot-extended/` → all `200`.
- Footer HTML contains the new `href="/observatory/"` link (PR #206's fix, confirmed live).
- ClaudeBot's page HTML contains the new "What blocking ClaudeBot does" section (PR #205's fix,
  confirmed live).
- Guides hub HTML contains all three new category headings ("Decision guides", "Implementation
  guides", "Troubleshooting guides" — PR #207's fix, confirmed live).
- Applebot guide HTML contains the new "context-supplying" language (PR #207's accuracy fix,
  confirmed live).
- `sitemap.xml`: contains `/observatory` entries; contains zero `/research` entries (correct —
  deliberately excluded until a publication exists, per `OBSERVATORY_ORPHAN_FIX.md`).
- `robots.txt`: `User-agent: * / Disallow: /` — blanket disallow, as expected for Preview.

## Observation, not a Phase 2 regression

Every page's `<link rel="canonical">` on Preview self-references `preview.crawlpact.com` rather
than the production `crawlpact.com` host (checked on the homepage and `/pricing/`, neither touched
by Phase 2, confirming this is pre-existing, environment-wide behavior, not something introduced
by any of PRs #204-208). This does not create a real duplicate-content indexing risk: Preview is
already blocked from indexing by two independent mechanisms (`robots.txt`'s blanket disallow and
the `x-robots-tag: noindex` header), so a search engine cannot reach or index these self-referencing
canonical URLs regardless. Flagged for the record since it wasn't explicitly re-verified in Phase
1's Preview-isolation checks; not fixed here as it's out of this phase's scope (no Phase 2 change
touched canonical-URL logic).

## Accessibility

Covered by the same CI run's `Chromium E2E + accessibility smoke` job (passed on rerun), which
includes `/guides` and `/observatory` in its WCAG 2.2 AA sweep — both already in the route list
(one added this phase in PR #206). No separate manual Preview accessibility pass was run; the
automated suite against this exact commit is the evidence.

## Conclusion

All Phase 2 runtime-visible changes (PRs #204-208) are confirmed live and correct on Preview.
Ready for a Production release decision — see `PHASE_2_COMPLETION_REPORT.md` for the Production
deployment gate and final verdict.

## Performance evidence (added 2026-09-19)

Real Lighthouse and smoke results, taken from the Preview deploy of `c28c7bc` and from follow-up
runs of the repository's own `scripts/lighthouse-check.mjs` methodology (devtools throttling,
median of 3 runs per page). Nothing here is reused from Phase 1.

**Deploy-pipeline run (`deploy-preview.yml`, 6 standard pages):** performance 99-100,
accessibility 100, best-practices 92, LCP 1.41-1.80 s, CLS ~0.0001 on every page; 39/39 smoke
checks passed. The SEO score of 66 on Preview is the expected artifact of `X-Robots-Tag: noindex`
(Lighthouse's `is-crawlable` audit fails by design; the script skips that threshold) and is not a
regression. This matches Phase 1's Production baseline (performance 98-99, LCP 1.5-1.8 s).

**The two pages this phase actually changed** are not in that six-page list, so they were measured
separately, on Preview:

| Measurement                                   | Performance | LCP (ms) | Note                                |
| --------------------------------------------- | ----------- | -------- | ----------------------------------- |
| `/observatory/` (Preview)                     | 99          | 1802     | new footer link target              |
| `/guides/` (Preview) — first run              | 95          | 2430     | outlier, see below                  |
| `/guides/` (Preview) — control re-run         | 100         | 1509     | same code, later window             |
| `/crawlers/` (Preview, untouched control)     | 100         | 1442     | similar card-grid hub, not changed  |
| `/guides/` (Production, pre-change flat list) | 99          | 1780     | true before-state, same methodology |

The first `/guides/` reading (95, 2.43 s) looked like a regression against the Production
before-state, so it was investigated rather than assumed: the new HTML is smaller than the old
(24.9 KB vs 28.6 KB uncompressed; 6.6 KB vs 7.1 KB gzip — the per-card category label was
removed), cache headers are identical, and a same-code control re-run plus an untouched-page
control both came back at ~1.4-1.5 s. Conclusion: the first reading was measurement noise, **no
evidence of a regression** from the grouping change. Worth knowing for future passes: this
methodology shows roughly ±0.5 s LCP swing between measurement windows on the same code, so a
single reading of a page should not be treated as a verdict either way.

Limits, stated plainly: this is Preview (and one Production before-state), not the merged code on
Production — Production does not run these changes yet. Production performance for the merged
batch can only be confirmed after the owner deploys it.
