# Phase 17 Pilot Data Model Decision

Status: current-authoritative.

## Decision

Three tables only — `pilot_cohorts`, `pilot_participants`, `pilot_feedback` (migration
`0036_customer_pilot.sql`). **No `pilot_invites` table** and **no `pilot_runs`/richer studies
model** — narrower than the Phase 17 prompt's own "possible" sketch (§30), per its own guidance
to "prefer the smallest useful model."

## Why no invite tokens (§36/§37)

CrawlPact has no email column anywhere in its schema (passkey/WebAuthn-only auth) — there is no
address to send an invite link to in the first place. A Super Admin can already look up any
existing user by ID, display name, or an owned domain via the existing `searchUsers`/
`GET /api/admin/users` endpoint (built in an earlier phase). Manual association through that
existing lookup is not "genuinely too error-prone" (the bar §37 sets for building invite-token
infrastructure) — it is the same mechanism Super Admins already use daily for every other
per-user admin action. Building a second identity/token system purely for pilot recruitment would
duplicate, not minimise, existing infrastructure.

## Why no separate `human_help` / support-intervention table

§77-79 want number/category/narrative of human-help interventions. Rather than a fourth table,
`pilot_participants.human_help_count` is a simple integer counter (incremented by a Super Admin
action), and the narrative is recorded through the **already-existing** `internal_user_notes`
mechanism (`addInternalNote`, built for general per-user admin notes), prefixed `[Pilot support]`
so it's greppable. This directly follows §29 ("use existing product truth first").

## What is deliberately NOT duplicated (§29, §33, §75)

`pilot_participants` stores no plan, subscription, domain count, or payment amount. Activation,
monitoring adoption, and paid conversion are computed live at read time from `domains` and
`subscriptions`/`billing_customers` (`apps/web/src/lib/admin/pilot-analytics.ts`), using the same
query shapes as the existing Phase 13 product-analytics dashboard — never a second derivation.

## Deletion/FK policy

- `pilot_participants.user_id` → `ON DELETE CASCADE` (participation is the user's own data;
  disappears with the account, matching the `internal_user_notes.user_id` /
  `domains.owner_user_id` precedent from migration `0015`).
- `pilot_cohorts.created_by_user_id` and `pilot_participants.added_by_admin_user_id` →
  `ON DELETE SET NULL` (actor references; an admin's own later account deletion must not corrupt
  pilot history, matching `internal_user_notes.author_user_id`'s precedent).
- `pilot_participants.pilot_cohort_id` → `ON DELETE CASCADE` from `pilot_cohorts`.
- `pilot_feedback.pilot_participant_id` → `ON DELETE CASCADE` from `pilot_participants`.

This means a normal account deletion (the existing 30-day-grace-period → hard-delete flow in
`purgeDeletedAccounts`) cascades cleanly through all three new tables with zero code changes to
the retention job — satisfying §176/§177 ("pilot cohort must not block account deletion").

## Controlled vocabularies

- `pilot_cohorts.status`: `draft`, `recruiting`, `active`, `analysis`, `completed`, `cancelled`.
- `pilot_participants.participation_status`: `invited`, `joined`, `active`, `completed`,
  `withdrew`, `inactive`, `disqualified` — `withdrew` and `inactive` are kept distinct per §163
  (a participant who asked to stop is not the same evidence as one who silently disappeared).
- `pilot_participants.segment`: `individual`, `professional`, `agency`, `multi_site`, `other`.
- `pilot_participants.acquisition_source`: `direct_owner_outreach`, `existing_contact`,
  `referral`, `organic_interest`, `other`.
- `pilot_feedback.category`: the 16-value list from §44 exactly.

## No entitlement coupling

Neither table has a plan, entitlement, or discount field. Adding a user to a pilot cohort has
zero effect on their `users.plan_id`, any `subscriptions` row, or any Paddle state — verified by
integration test (`no_entitlement_effect`).
