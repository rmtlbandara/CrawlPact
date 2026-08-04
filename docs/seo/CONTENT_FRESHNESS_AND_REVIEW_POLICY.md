# Content freshness and review policy (Phase 7)

Extends `docs/seo/EDITORIAL_SOURCE_AND_CONTENT_POLICY.md`'s existing "How last-verified dates are
assigned" and "How guide updates are reviewed" rules (unchanged, still authoritative for guides
and crawler pages) with the review cadence and status vocabulary Phase 7's new vertical/platform
content needs.

## Review triggers

A vertical or platform page is due for review when any of the following happens:

- The referenced official documentation changes (platform guides).
- The platform ships a feature change relevant to crawler-policy delivery (e.g., a new managed
  `robots.txt` control).
- CrawlPact's own scanner logic changes in a way that affects what "what CrawlPact can verify"
  actually means.
- The crawler registry changes in a way relevant to a page's claims.
- Pricing or plan entitlements change (`docs/billing/APPROVED_PRICING_AND_ENTITLEMENT_MATRIX.md`)
  — vertical pages read pricing live from `getPlanCatalog()`, never a duplicated figure, so this
  triggers a content _review_ (does the recommended-plan reasoning still hold?), not necessarily a
  content _edit_.
- An official source link breaks (see below).
- A user/support-reported inaccuracy.
- A scheduled cadence elapses (below).

## Scheduled cadence

- **Platform guides**: every 90 days, or immediately after a material platform change — whichever
  comes first.
- **Vertical pages**: every 6 months, or immediately after a product/pricing change.
- **Official-source link validation**: monthly (automatable; see
  `docs/seo/SEO_CONTENT_GOVERNANCE.md`'s Phase 7 addendum for the link-check script).
- **Pricing references**: validated automatically, every build — vertical pages never hard-code a
  price, so there is nothing to go stale (see `docs/seo/SEARCH_INTENT_AND_PAGE_MAP.md`'s
  `recommendedPlan` field, which names a plan _key_, not a figure).
- **Product-capability references**: reviewed after any relevant release (i.e., whenever a phase
  changes what a plan includes).

## Status vocabulary

Every Phase 7 page is, at any time, in exactly one of:

| Status               | Meaning                                                                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `current`            | Reviewed within its cadence window; no known inaccuracy.                                                                                                         |
| `review-due`         | Cadence window has elapsed; not yet re-checked. Still indexable — a page overdue for review is not automatically wrong, just unconfirmed.                        |
| `under-review`       | An editor/agent is actively re-verifying this page against current sources.                                                                                      |
| `partially-outdated` | A specific, identified claim is known to be stale but the rest of the page remains accurate — the affected section is flagged inline, not the whole page pulled. |
| `archived`           | No longer published; superseded by a merged/renamed page.                                                                                                        |
| `redirected`         | The URL now redirects (see "Redirects" below) — the content itself lives elsewhere or no longer exists.                                                          |

Materially inaccurate content is never left indexable under a `current` or `review-due` status —
it moves to `partially-outdated` (with the inaccuracy corrected or flagged) or `archived`
immediately on discovery, regardless of where it falls in the scheduled cadence.

## Broken official-source handling

1. The broken link is flagged, not silently removed.
2. The claim it supported is re-verified against a fresh search for the platform's current
   documentation (URLs move; the underlying page usually still exists somewhere).
3. If a replacement official source is found, the register (`PLATFORM_CLAIM_SOURCE_REGISTER.md`)
   and the visible page are both updated together.
4. If no replacement exists and the claim can no longer be verified, the claim is removed from the
   page — never silently replaced with a third-party source presented as if it were official (see
   `docs/seo/EDITORIAL_SOURCE_AND_CONTENT_POLICY.md`'s "Not acceptable as a primary source" list).
5. An issue is opened for the broken source (see the GitHub governance section of the Phase 7
   completion report).

## Redirects

Phase 7 does not delete any existing published URL. If a future phase renames or merges a Phase 7
page, the old URL redirects (permanent, no chain, per
`docs/seo/ROUTE_REGISTRY.md`'s existing redirect rules) rather than 404ing or silently
disappearing from the sitemap.
