---
Document owner: Engineering owner
Status: current-authoritative
Last verified: 2026-08-11
---

# Registry Semantic Diff Model

Implemented in `apps/web/src/lib/registry-semantic-diff.ts`. Replaces the pre-Phase-15
`compareRegistryVersions`, whose "changed" detection was a raw full-snapshot string inequality —
editing a crawler's `description` wording, refreshing `lastVerifiedAt`, or moving
`officialSourceUrl` all counted identically to a real token or purpose change. That meant the
publish route's affected-domain/re-evaluation scheduling could fire for a purely editorial or
evidence-only edit — a real, confirmed bug fixed this phase.

## Four change classes

| Class                   | Fields                                                                                      | Effect                                                                                                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Evaluation-semantic** | `userAgentToken`, `alternativeTokens`, `purpose`, `lifecycleStatus`, `replacementCrawlerId` | The only class that can change what a scan evaluates to. Drives affected-domain computation and re-evaluation scheduling. Shown in the public changelog as "Policy interpretation changed."                                                 |
| **Evidence/provenance** | `officialSourceUrl`, `publishedIpInfo`, `firstVerifiedAt`, `lastVerifiedAt`                 | Never triggers re-evaluation. May still appear in the public changelog, labelled "Source evidence refreshed," because it improves customer trust even though it changes no evaluation outcome.                                              |
| **Editorial**           | `name`, `operatorName`, `description`                                                       | Cosmetic. Not surfaced as a "change" beyond an internal diff view; never triggers re-evaluation or a customer notification.                                                                                                                 |
| **Internal**            | `schemaVersion`, `id`, `operatorId`                                                         | Structural/identity fields that never meaningfully "change" for an existing crawler (a crawler's `id` is immutable by construction) — included in the classification map for completeness, never actually produce a diff entry in practice. |

## Why lifecycle is evaluation-semantic

A lifecycle transition between `active`/`deprecated`/`replaced` (evaluation-eligible) and
`unverified`/`retired` (excluded) changes _which crawlers are evaluated at all_ — retiring a
crawler removes it from the active evaluation set exactly as if it were deleted. Lifecycle is
therefore classified evaluation-semantic even though it isn't a "score" field per se.

## Per-crawler classification

`computeSemanticDiff(db, fromId, toId)` resolves both releases' canonical snapshots
(`registry-snapshot.ts`), then for each crawler present in both, diffs every field and classifies
each changed field independently. A crawler's diff entry is `isEvaluationSemantic: true` if **any**
one of its field changes is evaluation-semantic — a crawler that both moved its source URL _and_
changed purpose is still evaluation-semantic overall (the semantic change dominates), but a
crawler that only moved its source URL is not.

`evaluationSemanticCrawlerIds` — the union of added crawlers, removed crawlers, and
evaluation-semantic-changed crawlers — is the **only** set ever passed to `getAffectedDomains`.

## Array/object comparison

Array fields (`alternativeTokens`) are compared order-independently (sorted before comparison) so
reordering an array in storage never looks like a change. `publishedIpInfo` (an arbitrary JSON
object) uses key-sorted stable stringification for the same reason.

## Regression coverage

`apps/web/tests/integration/registry-semantic-diff.integration.test.ts` exercises each of the
canonical change scenarios named in Section 137: added crawler, removed crawler, purpose change,
token change, lifecycle change, source-URL-only change, verification-date-only change,
description-only change, and internal-timestamp-only change — asserting each lands in the correct
class and that only evaluation-semantic classes appear in `evaluationSemanticCrawlerIds`.
