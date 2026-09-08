# Phase 23 Research Authority Plan

Per Section 20's required sequence, checked in order before considering any research generation.

## 1. Current active registry release

`registry_versions` (production D1, direct read-only query this session): exactly one row —
`2026.07.3`, `is_active = 1`, `published_at = 2026-07-28`. This is the same release Phase 15/17
established and Phase 22 did not change.

## 2. Pending candidate

None. No second row exists in `registry_versions` — there is no candidate release awaiting
review or publication. This differs from the historical note in the phase prompt itself ("Amazon/
Google/Bingbot corrections were pending explicit Super Admin publication") — that pending state
evidently either was already resolved in an earlier phase or never reached the point of having a
formal `registry_versions` candidate row created. Current-authoritative state, verified directly
this session: **no candidate is pending**.

## 3. Official-source validity

Phase 22 re-verified Amazon's and Perplexity's official documentation this week (fresh fetches,
2026-09-08) and found the active registry's `crawlers` table records for these operators
**factually accurate but less complete** than the public content pages now are:

| Token             | Registry DB `description`                             | Gap vs. the Phase 22 content-page finding                                                                    |
| ----------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `Amzn-SearchBot`  | States search purpose and no-AI-training fact         | Does not mention the robots.txt fallback-to-other-search-bots behaviour                                      |
| `Amzn-User`       | States user-triggered purpose and no-AI-training fact | Does not mention "may not follow all robots.txt directives"                                                  |
| `Perplexity-User` | States user-triggered purpose                         | Does not mention "generally ignores robots.txt rules" — the more operationally important fact Phase 22 found |
| `PerplexityBot`   | States search purpose                                 | Does not explicitly state it respects robots.txt                                                             |

**Nothing in the active registry is wrong.** It is incomplete relative to newer, richer public
content — a real gap, but not a data-integrity problem that would make a registry-derived research
publication (which discusses counts, purposes, and operators, not per-token robots.txt-compliance
prose) inaccurate.

## 4. Semantic change classification

The Phase 22 additions are **additive facts**, not corrections to token, operator, or purpose
fields — the columns a quantitative "Registry Landscape" publication would actually draw from
(operator counts, purpose distribution, token counts, lifecycle status) are unaffected. A
publication generated from the current active release would not misstate any of that.

## 5. Registry candidate validation

Not applicable — no candidate exists to validate.

## 6. Governed publication requirement

**Not performed this phase, and not attempted.** Generating a research draft
(`POST /api/admin/research/publications`) requires an authenticated Super Admin session
(`requireAdminAction`) against Production — this session has direct D1 read access (via the
Cloudflare API token) but no real Production admin browser/API session, and creating one would
require either impersonating the owner's WebAuthn credential (impossible) or bypassing the admin
auth boundary (forbidden, per Section 21: "Never directly mutate Production D1 or bypass Super
Admin publishing"). This is a correct, intentional boundary, not a gap this phase should route
around.

## Readiness verdict

**Ready for a human-initiated draft**, contingent on one decision: whether to first create a
registry candidate enriching the `Amzn-SearchBot`/`Amzn-User`/`Perplexity-User`/`PerplexityBot`
descriptions with Phase 22's robots.txt-compliance facts (a real content improvement, but not a
blocker for a _quantitative_ landscape publication), or to generate the first draft from
`2026.07.3` as-is and enrich the registry separately on its own governed cadence.

**Recommendation**: generate the first draft from the current active release now. A quantitative
"N operators, M crawler tokens, purpose distribution across the active registry" publication does
not depend on the per-token compliance prose gap identified above, and Section 85 explicitly warns
against holding an asset back "merely because a visible date changes" — the same principle applies
to holding back an otherwise-valid publication over an unrelated content-richness gap. The registry
enrichment is recorded as its own, separately-tracked item in `OUTREACH_OWNER_ACTION_QUEUE.md`.

## What the owner needs to do (see `OUTREACH_OWNER_ACTION_QUEUE.md` for the full queue)

1. Sign in to `/admin/research` on Production as Super Admin.
2. Generate the "AI Crawler Registry Landscape" draft (`POST .../publications`, already wired to
   the UI) from the active `2026.07.3` release.
3. Review the generated findings for accuracy and tone (no "N% of the internet" claims — the
   generator is expected to already express things as "N of M records in registry release X," per
   Section 23; verify this holds in the actual generated output before proceeding).
4. Submit for review → validate → publish, through the existing lifecycle. Do not skip steps.
5. Record the outcome in this file (or a dated successor) once it happens — this phase's own
   package cannot record a publication that has not occurred, per Section 118 ("If publication
   does not occur: state why. Do not claim it occurred.").

## Corpus/representative-web claims

No representative-web corpus exists (Phase 16's Layer B remains deliberately deferred — no
proposed corpus, inclusion/exclusion method, bias/privacy review, or product-owner approval exists
for it). This phase does not revisit that gate. Any research publication generated from the
existing registry-only workflow must confine its claims to CrawlPact's own registry ("N of M
tracked crawler tokens..."), never to "the web" or "websites in general."
