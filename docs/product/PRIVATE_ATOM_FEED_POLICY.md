# Private Atom Feed Policy

## Entitlement

| Plan                | Atom feed   |
| ------------------- | ----------- |
| Free                | Unavailable |
| Solo / Pro / Agency | Available   |

Source of truth: `plans.private_atom_feed_enabled` (unchanged by Phase 10).

## Enforcement — both at issuance and at every read (Phase 10 hardening)

- **At token creation** (`POST /api/notifications/feed-token`): `getPlan(db, user.planId)` checked,
  unchanged from before Phase 10.
- **At every feed read** (`GET /feed/:token.xml`, Phase 10 addition): `getFeedAccessByToken`
  re-verifies token validity, account status (`active`, not deleted/suspended), **and** current
  plan entitlement on every single request — a token alone can never bypass entitlement. Verified by
  `atom-feed-hardening.integration.test.ts`'s downgrade test: a token issued while Pro keeps
  returning 200 until the plan drops to Free, then immediately 404s, with `feed_tokens.revoked_at`
  confirmed still `NULL` throughout (proving the _read-time_ check, not revocation, is what stopped
  access).

## Plan downgrade

- Feed access stops immediately (read-time check above) — **without** requiring the token to be
  revoked. Phase 10 deliberately does not add automatic token revocation to the billing
  downgrade/webhook code paths (`apps/web/src/lib/billing/`), to avoid touching the repository's
  most sensitive, most heavily-guarded code (`apps/web/src/pages/api/billing/AGENTS.md`) for a
  requirement the read-time check already fully satisfies.
- **Re-upgrade**: since the token was never revoked, restoring entitlement makes the _same_ feed URL
  work again automatically — no re-activation step required. This is an intentional continuity
  choice (§35 permits "unless current policy intentionally preserves the old token"), not an
  oversight; verified by `atom-feed-hardening.integration.test.ts`.

## Token security (preserved, unchanged)

256-bit `crypto.getRandomValues` token, SHA-256 hash-at-rest (raw token never stored, never logged),
one active token per user (regenerating revokes the prior one first), explicit revocation via
`DELETE`, generic 404 for every invalid/revoked/entitlement-blocked/nonexistent-token case — no
response ever distinguishes _why_ access was denied.

## Metadata minimisation (Phase 10 hardening)

- Feed `<title>` is the fixed string `CrawlPact notifications` — no longer includes the account's
  display name.
- Feed `<id>` is `urn:crawlpact:feed:{sha256(userId).slice(0,32)}` — a stable, opaque, one-way hash,
  never the raw internal user id. Stable across token regeneration (identifies the feed, not the
  credential), so existing feed readers do not see the feed as "new" on a token regen.
- Each entry: title, opaque notification id, timestamps, escaped text content, and a same-origin
  deep link only — never raw target evidence, full robots.txt, private report tokens, user email,
  account id, Paddle data, or internal errors.

## Response headers

`Content-Type: application/atom+xml; charset=utf-8`, `X-Robots-Tag: noindex, nofollow`,
`Cache-Control: private, no-store` (added in Phase 10 — no header existed before), `Referrer-Policy:
no-referrer` (added), `X-Content-Type-Options: nosniff` (added). Never publicly cacheable; not in
the sitemap.

## Bounds and performance

Fixed 50-entry cap (unchanged). No `ETag`/conditional-request support was added — evaluated per
§40 and deliberately deferred: the feed is already fully re-derived from an indexed, bounded query
(`idx_notifications_user_id`/`idx_notifications_read_at`) on every request, so a conditional-request
optimisation would reduce response _payload_ size on a re-poll but not meaningfully reduce D1 read
cost, and it adds surface area (a new header + cache-validation code path) for a benefit not yet
measured as necessary. Revisit if a real feed-reader polling volume measurement shows it's needed.

## Account lifecycle

Account deletion: `feed_tokens.user_id` and `notifications.user_id` both cascade-delete via the
existing FK (`ON DELETE CASCADE`, migration 0006) — no explicit Phase 10 code needed; verified by
`atom-feed-hardening.integration.test.ts`'s deletion test (a token issued before deletion returns
404 after).
