# Phase 13 Repository Exposure Audit

**Level 4 document (point-in-time evidence).** Whether the CrawlPact repository was ever public,
and whether any current or historical source exposure exists.

## Current visibility (re-confirmed this phase)

`gh api repos/rmtlbandara/CrawlPact` → `private: true`, `visibility: "private"`. This repo is
**always to be treated as private** per standing instruction, regardless of any single future API
read to the contrary (see `docs/risks/ACTIVE_RISKS.md` RISK-027 for the history of one earlier,
transient "public" reading that did not reflect reality).

## Forks

`gh api repos/rmtlbandara/CrawlPact/forks` → `[]`. Zero forks exist. `allow_forking: true` is set
at the repository-settings level (a permissive default, not itself evidence of an actual fork) —
recorded here as a fact, not changed, since disabling it is a separate, low-priority hardening
step with no urgency given zero actual forks exist.

## GitHub Pages

`gh api repos/rmtlbandara/CrawlPact/pages` → HTTP 404 ("Not Found"). Pages is not enabled.
CrawlPact production runs entirely on Cloudflare Workers (`https://crawlpact.com`) — GitHub Pages
was never used and this phase made no DNS change.

## Releases

`gh api repos/rmtlbandara/CrawlPact/releases` → `[]`. Zero releases exist, so there is nothing to
audit for an attached sensitive artifact.

## GitHub Packages / npm publication

All 11 workspace `package.json` files carry `"private": true`, zero `publishConfig` fields exist
anywhere in the repository, and no `npm publish`/`pnpm publish`/`access: public` string was found
outside this validator's own detection code (`pnpm repo-privacy:validate`, which now runs in CI).

## Search-engine exposure

Searched (this phase, via live web search) for `"rmtlbandara/CrawlPact" github` and `CrawlPact
source code github repository`. Neither query returned any result referencing this repository —
only unrelated projects with "crawl" in their name. **This does not prove the repository was never
exposed** — search-engine absence is not proof of absence, and a search engine may simply not have
crawled/indexed a specific private-repo URL even if it were briefly reachable. It is the strongest
evidence reasonably obtainable without a dedicated search-index API subscription, and it found
nothing concerning.

## Historical exposure conclusion

No evidence was found, in this pass, that the repository was ever genuinely publicly exposed with
real external reach (no forks, no search-engine indexing, no cached raw.githubusercontent.com
reference found). The one prior "public" API reading (RISK-027's history) is treated as an
anomalous/transient artifact, not confirmed historical exposure — but this document does not claim
certainty either way, consistent with the instruction not to assume absence of evidence proves
absence of exposure. If future evidence surfaces a genuine historical exposure window, it should be
recorded in a dedicated `docs/security/HISTORICAL_SOURCE_EXPOSURE_ASSESSMENT.md` per the governance
process this phase establishes, and any secret live at the time of exposure should be rotated
regardless of what the exposure window turns out to have been — repository privacy does not make an
already-exposed secret safe again.
