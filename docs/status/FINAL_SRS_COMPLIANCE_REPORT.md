# Final SRS Compliance Report

Part 3 Step 23 deliverable. A real, evidence-based audit of every SRS requirement against actual
code and tests — not a restatement of what was planned. Full section-by-section detail lives in
`docs/status/REQUIREMENTS_TRACEABILITY.md` (updated in the same pass as this report); this
document is the summary and the honest list of what did not pass cleanly.

## Method

For each SRS section §1–§40, the actual implementation was checked directly: routes/lib files
read, tests run (not assumed passing from prior notes), and — where a claim could plausibly have
gone stale — verified against the running application rather than the code alone. Two genuine
gaps and one real, previously-unknown bug were found this way; all three are recorded honestly
below and in `docs/status/KNOWN_RISKS.md`, per this project's standing rule against silently
downgrading or omitting a requirement that isn't fully met.

## Headline result

**§1–§27 (public site, scanner, policy engine, accounts, monitoring, billing): Tested, unchanged
since Part 2.** Nothing in this Part touched that surface; the full quality gate (`pnpm quality`)
still passes end to end (format, lint, typecheck, 189 unit tests, 136 integration tests across 22
files, `db:validate`, build).

**§28–§40 (Super Admin Control Center, agency features, SEO, production acceptance): Tested, with
three disclosed items.** Every §28 subsection (28.1 through 28.20) has real, tested code — not
schema-only stubs. §29 agency features are complete against the SRS's own bullet list. §30's
content minimum is met and exceeded. The three disclosed items:

1. **No enforced minimum of two registered passkeys for Super Admin accounts** (SRS §28.20). Found
   reading the SRS text directly against `lib/auth/require-admin.ts` — nothing checked or enforced
   this. **Fixed in Step 26**: `removeCredential` now refuses to drop an admin account below 2
   passkeys — see `docs/status/KNOWN_RISKS.md`'s "Fixed during Part 3 Step 26" section.
2. **`apps/web/wrangler.jsonc`'s `env.preview` had no distinct D1 database binding.** It only
   overrode `vars`; the top-level `d1_databases` block was inherited unless a separate preview
   database ID was configured before first deploying to preview. **Fixed in Step 26**: a distinct
   `d1_databases`/`PUBLIC_SITE_URL`/`WEBAUTHN_RP_ID`/`WEBAUTHN_RP_ORIGIN` set now exists under
   `env.preview` (placeholder values pending a real preview domain, but structurally separate).
3. **Real Playwright e2e coverage is real but not exhaustive against SRS §35.3's full journey
   list.** Built this pass (`auth-and-account.spec.ts`, `admin-flows.spec.ts`, using a real
   Chromium DevTools Protocol WebAuthn virtual authenticator, not a fabricated response): passkey
   registration/sign-in, save-a-domain-and-trigger-a-real-scan, account deletion request/cancel,
   report printing, and four Super Admin journeys (dashboard, user search, subscription table
   filtering, webhook retry). Not yet built: scheduled scan, Paddle purchase/portal, agency
   client report, and keyboard/table-filtering journeys beyond subscriptions. Prioritised by SRS
   priority, not by ease — the remainder is real, disclosed follow-up work.

## A real bug this audit found (not previously known)

Building the save-domain-and-scan e2e journey — the first thing in this project's history to
render the customer dashboard's Overview page for a genuinely brand-new, zero-domain account
through a real browser — triggered a real server-side crash: `apps/web/src/pages/app/index.astro`
passed a literal `<a>...</a>` written in Astro template syntax as the React `EmptyState`
component's `action` prop. Astro compiles that into its own internal object, not a React element;
React's SSR renderer throws when it receives one. The dev server swallowed the exception and
returned `200 <html><head></head><body></body></html>` instead of a 500 — invisible to any check
that only looks at status codes. Fixed by rendering the equivalent markup natively in Astro
instead of routing it through a React prop; confirmed no other file in the codebase uses the same
anti-pattern. Full detail in `docs/status/KNOWN_RISKS.md`'s "Fixed during Part 3 Step 23" section.

## A real, non-obvious infrastructure finding from this audit

`PRAGMA foreign_keys=OFF` — the first line of SQLite's own documented table-rebuild procedure —
is silently a no-op inside a Cloudflare D1 migration file, because D1 runs the whole file as one
implicit transaction and SQLite ignores `foreign_keys` pragma changes mid-transaction. Migrations
0013–0015 (Part 3 Step 21's data-retention fix) originally shipped with `foreign_keys=OFF` and
passed against a fresh, autocommit-mode `sqlite3` CLI test, then failed against real D1 the first
time the rebuilt table had real dependent rows — a gap between "looks tested" and "actually
correct against the target engine." Fixed by switching to `PRAGMA defer_foreign_keys=ON`, which
_is_ honored mid-transaction; documented in `docs/data/MIGRATION_POLICY.md` so no future migration
repeats it. This is recorded here because it's exactly the kind of SRS-adjacent infrastructure
correctness issue a compliance audit should surface, not just feature-level requirement coverage.

## What was verified true, not assumed

- Every one of the 20+ Super Admin lib modules (`apps/web/src/lib/admin/*.ts`) has a
  corresponding `*.integration.test.ts` file, and those tests were re-run this pass (not
  presumed passing from an earlier session's notes).
- The 20 crawler-reference pages and 20 guide pages (§30.4) were counted directly
  (`ls apps/web/src/content/{crawlers,guides}/*.md`), not taken from a prior claim.
- The visual-regression baseline is 13 routes × 7 breakpoints = 91 snapshots, counted directly —
  the Part 2 draft of this document said "six core routes, 42 snapshots," which was stale.
- The registry/publication workflow (FR-REG) row in the Part 2 draft said "still Part 3" as an
  open item; it is now built and tested, and the row was corrected rather than left stale.
- `db:validate`'s own static analyzer had a real false-positive bug (flagging the SQLite
  table-rebuild pattern's intermediate `_new` tables as undeclared in Drizzle) — found and fixed
  as part of re-running the quality gate for this audit, not assumed to already be correct.

## Recommendation

No requirement was found unimplementable or requiring a scope reduction. The three disclosed
items above are real, bounded follow-up work, not launch-blocking discoveries that invalidate the
rest of this Part's delivery. Proceed to Step 24 (security audit) and Step 25 (production
readiness audit); factor items 1–2 above into Step 26's production configuration work before any
deployment.
