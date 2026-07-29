# Evidence Observatory redesign — deliverables package

This is the formal deliverables package (structure A–J) requested by the original redesign
brief. It summarizes work already recorded in detail in
`docs/design/EVIDENCE_OBSERVATORY_REDESIGN_SPEC.md` (the authoritative, continuously-updated
reference — read that first for the reasoning behind each decision) and in the branch's own
commit history, which is the primary source of truth for exactly what changed and why.

## A. Executive summary

**What changed.** Phases 4 (public website), 5 (audit and reports), 6 (customer app), and 7
(Super Admin) of the Evidence Observatory redesign are complete. Every route in scope was
reviewed against real data — real scans (including one run through the actual `/api/audit`
endpoint against `example.com`), a real authenticated customer session (registered via the
genuine WebAuthn ceremony, not a mock), and a real admin session (granted `super_admin` the same
way `tests/e2e/admin-flows.spec.ts` does). Phase 8 (verification) is partially done: the repo's
real cross-browser test matrix passes clean, Lighthouse lab measurements were taken against a
real production build, and the visual-regression baseline's content was regenerated and
verified — but a CI-wired, Linux-generated baseline, a manual screen-reader walkthrough, and
Lighthouse-in-CI remain undone (§I lists these explicitly).

**Why Evidence Observatory fits CrawlPact.** The concept isn't a new visual theme layered on top
of the product — it's a structural articulation of what the SRS already specifies in §2.6:
declared policy vs. observed response vs. unprovable actual behaviour. Every signature pattern
(`ProvenanceHeader`, `EvidenceRail`, Policy Purpose Lanes) is a layout convention over data
CrawlPact already collects, never a new capability, and every pattern renders an honest "Not
available" rather than fabricating a missing field.

**How features and product meaning were preserved.** No API contract, database schema,
authentication flow, billing flow, scanner behaviour, or registry logic was changed. The one
data-layer change (`getShareForToken` now distinguishing revoked/expired/invalid) is additive —
same table, same columns, more honest handling of data that was already there. No SRS
requirement was reduced, reinterpreted, or silently dropped.

**How trust, SEO, and usability improved — concretely, not aspirationally:**

- A real, live-production honesty defect was found and fixed: `/scanner` told every visitor the
  live scanner was disabled when production had actually had it enabled since before this branch
  was cut.
- A real architectural gap was found and fixed: revoked, expired, and invalid shared-report links
  were indistinguishable _at the SQL query level_, not just in the UI copy.
- A real, repo-wide rendering defect was found and fixed: inline links split across a line break
  had their surrounding whitespace silently stripped by the Astro compiler, gluing words together
  on 9 pages ("seemethodology", "statusfor").
- A real accessibility defect was found and fixed: several admin filter dropdowns had no
  accessible name — a screen-reader user couldn't tell what they did.
- A real, live billing-honesty defect was found and fixed: the billing page referenced a "billing
  portal above" that didn't exist for any user who'd never subscribed.
- Two components built in this session's foundations work (`ProvenanceHeader`) went from unused
  to actually wired into the single highest-stakes page in the product (the audit report),
  consolidating a previously fragmented metadata layout and surfacing a `rulesetVersion` field
  that existed in the data but was never shown anywhere.

## B. Repository baseline

- **Starting branch:** `feat/evidence-observatory-ui-ux-redesign`
- **Starting commit SHA:** `fd8b94e70fd7be21bc332c589a2b66528b10ce54` (`origin/main` at branch
  creation)
