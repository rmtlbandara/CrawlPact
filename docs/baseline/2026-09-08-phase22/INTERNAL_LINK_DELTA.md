# Phase 22 Internal Link Delta

## Found: Phase 20's canonical-link sweep never touched Markdown content

Phase 20's internal-link canonicalization (trailing slash for every indexable page except `/`)
covered `.astro` files via a sed-based sweep, but never touched
`apps/web/src/content/**/*.md` — the crawler/guide/platform/vertical content collections. Found
live this phase while adding a link to the new Amazon comparison guide and noticing the existing
`claudebot-vs-claude-user-vs-claude-searchbot.md` guide (used as a structural template) itself
linked to `/tools/ai-crawler-checker` without a trailing slash.

A full sweep found **49 files** across `crawlers/`, `guides/`, `platforms/`, and `verticals/` with
at least one bare (non-canonical) internal link — every single crawler-directory and guide file
except a handful, plus all 5 platform guides and all 4 vertical pages. These links worked (Phase
20's `public/_redirects` 301s the bare form), but they reintroduce exactly the pattern of
noncanonical internal link Phase 20's own contract prohibits (phase prompt Section 2: "Do not
reintroduce noncanonical internal links").

## Fix

A scripted, precise sweep (not a blind find-replace) matching only genuine internal links against
the exact canonical route list (`apps/web/src/lib/route-registry.ts`'s `PRERENDERED_ROUTES` +
`SSR_INDEXABLE_ROUTES`, plus the three content-collection prefixes `crawlers/`, `guides/`,
`platforms/`), applied trailing slashes to every real link while leaving two illustrative
`/docs/api` / `/docs/getting-started` links untouched — those sit inside a fenced code example in
`how-to-publish-an-llms-txt-file.md` demonstrating a _hypothetical_ site's own `llms.txt` content,
not real CrawlPact navigation.

## Regression test added

`scripts/content-validate.mjs` (run as part of `pnpm run content:validate` and the full quality
gate) now scans every crawler/guide/platform/vertical body for a bare canonical-page link or a bare
`/crawlers/`, `/guides/`, or `/platforms/` collection link, and fails the build if one is found.
Verified against both failure modes with a deliberately-reintroduced bad link before restoring the
real content (see the completion report's quality-gate section for the exact verification output).

## New links added (beyond the mechanical sweep)

- `amazonbot.md`, `amzn-searchbot.md`, `amzn-user.md` → `/guides/amazonbot-vs-amzn-searchbot-vs-amzn-user/`
  (new, this phase).
- `amazonbot-vs-amzn-searchbot-vs-amzn-user.md` (new) → `/crawlers/amazonbot/`,
  `/crawlers/amzn-searchbot/`, `/crawlers/amzn-user/`, `/guides/perplexitybot-vs-perplexity-user/`
  (cross-family reference, since it makes the same robots.txt-compliance point Perplexity's own
  comparison guide makes), `/tools/ai-crawler-checker/`, `/limitations/`.

No sitewide navigation (header/footer) was changed — these are contextual, within-content-body
links only, per the phase prompt's Section 53 ("no sitewide link spam... use the smallest
appropriate set").
