# Phase 22 Decisions

## Decision: treat Phase 21's Production deployment as real despite the stale prompt snapshot

See `README.md`'s "Prerequisite check" section for the full reasoning. Verified directly against
live Production (Worker `7641c131-3a10-4502-99ca-99a6733eb7d8`, commit `72414dd8`) rather than
either blindly trusting the phase prompt's stale snapshot or blindly trusting my own prior claim —
independent re-verification via direct `curl` against `crawlpact.com`.

## Decision: two real crawler-family reviews, not a sweep of all ~90 content pages

Amazon and Perplexity were both explicitly named as required reviews in the phase prompt (Sections
23-24) and both had concrete GSC evidence of query ambiguity. Expanding to every crawler family
(there are ~15 multi-token operator families in the registry) without equivalent evidence would
have been exactly the "we will rewrite 20 pages" anti-pattern the phase prompt's Section 27
explicitly warns against.

## Decision: reject a `/platforms/nextjs/` page

The phase prompt's own Section 41 anticipated this temptation directly ("Do not automatically
create `/platforms/nextjs/` merely because a Vercel query includes 'Next.js.'"). Evaluated against
the strict new-page gate (Section 55) anyway, for completeness:

1. Distinct user intent? Weak — Vercel's own guide already covers Next.js-specific behavior
   (`app/robots.ts`, Metadata Routes, `VERCEL_ENV`) in depth.
2. Existing pages insufficient without incoherence? No — `/platforms/vercel/` already handles this
   coherently.
3. Meaningful evidence? No distinct GSC cluster found — the "Next.js" mention was in the phase
   prompt's own hypothetical, not in this phase's actual query data (which, per `GSC_BASELINE.md`,
   returned zero named queries for `/platforms/vercel/` at all — nothing to point to a Next.js-
   specific sub-intent).
4. Substantial unique value beyond what Vercel's guide already provides? No.

Criteria 1, 3, and 4 fail outright — the gate requires all ten to pass. **Rejected.** No page
created.

## Decision: `/guides/amazonbot-vs-amzn-searchbot-vs-amzn-user.md` passes the same gate

Evaluated against all 10 criteria in `CONTENT_CHANGE_REGISTER.md`'s entry for this file — all 10
pass, most decisively criterion 10 ("would still be worth publishing if Google sent zero traffic")
since the comparison is genuinely useful to any site owner managing `robots.txt` across all three
Amazon tokens regardless of whether it ever ranks, and criterion 6 (won't become a thin variation)
since the existing, working `claudebot-vs-claude-user-vs-claude-searchbot.md` and
`perplexitybot-vs-perplexity-user.md` guides prove this exact pattern already serves real,
non-thin content on this site.

## Decision: fix the 49-file internal-link canonicalization gap now, not defer it

This is arguably a Phase 20 regression-adjacent finding rather than pure Phase 22 content work, but
the phase prompt's own Section 2 requires exactly this: "If Phase 22 discovers an actual Phase 20
regression, document it separately and fix the regression before proceeding with content work."
Fixed first, with its own regression test, before any of the content-strengthening edits in
`CONTENT_CHANGE_REGISTER.md` were made — several of those edits add new internal links, and fixing
the pattern first meant the new links could be written correctly from the start rather than fixed
twice.

## Decision: do not deploy to Production this turn

Per `CLAUDE.md`'s standing rule and the phase prompt's own Section 90 ("This Phase 22 prompt does
NOT authorize a Production deployment... Do not assume authorization from Phase 20 or 21"). See the
completion report for the exact verdict and what remains.

## Measurement checkpoints (Section 93)

- **T0** (this phase's baseline): 2026-09-06 settled date, recorded in `GSC_BASELINE.md`.
- **T+7**: technical/indexing/reprocessing check only (has Google recrawled the changed Amazon/
  Perplexity crawler pages and the new comparison guide? has `/platforms/`/`/audit/` moved off
  "unknown to Google"?) — no ranking conclusion drawn at this checkpoint.
- **T+28**: first directional comparison against the T0 28-day baseline — reported with the same
  restraint as `GSC_BASELINE.md`'s own 14d/28d comparison (exact date ranges shown, no percentage
  headline without them, confounding factors named).
- **T+56**: stronger trend comparison, still with the explicit caveat that CrawlPact's traffic
  volume makes even a 56-day window a small sample.

These checkpoints are not scheduled as automated jobs — they are a plan for whoever next reviews
Phase 22's real-world outcome (a future session or the product owner) to follow, using the same
`~/.config/crawlpact-gsc/` tooling and the same `2026-09-06` settled-date baseline recorded here.
