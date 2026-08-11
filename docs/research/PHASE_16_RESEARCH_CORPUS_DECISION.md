# Phase 16 research corpus decision

## Decision

**Do not build Layer B (Website Policy Observatory) this phase.** Ship Layer A (Registry
Observatory) plus the full research-governance/methodology framework instead. This is the
explicitly sanctioned outcome (Phase 16 prompt §12/§188/§189/§227) when no approved representative
corpus exists — "Do not wait for a perfect representative dataset before building useful registry
research. Do not pretend the pilot is representative."

## Options evaluated

**Option A — Fixed, manually curated public benchmark corpus.** Simple, reproducible, no external
API dependency, stable for longitudinal comparison. Limitation: selection bias, not representative
of the web. **Preferred option once Layer B is greenlit** — but curating even a small (~50–250
site) bounded corpus responsibly (excluding private/internal targets, documenting inclusion rules,
reviewing licensing where any external list is involved) is real editorial and privacy-review work
that was not done this phase, and doing it hastily to hit a deadline would produce exactly the
"weak or unrepresentative statistic" the prompt explicitly says not to publish.

**Option B — External public ranking/list dataset.** Only viable when a licence permits use, the
source can be archived/versioned, no paid API is required, and methodology is disclosed. Not
evaluated in detail this phase — no such source was reviewed or approved.

**Option C — Customer/user scan aggregate.** Explicitly not implemented by default. Would require a
separate, explicit privacy/product-owner decision this phase did not seek. Customer saved-domain
portfolios and Agency client portfolios remain excluded from any public research dataset — see
`PHASE_16_RESEARCH_PRIVACY_THREAT_REVIEW.md`.

**Option D — Opt-in research participation.** Potential future approach; not built, since nothing
currently requires it.

## What this means for Phase 16's actual output

- Only the Registry Observatory (Layer A) and the first "AI Crawler Registry Landscape"
  publication ship this phase — both use only Phase 15 registry data, never a customer website.
- `/observatory/policies` (the Website Policy Observatory route) is **not created**. `/research`
  and `/observatory` both state plainly that no website-policy research has been published yet,
  rather than showing an empty "coming soon" page.
- No research crawler, no `research_corpora`/`research_runs`/`research_observations` tables, and no
  `CrawlPactResearch/1.0` user-agent traffic exist yet. `RESEARCH_CRAWLING_POLICY.md` defines the
  policy that would govern Layer B _if and when_ it is approved and built — it is a forward-looking
  policy document, not a description of a running system.

## Re-evaluation trigger

Revisit this decision when: (a) a specific Option A corpus has been proposed and reviewed for bias
and privacy exposure, (b) a capacity estimate for the corpus size under consideration has been
produced (see `PHASE_16_RESEARCH_STORAGE_CAPACITY_MODEL.md`'s methodology, applied to a real
corpus size), and (c) product ownership has explicitly approved spending engineering time on
Layer B rather than other roadmap priorities.
