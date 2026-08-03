# Brand Positioning and Messaging System

**Level 1 document (Current authoritative).** The single source of truth for CrawlPact's brand
positioning, messaging hierarchy, and canonical copy variants. Established Phase 2 (Brand
Positioning and Messaging System), 2026-08-03, building on the corrected source-of-truth
established in Phase 1. When any other document's product description, tagline, or positioning
language conflicts with this document, this document wins — correct the other document, not this
one, unless verified product reality has changed (in which case update here first).

Do not duplicate the complete system below in other documents — link here instead.

## Product definition

- **One-sentence**: CrawlPact independently audits and monitors the public policy signals
  websites publish to AI crawlers.
- **Short**: CrawlPact audits robots.txt and related public signals, separates search from
  training and agent crawlers, explains conflicts, and monitors policy changes across any hosting
  provider.
- **Medium**: CrawlPact is an independent AI crawler policy audit and monitoring platform. It
  shows what a website currently tells search, training, retrieval, and agent crawlers, preserves
  evidence, explains conflicting signals, and detects both website-policy and verified
  crawler-registry changes.
- **Long**: CrawlPact is the independent AI crawler policy audit and monitoring platform for
  agencies and multi-site teams. It shows what each website tells search, training, retrieval, and
  agent crawlers, explains policy conflicts, and alerts teams when either the website
  configuration or verified crawler registry changes — across any hosting provider or CDN.
  CrawlPact audits the public policy signals a website publishes; it does not control external
  crawlers or guarantee that they will comply.

## Category definition

- **Public product category**: AI crawler policy audit and monitoring — use in search-oriented,
  introductory, and explanatory contexts.
- **Strategic product category**: AI crawler policy governance — use selectively in strategic,
  agency, portfolio, and long-form contexts. Never rely on "governance" alone as the first
  explanation a new visitor sees; it is too abstract without the public category alongside it.
- **Why CrawlPact is not merely a robots.txt checker**: a robots.txt checker validates syntax
  against one file at one point in time. CrawlPact evaluates robots.txt alongside llms.txt, RSL,
  Content Signals, and relevant HTML/HTTP signals together; classifies findings against a
  versioned, source-verified crawler-purpose registry (distinguishing search from training from
  retrieval from agent crawlers); detects conflicts between signals; and monitors for both
  website-side changes and registry-side changes over time, preserving evidence at each point.
  None of that exists in a one-shot syntax checker.

## Audience hierarchy

### Primary: agencies and multi-site teams

Core jobs: audit many client/portfolio websites consistently; identify crawler-policy mistakes;
distinguish search, training, retrieval, and agent purposes; preserve policy evidence; detect
changes after deployments or CDN updates; explain findings to clients or stakeholders; monitor
registry-driven changes; demonstrate ongoing governance.

Value statement: _Independently audit and monitor AI crawler policy across every website you
manage._

### Secondary: publishers and content businesses

Core jobs: protect intentional content-policy decisions; permit selected search visibility while
controlling declared training access; detect conflicts and CDN rewrites; preserve evidence for
internal decisions.

Value statement: _Understand and monitor what your publishing sites declare to AI search,
training, and retrieval crawlers._

### Secondary: SaaS and documentation teams

Core jobs: preserve documentation discoverability; separate search from training policy; detect
accidental changes during deployment; keep a historical policy record.

Value statement: _Keep public documentation policy intentional, explainable, and monitored
through every release._

### Supporting: individual website owners

Core jobs: understand current crawler policy; find ambiguous rules; apply evidence-backed
corrections; save a baseline for future monitoring.

Value statement: _Audit one website free and understand what its public policy tells AI
crawlers._

**Public messaging is not agency-exclusive.** A clear free, single-site entry point is preserved
throughout; the paid-value story is agency-first, not agency-only.

## Problem hierarchy

1. Policy ambiguity
2. Cross-signal conflicts
3. Search-versus-training confusion
4. Website-policy drift
5. Registry drift
6. Missing evidence
7. Portfolio inconsistency

## Outcome hierarchy

1. Understand current declarations
2. Detect mistakes and conflicts
3. Preserve evidence
4. Monitor future changes
5. Govern multiple websites consistently

## Differentiation

Independent · Vendor-neutral · Cross-provider · Purpose-aware · Evidence-backed · Versioned ·
Change-aware · Portfolio-capable · No installation required · No traffic-log requirement for
policy auditing · Deterministic and explainable.

**Core differentiator statement**: Independent, vendor-neutral crawler-policy evidence across
any hosting provider or CDN.

## Product boundaries

CrawlPact audits the public policy signals a website publishes. It does not control external
crawlers or guarantee that they will comply. Specifically, it does not:

- Enforce network-level crawler blocking (no WAF/reverse-proxy functionality)
- Guarantee any specific crawler's real-world compliance
- Prove real crawler access without traffic logs (which it does not ingest)
- Provide legal certification of any kind
- Perform broad, general-purpose SEO crawling
- Provide traffic-log analytics

See `docs/product/PRODUCT_SCOPE.md` for the full current-vs-planned-vs-out-of-scope breakdown.

