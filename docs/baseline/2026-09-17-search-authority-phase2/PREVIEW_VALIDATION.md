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
on PR #205. Reran via `gh run rerun --failed`: passed clean on the second attempt, confirming
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
