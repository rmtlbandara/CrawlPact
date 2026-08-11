# Research correction and retraction policy

## Principle

A published Policy Observatory statistic is never silently rewritten (§47/§217). Every change to
already-published content goes through one of the two mechanisms below, both of which leave a
permanent, visible record.

## Correction

Used when a bug in the metric computation itself (not a registry change) produced wrong numbers
for a release the publication is still pinned to.

- `correctResearchPublication(db, id, { what, why, conclusionsChanged })` — recomputes content from
  the _same_ `registry_version_id` the publication was originally pinned to (refuses if that
  release is no longer the active one, since a correction must not silently switch data sources —
  §24).
- Appends `{ date, what, why, conclusionsChanged }` to `correction_log` — never overwrites or
  removes a prior entry.
- Sets `status = 'corrected'` and `corrected_at`; the row stays at the same `slug`/URL.
- The public `/research/[slug]` page always renders the full `correction_log`, with a banner when
  `status === 'corrected'`.
- Every field: `what` (what changed), `why` (the reason), `date` (recorded automatically), and
  `conclusionsChanged` (a boolean the admin must explicitly set) are required — an API request
  missing any of them is rejected (`correctRequestSchema` in
  `apps/web/src/pages/api/admin/research/publications/[id]/correct.ts`).

## Withdrawal

Used when a publication is materially wrong in a way a correction cannot fix, or should no longer
be presented as current guidance.

- `withdrawResearchPublication(db, id, reason)` — terminal; sets `status = 'withdrawn'` and
  `withdrawal_reason`.
- The row and its URL are **not** deleted or 404'd. `/research/[slug]` renders a prominent
  withdrawal banner with the reason instead of the publication's data (§217/§139).
- A withdrawn publication is excluded from `/research`'s "latest research" list and from
  `listPublishedResearchPublications()`, so it stops being discoverable going forward while
  remaining inspectable at its existing URL.

## What is never done

- No `UPDATE research_publications SET content_json = ...` outside the governed
  correct/withdraw paths.
- No deletion of a published or corrected row.
- No re-use of an existing `slug` for materially different content — a genuinely new finding gets a
  new publication (and, if it replaces an old one, the old one would be marked `superseded` —
  status modelled but not yet exercised this phase, since only one publication kind exists).