## Brand promise

- **Canonical**: Know what your website tells AI crawlers — and when it changes.
- This replaces the inaccurate prior wording "Know what AI crawlers can access" (the product
  audits public declarations and responses; it does not independently prove actual crawler access
  or obedience — see `docs/brand/CLAIMS_AND_MESSAGING_GUIDE.md`).

## Tagline

- **Canonical**: AI crawler policy, verified.
- Contextual alternatives must preserve the same meaning; do not introduce a second, conflicting
  tagline on any current surface.

## Primary product outcome

Prevent crawler-policy mistakes and detect changes before they create visibility,
content-control, reporting, or client-trust problems.

## Brand enemy

Not AI itself — the central problem is **crawler-policy ambiguity and drift**: search and
training crawlers treated as one group; important crawlers left unspecified; CDN-generated
policy differing from intended policy; deployment changes silently altering public rules; new
crawler tokens entering the registry; different public policy signals contradicting one another;
teams lacking evidence of what a website published at a given time.

## Functional and emotional value

- **Functional**: Audit, explain, preserve, and monitor AI crawler policy.
- **Emotional**: Confidence in a fast-changing and technically ambiguous area.

## Brand principles

Independent · Evidence-led · Purpose-aware · Change-aware · Precise · Calm · Transparent ·
Technically credible · Honest about uncertainty · Respectful of customer policy decisions.

## Audience-specific value propositions

| Audience                 | Value proposition                                                                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Agencies                 | Independently audit and monitor AI crawler policy across every website you manage.                                                                                                                                 |
| Publishers               | Understand and monitor what your publishing sites declare to AI search, training, and retrieval crawlers.                                                                                                          |
| SaaS/documentation teams | Keep public documentation policy intentional, explainable, and monitored through every release.                                                                                                                    |
| Technical consultants    | CrawlPact fetches and evaluates publicly accessible crawler-policy signals against a versioned, source-backed crawler registry and produces deterministic findings, evidence, recommendations, and change records. |
| Individual owners        | Audit one website free and understand what its public policy tells AI crawlers.                                                                                                                                    |

## Objection handling

- **"Is this just robots.txt validation?"** No — CrawlPact evaluates robots.txt together with
  llms.txt, RSL, Content Signals, and relevant HTML/HTTP signals against a versioned,
  source-verified crawler-purpose registry, and monitors for change over time. A syntax checker
  does none of that.
- **"Does this block crawlers?"** No. CrawlPact audits and monitors declared policy; it does not
  enforce network-level blocking. See the approved boundary statement.
- **"Why pay after fixing the file once?"** Because policy drifts: deployments, CDN
  configuration, and the crawler registry itself all change independently of any one-time fix.
  Monitoring catches drift a single audit cannot.
- **"Cloudflare already has crawler controls."** Cloudflare's controls are enforcement-layer and
  vendor-specific. CrawlPact is independent, vendor-neutral evidence across any hosting provider
  or CDN — including whatever Cloudflare (or any other CDN) may be silently rewriting into your
  declared policy.
- **"Why does registry monitoring matter?"** Crawler classifications and new tokens change
  independently of your website. A website-policy change and a registry-driven change require
  different responses; CrawlPact distinguishes them explicitly.
- **"Does robots.txt guarantee compliance?"** No standard guarantees crawler compliance.
  CrawlPact reports what is declared and observed, never a guarantee of external behaviour.
- **"Why separate search from training?"** Many real crawler tokens serve different purposes
  under one operator (e.g. a search crawler vs. a training crawler vs. a retrieval crawler).
  Treating them as one group hides intentional policy decisions.
- **"Is llms.txt important?"** It is an emerging, optional signal — CrawlPact evaluates it where
  present but never presents it as universally adopted or required.
- **"Do I need server-log access?"** No — CrawlPact audits public policy signals; it does not
  require or ingest traffic logs.

## CTA hierarchy

See `docs/brand/CLAIMS_AND_MESSAGING_GUIDE.md` for the full CTA rules and
`docs/brand/MESSAGING_SURFACE_INVENTORY.md` for where each is currently used. Summary:

| CTA                           | Canonical wording                                              |
| ----------------------------- | -------------------------------------------------------------- |
| Primary acquisition           | Audit a domain                                                 |
| Secondary education (Phase 4) | View a sample report                                           |
| Account conversion            | Save and monitor this domain                                   |
| Monitoring                    | Enable monitoring                                              |
| Billing                       | Choose Solo / Choose Pro / Choose Agency                       |
| Report                        | View evidence / Compare changes / Export report / Share report |

## Proof hierarchy

Only genuine, verifiable proof may be used: real production capability evidence
(`docs/status/CURRENT_STATE.md`), real test coverage, real registry source citations. No
testimonials, customer logos, usage counts, uptime percentages, or "trusted by" language without
real, permission-cleared evidence — see `docs/brand/CLAIMS_AND_MESSAGING_GUIDE.md`.

## Claims governance

All product claims must be classified and evidenced per
`docs/brand/CLAIMS_AND_MESSAGING_GUIDE.md` before publication.
