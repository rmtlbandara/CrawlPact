---
Document owner: Engineering owner
Status: current-authoritative
Last verified: 2026-08-11
---

# Registry Correction Workflow

How a report that CrawlPact's crawler classification is outdated or wrong gets resolved, end to
end (Section 84).

## Public entry point

Crawler reference pages carry a correction prompt: _"Found an outdated crawler token, purpose or
official source? Send the affected crawler and supporting official documentation to
support@crawlpact.com."_ This reuses the existing support-contact channel — no external issue
tracker is added, and no link to the (private) GitHub repository is ever shown publicly (Phase 13
boundary, preserved).

## Flow

1. **Correction received** — via the support address above.
2. **Official evidence reviewed** — a team member checks the claim against the operator's
   current official documentation (Section 5's source hierarchy — the correction itself is not
   trusted as evidence; the operator's page it points to is).
3. **Existing registry record inspected** — `/admin/registry/crawlers` shows the crawler's
   current `officialSourceUrl`, `lastVerifiedAt`, purpose, and lifecycle.
4. **Candidate change drafted** — an admin edits the crawler's mutable row (source URL, purpose,
   lifecycle, as warranted) via the existing `verifyCrawler`/`deprecateCrawler` actions. This
   never touches any already-published release.
5. **Source verification recorded** — `verifyCrawler` requires an explicit source URL and audited
   reason; there is no "Verify" action that accepts a bare click with no evidence (Section 109).
6. **Release candidate generated** — `createRegistryRelease`, snapshotting the corrected state.
7. **Semantic impact reviewed** — `GET /api/admin/registry/releases/compare` shows the semantic
   diff, candidate validation result, checksum, and affected-domain estimate before publication.
8. **New release published/activated** — `POST .../publish`, requiring a reason, candidate
   checksum, and (per `requireAdminAction`) a recent authenticated admin session.
9. **Public changelog updated automatically** — the changelog is derived from the immutable
   published release and its semantic diff (`docs/registry/REGISTRY_SEMANTIC_DIFF_MODEL.md`), not
   hand-typed prose describing the correction.

## What never happens

- **Old releases are never edited.** A correction is always a _new_ release; the previous
  (incorrect) release remains historically intact, exactly as Section 174 requires — CrawlPact
  discloses that it corrected a prior classification rather than silently rewriting history.
- **A correction is never applied by editing `packages/database/seed/reference-data.sql` alone.**
  The seed file is bootstrap/reference data, not the production authoritative source once a
  registry has been published — see `docs/registry/PHASE_15_REGISTRY_PROVENANCE_DATA_MODEL.md`'s
  sibling concern, "seed vs. runtime registry," and Section 121. A seed-file edit alone (as
  happened with the pre-Phase-15 Amazon/Google correction) does not become live until a real
  release is created and published.

## Correction transparency in public copy

When a correction changes a previously-public classification, the release note should say so
plainly — example wording from Section 174: _"Corrected CrawlPact's previous classification after
re-verifying the operator's current documentation."_ Not "New crawler launched" (unless the
operator itself establishes that), not silence.
