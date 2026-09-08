# Phase 21 UX Finding Register

Every finding from this phase's visual/code review, in the order found. "Disposition" states what
actually happened — no finding here is left ambiguous.

## FINDING-01 — DataTable long identifiers inflate row height at narrow widths

- **Severity**: P2 (readability/scannability, not a functional blocker)
- **Where confirmed**: `/admin/settings` (Runtime settings table) at 768px viewport.
- **Evidence**: `getBoundingClientRect().height` on the first `<tbody><tr>` measured **216.5px**
  (normal is ~50px for a two-line-max row). Root cause: the `description` column
  (`hideBelow: "lg"`, i.e. visible from exactly 768px) is a full English sentence; at 768px there
  isn't room for it alongside the `key`/`value`/`range`/`actions` columns, so the browser
  compressed it to a handful of characters wide and wrapped it across ~9 lines, and the unbroken
  snake_case `key` column (no `break-all`) simultaneously forced its own column wider than it
  needed. The same `font-mono` identifier-without-`break-all` pattern was present in 8 other admin
  manager components.
- **Disposition**: **Fixed.**
  - `packages/ui/src/components/DataTable.tsx`: added an `"xl"` tier to `hideBelow` (previously
    only `sm`/`md`/`lg` existed — `lg` was the widest option, so a column could never be pushed
    past the 768px boundary).
  - `apps/web/src/components/admin/RuntimeConfigManager.tsx`: description column's `hideBelow`
    changed from `"lg"` to `"xl"` (now first appears at 1024px, where there's actually room).
  - Added `break-all` to the long-identifier `font-mono` spans in `RuntimeConfigManager.tsx`,
    `UsersManager.tsx`, `CrawlersManager.tsx`, `WebhooksManager.tsx`, `SharedReportsManager.tsx`,
    `BlockedTargetsManager.tsx`, `PilotManager.tsx`, `UserDetailManager.tsx`, and
    `FindingAnalyticsDashboard.tsx` — matching the pattern already correctly used in
    `RegistryReleasesManager.tsx`, which had evidently been fixed once but never propagated to
    its siblings.
  - Re-measured after the fix: first row height **72.5px**.
  - Other `hideBelow: "lg"` columns across the admin surface were checked and left as-is — their
    content (dates, counts, short IDs already made `break-all`) doesn't reach sentence length, so
    they don't reproduce this failure mode.
- **Regression test**: `apps/web/tests/e2e/responsive-smoke.spec.ts`, new test "the runtime
  settings table stays a reasonable row height at 768px" (asserts row height < 100px). The
  pre-existing horizontal-overflow checks in the same file never catch this class of bug —
  it degrades vertically, not horizontally.

## FINDING-02 — Super Admin header overflow at 768px ("Back to public site")

- **Severity**: P2 (real layout defect, but only manifests with a longer-than-typical display
  name; not visible with a short real name)
- **Where confirmed**: `/admin/settings` (any admin page — the header is shared via
  `AdminNav.astro`) at exactly 768px, with the real fixture admin account's display name
  (`Fixture Admin 1788854323078-9d2dd7ee`).
- **Evidence**: `document.documentElement.scrollWidth` (813px) exceeded `clientWidth` (768px) by
  45px once the link's text was kept on one line — before that, the text instead wrapped across 3
  lines, crowding the header without technically overflowing. Root cause: `AdminNav.astro`'s
  "← Back to public site" link had never received the same responsive treatment its sibling
  element ("Customer view") got in a 2026-07-30 fix for the identical class of bug (see that
  element's own code comment, which explicitly documents a "112px header-bar overflow at
  360/768px" fix) — this element was simply missed in that earlier sweep.
- **Disposition**: **Fixed.** The link now shows only "←" (with `aria-label`/`title="Back to
  public site"`) from `sm` (480px) up, and reveals the text label only from `xl` (1024px) —
  mirroring the existing "Customer view" icon-then-label pattern exactly. Re-measured: no overflow
  at 360/768/1024/1280px.
- **Regression test**: already covered by the pre-existing `responsive-smoke.spec.ts` "Super Admin
  shell renders without horizontal overflow" test, which runs against the real
  `ADMIN_STORAGE_STATE` fixture account — the same long display name that exposed this bug. No new
  test needed for this specific finding; the existing suite would have caught it and will catch
  any regression.

## FINDING-03 — Unbounded display-name width in both app headers

- **Severity**: P3 (defensive fix — not yet observed with a real non-fixture user, but the header
  layout has no cap today and nothing stops a real user from choosing a very long display name)
- **Where confirmed**: `AdminNav.astro` and `AppNav.astro` — both rendered `{displayName}` in a
  `sm:inline` span with no `max-width`.
- **Disposition**: **Fixed.** Both spans now carry `max-w-[9rem] truncate` plus a `title`
  attribute holding the full name, so an unusually long name degrades to an ellipsis instead of
  crowding or wrapping the rest of the header row. This was the change that surfaced FINDING-02 in
  the first place (truncating the name alone wasn't sufficient — the neighbouring link also needed
  its own fix).

## FINDING-04 — Raw User-Agent string shown verbatim in the Sessions list

- **Severity**: P3 (readability/polish, not a functional defect)
- **Where confirmed**: `/app/account`, "Sessions" section, at 360px.
- **Evidence**: A real session's `navigator.userAgent` rendered as literal text — e.g.
  `"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)
  HeadlessChrome/151.0.7922.34 Safari/537.36"` — wrapping across 5 lines on a narrow viewport, with
  no attempt to summarise it for a non-technical reader.
- **Disposition**: **Fixed.** Added `apps/web/src/lib/user-agent-summary.ts`
  (`summarizeUserAgent()`), a small dependency-free heuristic that recognises the common
  browser/OS combinations (Chrome/Firefox/Safari/Edge/Opera × Windows/macOS/Linux/Android/iOS/Chrome
  OS) and renders e.g. "Chrome on macOS"; falls back to a safely truncated string for anything
  unrecognised rather than guessing. Wired into `SessionsManager.tsx`; the full raw string is still
  available via the element's `title` attribute for anyone who wants it.
- **Test**: `apps/web/src/lib/user-agent-summary.test.ts` — 6 unit tests, including the exact
  fixture UA string this session's own Playwright/Chromium instance produces, and the truncation
  fallback path.

## Investigated and ruled out (not a defect)

- **`/sign-in` Google button showing Sinhala text.** Traced to Google's own official
  "Sign In With Google" button (rendered client-side via Google Identity Services'
  `accounts.id.renderButton`, see `PasskeyAuth.tsx`), which auto-localises its label to the
  browser's detected locale — this development machine's locale produced a Sinhala label. This is
  Google's own widget behaving correctly for an internationalised audience, not a CrawlPact string
  or a translation bug. No code change made.
- **Floating pill widget overlapping content in several screenshots.** This is the Astro dev
  toolbar, which only renders under `astro dev` (never in a built/deployed Worker) — confirmed by
  its absence from the `pnpm run build` output and its complete absence from every previous
  phase's production/preview validation. Not a product defect.
- **`/admin/operations` showing "Loading…" in one screenshot.** The screenshot was taken before the
  page's client-side data fetch resolved (a fixed 600ms wait in the ad-hoc capture script was too
  short for this specific island). Confirmed not a hang: `page.getByRole("heading", { name:
  "Operations summary" })` resolves within the existing test suite's own 10-second timeout, which
  is what `home.spec.ts`'s existing "Phase 14: Super Admin operations dashboard" a11y test already
  relies on and passes against.