- **Ending local commit SHA:** `4e5edb9` (35 commits ahead of `origin/main` as of this document —
  see PR [#35](https://github.com/rmtlbandara/CrawlPact/pull/35) for the full set)
- **Existing failures discovered before this work began:** none new — the pre-session baseline
  (`pnpm quality` full pass, `test:e2e` 25/38 with 4 worker-contention timeouts confirmed passing
  in isolation, `test:a11y` 51/54 with 1 pre-existing documented mobile-safari tooling
  limitation, `test:visual` 7/105 against an already-known-stale baseline) is recorded in this
  spec doc's §10 and was never conflated with anything this branch introduced.
- **Uncommitted user work at session start:** none — `git status` was clean before the branch was
  created.

## C. Files changed

Grouped by area (full list: `git diff --name-only fd8b94e..HEAD`):

- **Tokens:** none changed — see the spec doc §3.1 for why (the existing token system already
  satisfied this redesign's visual direction).
- **Components (`packages/ui`):** `ProvenanceHeader.tsx`, `EvidenceRail.tsx`, `PurposeLane.tsx`
  (new), `Select.tsx` (accessible-name fix), `index.ts` (exports).
- **Layouts / shared chrome:** `SiteHeader.astro`, `MobileNav.tsx` (current-page indication).
- **Public pages:** `index.astro`, `pricing.astro`, `sign-in.astro`, `scanner.astro`,
  `crawlers/index.astro`, `crawlers/[slug].astro`, `guides/index.astro`, `guides/[slug].astro`,
  `tools/{ai-crawler-checker,content-signals-checker,llms-txt-validator,robots-txt-ai-validator,
rsl-validator}.astro`, `about.astro`, `acceptable-use.astro`, `changelog.astro`,
  `limitations.astro`, `methodology.astro`, `privacy.astro`, `security.astro`, `status.astro`,
  `terms.astro` (last 8 via the repo-wide `max-w-reading` token migration and/or the glued-text
  spacing fix, not content rewrites).
- **Audit/report:** `audit/index.astro`, `AuditReportView.tsx`, `shared/[token].astro`,
  `apps/web/src/lib/sharing.ts`.
- **Customer app:** `app/billing/index.astro`.
- **Admin:** `admin/GlobalDomainsManager.tsx`, `admin/SecurityOperationsDashboard.tsx`,
  `admin/SubscriptionsManager.tsx`, `admin/UsersManager.tsx`, `admin/WebhooksManager.tsx`
  (all: threading the new `Select` `ariaLabel` prop through, no visual change).
- **Tests:** `tests/a11y/home.spec.ts` (added `/dev/components`),
  `tests/integration/agency-features.integration.test.ts` (updated for the new
  `ShareResolution` discriminated type), `tests/visual/core-pages.spec.ts-snapshots/*` (98 of 105
  regenerated, content-only, see commit `8a13208`).
- **Documentation:** `docs/design/EVIDENCE_OBSERVATORY_REDESIGN_SPEC.md` (new, the primary
  reference), `docs/status/KNOWN_RISKS.md` (2 entries corrected/updated),
  `docs/status/IMPLEMENTATION_STATUS.md` (stale audit-engine/Paddle claims corrected, at the
  user's direct request), this document (new).

## D. Route coverage table

Full detail (redesigned / tested / responsive / accessibility / SEO, per route) lives in the
spec doc's per-phase progress notes, which are more precise than a flattened table would be
here — each entry explains _why_ a route needed a change or didn't. Summary:

| Phase                 | Routes in scope                                                    | Reviewed                                         | Changed             | Tested                                                                   |
| --------------------- | ------------------------------------------------------------------ | ------------------------------------------------ | ------------------- | ------------------------------------------------------------------------ |
| 4 — Public website    | ~40 (incl. 21 crawler + 20 guide detail pages sharing 2 templates) | All                                              | 16 files            | `pnpm quality`, targeted e2e, `test:a11y`, manual screenshots per change |
| 5 — Audit and reports | `audit/index`, `audit/[auditId]`, `shared/[token]`                 | All                                              | 4 files             | Real scan verification, axe-core direct scan, e2e                        |
| 6 — Customer app      | `app/{index,domains,groups,notifications,billing,account}`         | All (real session)                               | 1 file              | Real WebAuthn session, 6 e2e tests, `test:a11y`                          |
| 7 — Super Admin       | 21 admin routes                                                    | 9 in detail, all screenshotted                   | 0 files (real code) | Real admin session, `test:a11y`                                          |
| 8 — Verification      | Cross-repo                                                         | Full local matrix + Lighthouse + visual baseline | 105 snapshot files  | See §F/§G below                                                          |

`api/*` routes are not a UI surface and were out of scope throughout.

## E. Before-and-after evidence

Representative screenshots were captured throughout this session at 360px/768px/1280px+ for:
home, audit entry, pricing, sign-in, `/scanner`, crawler directory (before/after the
purpose-grouping change), crawler detail (GPTBot, showing the new related-crawlers section), a
real audit report (`example.com`, showing `ProvenanceHeader`), a real shared-report invalid
state, and the full customer app (dashboard empty/populated, domains, domain detail, groups,
notifications, billing before/after the portal-claim fix, account) and admin surface (dashboard,
users, subscriptions, security, audit logs, registry/crawlers, settings, webhooks, health,
notices) under real authenticated sessions. These were captured to the session's local scratch
directory for in-session verification, not committed to the repository (matching this brief's
own instruction not to use production customer information in screenshots — all data shown was
generated by this session's own test accounts).

## F. Test evidence

Exact commands and results, most recent full run:

| Check             | Command                 | Result                                                                                                                                                                                   |
| ----------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Format            | `pnpm format:check`     | Pass                                                                                                                                                                                     |
| Lint              | `pnpm lint`             | Pass — 0 errors                                                                                                                                                                          |
| Typecheck         | `pnpm typecheck`        | Pass — 0 errors, 35 pre-existing informational hints                                                                                                                                     |
| Unit              | `pnpm test:unit`        | 202/202 passed                                                                                                                                                                           |
| Integration       | `pnpm test:integration` | 137/137 passed                                                                                                                                                                           |
| DB validate       | `pnpm db:validate`      | 38 tables consistent                                                                                                                                                                     |
| Build             | `pnpm build`            | Pass                                                                                                                                                                                     |
| E2E (full matrix) | `pnpm test:e2e`         | 29/29 passed, 9 skipped by design (mobile-only WebAuthn gate)                                                                                                                            |
| Accessibility     | `pnpm test:a11y`        | 53/54 passed — the 1 failure is the pre-existing, already-documented mobile-safari skip-link tooling limitation (`KNOWN_RISKS.md`), confirmed unrelated across every commit this session |
| Visual regression | `pnpm test:visual`      | 105/105 passed, clean run, no `--update-snapshots`                                                                                                                                       |
| Secret scan       | not re-run this session | —                                                                                                                                                                                        |

## G. SEO evidence

- **Metadata validation:** the full `seo-metadata.spec.ts` e2e suite (unique title/description,
  canonical tags, exactly one H1, Open Graph data on every indexable page, correct `noindex` on
  private routes including the 404 page returning real content) passed on every run this session,
  including after every page-content change.
- **Structured data:** unchanged by this redesign (no FAQ/Article/Breadcrumb JSON-LD schema was
  touched); the homepage's `FAQPage` JSON-LD still mirrors its visible FAQ exactly, since neither
  was edited.
- **Sitemap:** `sitemap.xml.ts` reviewed directly — correctly excludes private/thin routes per
  SRS §30.3, unchanged.
- **Robots/noindex boundaries:** verified via the same e2e suite — sign-in, audit reports, and
  admin routes all correctly `noindex`.
- **Broken-link results:** not separately checked with a dedicated link-checker tool this
  session; internal links added (related-crawlers, related-guides, evidence-and-methodology
  section) all point to real, existing routes, verified by direct navigation during screenshot
  review.
- **Performance (Lighthouse lab data — not field data):** see §12 of the spec doc for the full
  table. Summary: Performance 98–99, Accessibility 100, SEO 100 (66 on the audit report page,
  correctly, since that page is intentionally `noindex`), LCP 2.0–2.3s on every page tested
  (under the SRS's 2.5s "good" threshold), CLS 0, TBT 0ms on every page tested.

## H. Accessibility evidence

- **Axe-core automated results:** `pnpm test:a11y` 53/54 (see §F). Additionally, two pages not
  covered by that suite's fixed 22-route list were scanned directly with a standalone axe-core
  script against real data: the real audit report page (0 violations) and the shared-report
  "invalid" state (0 violations).
- **Keyboard review:** not a dedicated separate pass this session; every new interactive element
  (current-page nav indicators, related-content links, the CTA buttons) uses native `<a>`/
  `<button>` elements with no custom keyboard handling, so no new keyboard-trap risk was
  introduced. The one known pre-existing keyboard-adjacent issue (mobile-safari skip-link focus)
  is unrelated to any file this branch touched.
- **Focus review:** not separately audited this session beyond what `test:a11y` already checks
  (skip-link-first-focusable, focus restoration is exercised implicitly by the e2e suite's modal/
  dialog interactions, none of which were touched).
- **Zoom/reflow:** not separately tested this session.
- **Reduced motion:** unchanged — no new CSS transition/animation was added anywhere this
  session; the existing global `prefers-reduced-motion` collapse in `tokens.css` (untouched)
  still applies to everything.
- **Screen-reader review:** **not performed** — genuinely, explicitly untested. Axe-core's
  accessibility-tree analysis is real automated coverage of the same underlying accessibility
  tree a screen reader consumes, but is not a substitute for a human listening to VoiceOver or
  NVDA navigate the actual product. Stating this honestly rather than implying it was covered.

## I. Risk report

**Remaining known risks** (all pre-existing, none introduced this session):

- CSP still allows `unsafe-inline` (accepted, documented tradeoff — Astro islands + Tailwind
  runtime need it, per-request nonce unbuilt).
- Admin list pagination is designed but not wired to any admin page (`admin/users`,
  `admin/webhooks` render all rows unpaginated) — confirmed still present during Phase 7 review,
  real feature work, not a redesign-scope item.
- No manual screen-reader walkthrough has ever been performed on this product. This is the one
  item in this whole redesign that genuinely cannot be closed by an agent working alone — it
  needs a human using VoiceOver or NVDA.

**Resolved during the second verification pass (2026-07-29)** — see
`EVIDENCE_OBSERVATORY_REDESIGN_SPEC.md` §12.1 for full detail:

- `pnpm quality` (the literal combined command) and `pnpm secrets:scan` both run and pass clean
  for the first time this session.
- A broken-internal-link scan (62 URLs from the sitemap, zero broken) and a bundle-size/
  island-count before-vs-after comparison (700K → 704K, identical island counts — the "zero
  added client JS" claim is now verified, not just asserted) were both performed.
- Lighthouse is now wired into CI (`scripts/lighthouse-check.mjs` +
  `.github/workflows/deploy-preview.yml`), gating every preview deploy against the real deployed
  Worker.
- Visual-regression CI-wiring is built (`.github/workflows/visual-regression.yml`): a `compare`
  job runs on every PR now (confirmed running for real on this PR); an `update-baseline` job
  generates a real Linux baseline but is **workflow_dispatch-only and can only target a workflow
  file already on the default branch** — a real GitHub constraint hit and confirmed via a live
  `gh workflow run` `404` this session, not a guess. It can only run once this PR merges. Tracked
  as the one remaining action item in this section.

**Deferred improvements** (not defects, just not done):

- `EvidenceRail` was deliberately not wired into the audit report's findings list once the real
  `Finding` data was checked and found not to have five genuinely distinct fields — fixing that
  properly means changing `packages/policy`'s finding-generation logic, out of this redesign's
  scope.
- The domain-detail page's full-report view could also use `ProvenanceHeader` — noted as a
  Phase 6 candidate in the spec doc, not done.

**Items requiring user approval:** none outstanding — the `.claude/settings.json` permission
change (removing `git push` from the deny list) was made at the user's explicit request and
remains uncommitted, a local-only override.

**Items requiring production verification:** everything in this branch is unmerged and unpushed
to `main`; nothing here has been verified against production and nothing should be inferred
about production behaviour beyond what `docs/status/IMPLEMENTATION_STATUS.md` and
`docs/status/KNOWN_RISKS.md` already state about the currently-deployed `main`.

## J. Deployment status

- **No production deployment was performed.** No `wrangler deploy` command was run at any point
  across this work; `wrangler deploy*` remains a hard deny in `.claude/settings.json` throughout.
- **`origin/main` remains unchanged** from `fd8b94e70fd7be21bc332c589a2b66528b10ce54` throughout
  this entire redesign. Nothing has merged into it.
- **A pull request is now open**: [#35](https://github.com/rmtlbandara/CrawlPact/pull/35),
  `feat/evidence-observatory-ui-ux-redesign` → `main`, 36 commits, opened for human review — not
  merged, not auto-mergeable, no approval given by this session on its own behalf. CI is running
  against it for real (both the existing quality/e2e/a11y gate and the new visual-regression
  `compare` job).
- **Exact next step, in order**: (1) human review and merge of PR #35; (2) once merged, run `gh
workflow run visual-regression.yml --ref main` once to generate the real Linux baseline, review
  the generated PNGs, confirm `compare` goes green on the next PR; (3) schedule a human
  screen-reader session — the one item nothing in this pipeline can automate. None of this
  implies or authorizes a production deploy; that remains a separate decision requiring the
  user's explicit, in-the-moment permission at the time it's actually requested, per this
  repository's own `CLAUDE.md`.
