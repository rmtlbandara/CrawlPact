# Phase 14 Independent Status-Plane Decision

**Level 4 document.** Evaluates whether `/status` sharing the main Worker and main D1 database with
the rest of CrawlPact creates unacceptable correlated-failure risk, per §82-87 of the Phase 14
prompt.

## The real risk, stated honestly

`/status` (`apps/web/src/pages/status.astro`) is served by the same `crawlpact-web` Worker and
reads from the same `crawlpact-db` D1 database as every other CrawlPact route. A full main-Worker
deployment failure, or a genuine D1 outage, would also make the status page itself unavailable —
at exactly the moment a visitor most wants to check it. `getPublicStatus()`'s own `catch` block
handles the _D1-query-throws-but-Worker-still-runs_ case correctly (`status_unavailable`, never a
false "operational"), but it cannot handle the case where the Worker itself never runs at all.

## Option A — Keep `/status` as-is (chosen)

**Advantages**: simple, uses existing architecture, no extra infrastructure, no extra DNS, no
second deployment pipeline to keep in sync, no second codebase surface to secure.

**Limitation, stated plainly**: a full main-Worker or Cloudflare account/zone-level failure would
also make `/status` unavailable. In that specific, narrow scenario, a visitor gets Cloudflare's own
generic error page (or no response) instead of a CrawlPact-branded "status information is
temporarily unavailable" message — a real, disclosed gap, not fixed this phase.

## Option B — Separate Cloudflare-only status Worker

Evaluated, **not implemented this phase**. Would require: a new Worker deployment
(`status.crawlpact.com`), a new subdomain + DNS record, and (if a live snapshot rather than a
static "check the dashboard" page is wanted) a new KV namespace — every one of which is real
production infrastructure requiring its own explicit approval before creation, per this repository's
standing rule and the Phase 14 prompt's own §86 ("requires explicit infrastructure approval before
production write. Do not create them automatically merely because Option B is technically
better."). No such approval was sought or given this phase.

Even if built, a separate Cloudflare Worker would remain dependent on Cloudflare itself — correctly
described as an **"independently deployed status surface,"** never "fully independent status" (§87).
It would not protect against a genuine Cloudflare account/zone-level outage, only against a
CrawlPact-specific Worker/D1 problem — a real but narrower improvement than "full independence"
might imply.

## Decision

**Option A, kept.** At CrawlPact's current real scale (a handful of accounts, no history of a
correlated status-page outage ever having actually occurred), the operational cost of a second
Worker/DNS/KV surface (more to deploy, more to secure, more to keep in sync, a second place the
Phase 13 private-repository/public-boundary rules must be independently re-verified) outweighs the
benefit of protecting against a failure mode that has never been observed.

## Concrete future trigger

Revisit Option B if **either**:

1. A real production incident is ever _worsened_ specifically because `/status` was unavailable at
   the same time as the rest of the product (i.e. the correlated-failure risk actually materializes
   and costs something real), or
2. CrawlPact's growth trajectory crosses a scale where a customer-visible status page's own
   uptime becomes a distinct commercial commitment worth the added operational surface (revisit
   alongside `docs/operations/CLOUDFLARE_UPGRADE_TRIGGERS.md`'s own thresholds).

This is a deliberate decision, not a gap left unaddressed — see the Phase 14 prompt's own §150:
"Do not classify that decision as a failure when deliberate."
