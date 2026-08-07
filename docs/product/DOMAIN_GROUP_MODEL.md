# Domain Group Model

Domain groups already exist (`domain_groups` table, migration 0005, `apps/web/src/lib/groups.ts`).
Per `PHASE_09_CLIENT_ENTITY_DECISION.md`, this phase extends the existing model rather than adding
a parallel entity. Canonical term: **"group"** in code/schema, **"Client group"** in UI copy where
the existing label already appears (`DomainsManager.tsx`) — kept consistent, not renamed.

## What already worked before this phase (unchanged)

Create, rename, assign domains, filter domains by group, view group-level domain count. All via
existing `lib/groups.ts` functions and `/api/groups/**` routes.

## What this phase adds

### 1. `description` column (additive)

`domain_groups.description TEXT NULL` — optional internal note, length-capped (500 chars,
enforced server-side), escaped on every render path, **never included in CSV export by default**
(§47 — internal notes require explicit opt-in), never sent to analytics.

### 2. Safe deletion of a non-empty group

The existing `deleteGroupIfEmpty` (`lib/groups.ts`) is preserved as-is for the empty case; a new
function `deleteGroupWithReassignment(db, userId, groupId, destinationGroupId | null)` handles the
non-empty case:

1. Verify the group is owned by `userId`.
2. If `destinationGroupId` is provided, verify it too is owned by `userId` and is not the group
   being deleted.
3. In one transaction: `UPDATE domains SET group_id = destinationGroupId WHERE group_id = groupId
AND owner_user_id = userId`, then soft-delete the group (`deleted_at = now`).
4. Domain history, monitoring state, scans, and change events are untouched — only `group_id`
   moves. `destinationGroupId = null` means "move to Ungrouped" (the existing meaning of a null
   `group_id`, already how every non-grouped domain is represented today — no new "Ungrouped"
   row is created).

The UI (`GroupsManager.tsx`, extended) shows the consequence — "12 domains will move to
Ungrouped" or "12 domains will move to {destination}" — before the confirm action fires, per §16
and §29's "show the consequence before confirmation."

### 3. Group limits

No new numeric group-count limit is introduced — the prompt is explicit that one should not be
invented without a requirement defining it. The existing implicit technical bound (an account can
have at most as many groups as it's practical to create one-by-one through the UI, i.e.
effectively bounded by the ≤100 saved-domain ceiling in practice) is left as-is; this is
documented, not silently assumed adequate forever.

### 4. Group-level overview page (`/app/groups/[groupId]`, new)

Shows: group name, `description` if set, domain count, monitoring coverage, domains requiring
attention (reuses `PORTFOLIO_ATTENTION_MODEL.md`'s query, filtered to this `group_id`), recent
meaningful changes (reuses `listPortfolioChangeFeed`, filtered to this `group_id`), the group's own
domain list (paginated, reusing the portfolio-table component), and group-scoped
import/export/rename/delete actions. Uses the same explainable-count model as the account-wide
portfolio summary — no separate scoring model for groups (§18).

### 5. Portfolio table (`/app/workspace/domains`, new)

The Phase 9 superset of `DomainsManager.tsx`'s list. Key difference from the existing
`/app/domains` view: **server-side pagination** (`DomainsManager.tsx` currently loads every saved
domain in one request and filters/sorts client-side — a deliberate Phase 8 decision documented in
`SAVED_DOMAIN_INFORMATION_ARCHITECTURE.md`, reasoned safe because the ≤100-domain cap keeps the
unpaginated payload small). Phase 9 §19 explicitly requires server-side pagination for the
portfolio-scale view, so this new route implements it (`GET /api/workspace/domains?cursor=&limit=&group=&attention=&monitoring=&changeOrigin=&scanState=&period=&sort=`,
keyset-paginated, default page size 25, max 100) — `/app/domains` itself is untouched, since its
own existing design rationale (bounded by the domain cap) remains valid for that simpler view; the
two routes intentionally differ in this one respect, most agencies at the Agency-plan ceiling will
use the new portfolio table, not the old flat list.

Columns/filters/sorting/search match prompt §19 exactly (see the route's own JSDoc for the full
column list); search is restricted to `displayName`, `canonicalOrigin`, and `domainGroups.name` —
never raw evidence JSON.

## Privacy

A group proves nothing about client identity, domain ownership, or authorisation to manage the
site (§6.3, restated verbatim in the UI's group-creation help text) — this is existing behaviour,
restated here because it remains true after this phase's additions.
