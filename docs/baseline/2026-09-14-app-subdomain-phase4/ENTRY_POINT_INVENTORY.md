# Phase 4 — First-Party Entry-Point Inventory

Status 2026-09-14. Grep-based search (SOURCE INSPECTION) of the entire runtime `apps/web/src`
tree for `/sign-in` references, cross-checked against every match to classify it rather than
assuming the grep hit itself was a link needing migration.

## Search performed

```
grep -rln '"/sign-in"\|'"'"'/sign-in'"'"'\|href="/sign-in\|href='"'"'/sign-in\|`/sign-in' apps/web/src
```

Matched files, classified:

| File                                                                                         | Classification                                                  | Action                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/SiteHeader.astro` (2 occurrences)                                                | PUBLIC→APP                                                      | Updated to `toAppUrl("/sign-in")` — used exclusively by `MarketingLayout`, confirmed via a second grep that no other layout imports it                                                             |
| `components/PricingPlans.tsx`                                                                | PUBLIC→APP                                                      | Updated: added required `appOrigin` prop, threaded from `pricing.astro`                                                                                                                            |
| `components/AuditConversionCta.tsx`                                                          | PUBLIC→APP                                                      | Updated: added required `appOrigin` prop, threaded from `AuditReportView.tsx` → `pages/audit/[auditId].astro` (confirmed the _only_ caller that passes `conversionCta` via grep)                   |
| `pages/pricing.astro`                                                                        | PUBLIC→APP                                                      | Updated: the plain "Create an account" link now uses `toAppUrl("/sign-in")`                                                                                                                        |
| `pages/sign-in.astro`                                                                        | (the page itself)                                               | No change — already builds its own post-auth redirects as relative paths (`/app`, `/app/billing?...`, `/app/continue?...`), which are correct _because_ this page itself now lives on the app host |
| `pages/app-shell.astro`                                                                      | APP→APP                                                         | No change — `href="/sign-in"` is same-origin-correct (this page is served on the app host)                                                                                                         |
| `pages/app/**/*.astro` (every dashboard page's own unauthenticated-redirect fallback)        | APP→APP                                                         | No change — a relative `/sign-in` from a page already served on the app host is correct                                                                                                            |
| `pages/admin/**/*.astro` (same pattern)                                                      | APP→APP                                                         | No change, same reasoning                                                                                                                                                                          |
| `components/app/SessionsManager.tsx`                                                         | APP→APP (client island, only ever mounted inside the app shell) | No change                                                                                                                                                                                          |
| `lib/origin.ts`, `lib/route-ownership.ts`, `lib/auth/page-session.ts`, `pages/robots.txt.ts` | Implementation/config, not a rendered link                      | No change — these reference the string `/sign-in` as a path constant for classification/robots purposes, not as a navigable `<a href>`                                                             |
| `worker.ts`, `middleware.ts`                                                                 | Implementation                                                  | No change beyond this pass's own worker.ts host-boundary extension (see `FINAL_ROUTE_OWNERSHIP_MATRIX.md`)                                                                                         |
| `*.test.ts` files (multiple)                                                                 | Test-only                                                       | Extended where the behavior under test changed (`worker.host-boundary.test.ts`, `route-ownership.test.ts`); left alone otherwise                                                                   |

**Total genuine PUBLIC→APP first-party links found and migrated: 5** (2 in `SiteHeader.astro`,
1 each in `PricingPlans.tsx`, `AuditConversionCta.tsx`, `pricing.astro`). No dead code, no
email/notification-template entry points found referencing `/sign-in`, `/app`, or `/admin`
directly (this product's transactional emails were not in scope of this grep — a follow-up sweep
for email/Atom-feed templates specifically found none referencing these paths; the Atom feed
(`/feed/:token.xml`) links only to `/shared/:token` and report URLs, both `PUBLIC_ONLY`, unaffected).

## `AuditConversionCta.tsx`'s other two targets

Found during the same review, not `/sign-in`-shaped but equally cross-origin after cutover:

- `/app/domains/:domainId` (the "Manage this domain" link, shown when the viewer already owns the
  domain) — updated to `${appOrigin}/app/domains/:domainId`.
- `/app/continue?continuation=...` (the authenticated continuation-confirmation target) — updated
  to `${appOrigin}/app/continue?continuation=...`.

## Testing strategy (Phase 4 directive §24's explicit permission, applied)

`app.preview.crawlpact.com` is not a real attached Cloudflare Custom Domain (established fact,
re-confirmed this pass — see `STARTING_STATE.md`). Real cross-origin E2E navigation therefore
cannot be proven on Preview without fabricating a result. Per the directive's own instruction not
to fabricate this, the absolute-hostname guarantee is proven instead at the unit level, where it
is fully and honestly provable:

- `apps/web/src/lib/origin.test.ts` — `toAppUrl`/`requireAppOrigin` build exactly the expected
  absolute app-origin URL, and throw rather than silently falling back to the public origin if
  `PUBLIC_APP_URL` is ever unconfigured.
- `apps/web/src/lib/legacy-redirect.test.ts` — the apex-side redirect target construction,
  including the `/sign-in` query-allowlist filtering, asserted against the real absolute app
  origin.
- `apps/web/src/worker.host-boundary.test.ts` — the full Worker-level redirect/rejection behavior,
  including a same-suite follow-up request proving the redirect resolves in exactly one hop with
  no loop.

Existing E2E specs (`pricing.spec.ts`, `audit-conversion.spec.ts`, `checkout-continuity.spec.ts`)
were **not** rewritten to assert a cross-origin hostname, because in the local/CI E2E environment
`PUBLIC_APP_URL` equals `PUBLIC_SITE_URL` (`.env.example`'s legitimate single-origin local dev
setup — see `packages/config/src/env.ts`), so these links resolve same-origin there regardless of
this change; their existing pathname-pattern assertions remain valid and continue to exercise the
real component code paths. Proving real cross-origin behavior end-to-end is deferred to Production
Stage A live verification (GET/HEAD probes against the real, deployed hosts), where it can be
proven honestly rather than faked against a topology Preview doesn't have.
