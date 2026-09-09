# Risk Register — App-Subdomain Migration Phase 1

Date: 2026-09-09. This is the Phase-1-scoped risk summary. The authoritative, tracked entry lives
in `docs/risks/ACTIVE_RISKS.md` as **RISK-036** (added this phase) — this document is a pointer
plus the smaller findings that didn't warrant a numbered risk entry of their own.

## Primary risk: RISK-036

**App-subdomain origin separation is designed but not implemented; WebAuthn/CSRF/session are
single-origin until Phase 2-4 land.** Full detail: `docs/risks/ACTIVE_RISKS.md`. Status:
`monitoring`. No production behavior changed this phase; the risk is that a _future_ phase
implements the origin split carelessly (unpinned dual-origin WebAuthn, blanket dual-origin CSRF
acceptance), not that anything is currently broken.

## Secondary findings (not elevated to numbered risks — logged here for Phase 2/3 visibility)

1. **`/dev/components` has no runtime auth/environment gate**, unlike `/api/test-only/**` (which
   fails closed outside `PUBLIC_APP_ENV === "local"`). It relies solely on not being linked from
   navigation and a `robots.txt` disallow entry. This is a pre-existing gap, unrelated to the
   subdomain migration, discovered incidentally during the route inventory. Recommend Phase 2 add
   the same environment gate `/api/test-only/**` already uses, and ensure it is never reachable
   under either production Custom Domain regardless. Not fixed in Phase 1 (out of this phase's
   scope; not a migration blocker; too minor to justify a numbered `ACTIVE_RISKS.md` entry on its
   own, but worth a deliberate decision rather than silent carry-forward).

2. **`docs/deployment/CLOUDFLARE_ENVIRONMENT_MATRIX.md` and `CLOUDFLARE_CONFIGURATION.md` describe
   the preview Custom Domain (`preview.crawlpact.com`) as "not yet live, pending owner action"** —
   this is now stale: live Cloudflare API evidence this session confirms `preview.crawlpact.com`
   **is** attached and active. This predates and is unrelated to the subdomain migration. Not
   fixed in Phase 1 beyond the two targeted edits already made to add `PUBLIC_APP_URL` rows (a full
   rewrite of that document's preview-migration narrative is a separate, unrelated documentation
   debt item — flagged here rather than silently left, per CLAUDE.md's "documentation debt is not
   acceptable debt" rule, but out of this migration's smallest-coherent-diff scope).

3. **CLAUDE.md references `docs/status/IMPLEMENTATION_STATUS.md`**, which is archived at
   `docs/archive/implementation-history/IMPLEMENTATION_STATUS.md`; the live equivalent is
   `docs/status/CURRENT_STATE.md`. Pre-existing, unrelated to this migration, flagged for the
   maintainer rather than fixed here (editing CLAUDE.md itself is outside this migration's scope).

4. **No Google Search Console / GA4 / CrUX API or MCP access was available in this session.** The
   Phase 1 baseline relies on the most recent committed snapshots (Phase 20-22, dated 2026-09-07/08)
   rather than a fresh pull. This does not block Phase 2 (the migration's SEO requirements are
   about _code-level_ boundaries — noindex, sitemap exclusion, canonical ownership — not about
   current search performance figures), but a fresh GSC/GA4 baseline pull before Phase 4 cutover
   would be prudent and is recorded as an owner-accessible action, not a blocker.

None of these four findings are migration blockers. None required a fix in Phase 1 per the
directive's "narrowly scoped, separately documented" rule for unrelated issues found along the way.
