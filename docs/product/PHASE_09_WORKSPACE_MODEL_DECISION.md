# Phase 09 — Workspace Model Decision

## Question

Does CrawlPact need a new first-class "workspace" (or organisation/tenancy) entity to support
domain groups, portfolio overview, agency branding, batch import, and export — or does the current
account-ownership model already safely support all five?

## Current model (verified)

Every domain-owning row already carries a direct `owner_user_id` foreign key straight to
`users.id`: `domains.owner_user_id`, `domain_groups.owner_user_id`, `shared_reports.owner_user_id`.
Plan (`users.plan_id`) is a direct 1:1 attribute of the user row. There is no intermediate
account/workspace/organisation table anywhere in `packages/database/src/schema/*.ts` — confirmed
by grep, not assumed.

## Decision

**Reuse the current account-ownership model. Do not introduce a new workspace entity.**

Checked against the prompt's own three preconditions for a first-class workspace entity, all fail:

1. **"Needed for future membership isolation"** — no team/membership feature is authorised (see
   `PHASE_09_TEAM_AND_MEMBERSHIP_DECISION.md`). There is nothing to isolate between yet.
2. **"Migration can preserve all current accounts"** — moot; there is no requirement driving the
   migration in the first place.
3. **Every capability Phase 9 needs — domain groups, portfolio overview, agency branding, batch
   import, export — already works, or is extended in this phase to work, against the single
   `owner_user_id` scope.** None of them requires a concept broader than "one user's own domains."

Introducing a `workspaces` table today would mean: a migration touching every domain-owning table,
a new indirection layer with no present consumer, and — per the prompt's own "6.4 No silent bulk
changes" / anti-overengineering framing — added surface area for account-isolation bugs (the exact
class of bug §44/§53 spend the most space warning against) with no corresponding product
requirement asking for it. That is a worse security posture, not a better one.

## What this phase calls "the agency workspace"

A new authenticated route (`/app/workspace`) and its supporting queries are a **view** over the
existing single-owner data — a portfolio-shaped read/aggregate layer, not a new tenancy boundary.
Every query in it filters by the same `owner_user_id = user.id` (or `owner_user_id = user.id AND
group_id = X`) predicate every existing domain/group query already uses. "Workspace" in UI copy
and route names means "your account's portfolio view," nothing more — it does not imply shared
access, a switchable multi-account concept, or a new authorization boundary.

## Fallback applied

Per the prompt's own "Single-owner workspace fallback": the workspace is a single-account
portfolio experience. No "Invite team," "Members," or account-switcher control is added anywhere
in this phase's UI — there is nothing behind such a control to enable, and a nonfunctional control
would violate §6.6 ("No fake collaboration").

## Re-evaluation trigger

Revisit this decision only if a future phase's SRS is amended to authorise multi-user team
membership (see `PHASE_09_TEAM_AND_MEMBERSHIP_DECISION.md`'s own re-evaluation trigger) — at that
point a real `workspaces` table with an owner-preserving migration would become necessary, and
this document's "reuse account ownership" conclusion would need to be revisited, not assumed to
still hold.
