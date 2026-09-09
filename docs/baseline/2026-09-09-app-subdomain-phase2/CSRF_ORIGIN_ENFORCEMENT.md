# CSRF / Same-Origin Enforcement — Phase 2

Date: 2026-09-09. `apps/web/src/lib/auth/same-origin.ts`'s `assertSameOrigin` redesigned per
`WEBAUTHN_MIGRATION_CONTRACT.md`'s sibling document, `PUBLIC_SITE_URL_USAGE_AUDIT.md`'s CSRF
migration design.

## Previous model

```ts
const expectedOrigin = new URL(getEnv().PUBLIC_SITE_URL).origin; // fixed, always the public origin
if (origin !== expectedOrigin) reject();
```

Single fixed expected origin, regardless of which host the request itself arrived on.

## New model — self-referential, not a broad allowlist

```ts
const expectedOrigin = getValidatedRequestOrigin(request); // the request's OWN arrival origin, only if trusted
if (!expectedOrigin || origin !== expectedOrigin) reject();
```

The directive was explicit that a naive `[PUBLIC_SITE_URL, PUBLIC_APP_URL].includes(origin)` check
"would weaken the new boundary" by accepting either trusted origin's `Origin` header regardless of
which host the request actually reached. The implemented check instead requires the `Origin`
header to match **this specific request's own arrival origin** — so:

| Request arrived on             | `Origin` header            | Result                                                                                             |
| ------------------------------ | -------------------------- | -------------------------------------------------------------------------------------------------- |
| `crawlpact.com`                | `crawlpact.com`            | ✅ accepted                                                                                        |
| `app.crawlpact.com`            | `app.crawlpact.com`        | ✅ accepted                                                                                        |
| `app.crawlpact.com`            | `crawlpact.com`            | ❌ rejected (sibling-origin)                                                                       |
| `crawlpact.com`                | `app.crawlpact.com`        | ❌ rejected (sibling-origin)                                                                       |
| `crawlpact-web....workers.dev` | anything                   | ❌ rejected (`getValidatedRequestOrigin` returns `null` — the arrival origin itself isn't trusted) |
| anything                       | `https://attacker.example` | ❌ rejected                                                                                        |

This single change automatically handles the Phase 2/3 migration-compatibility window correctly:
since `crawlpact.com` continues to serve `APP_ONLY` pages/APIs during this window, a legitimate
request always arrives on _some_ trusted origin and presents a matching `Origin` — no per-route
surface table was needed (a design simplification from the original Phase 1 sketch, made possible
once request-self-referential matching was chosen; documented here since it diverges from the
literal per-route-table language in `PUBLIC_SITE_URL_USAGE_AUDIT.md`'s draft design — the resulting
security property is identical, and the audit doc's file will be superseded by this note rather
than rewritten to preserve Phase 1 history).

The Referer fallback path gained a `try`/`catch` around `new URL(referer)` — the previous code
would throw an unhandled `TypeError` on a malformed `Referer` header instead of returning a clean
`403`; fixed incidentally as part of this change (small, narrowly scoped, directly adjacent to the
code being modified).

## Call sites

Zero call sites changed. `assertSameOrigin(request)`'s signature is unchanged — `requireSession`,
`requireAdminSession` (which wraps it), and the standalone Google callback call in
`pages/api/auth/google/index.ts` all benefit automatically.

## Test evidence

`apps/web/tests/integration/csrf.integration.test.ts` — 8 tests (4 pre-existing, unmodified
assertions; 4 new):

- **New**: rejects a mutation arriving on the app origin claiming the public origin's `Origin`
  header (and the reverse) — the sibling-origin case, proven against a real D1-backed session and
  a real route handler (`PATCH /api/account`), not just the helper function in isolation.
- **New**: accepts a mutation that arrives on the app origin with a genuinely matching app `Origin`
  header.
- **New**: the sibling-origin rejection holds for the Referer fallback path too, not just the
  `Origin` header path.
- All four pre-existing tests (same-origin GET exempt even with an attacker Origin, mutating
  request rejected with a mismatched Origin, rejected with neither Origin nor Referer, accepted via
  a matching Referer fallback) continue to pass with their original assertions unchanged.

A pre-existing, repo-wide compatibility issue was found and fixed while making this change: ~40
integration test files construct API requests with an arbitrary placeholder host
(`"http://x/..."`), which was harmless under the old fixed-origin check (the request's own URL was
irrelevant to it) but would have made every one of those requests' arrival origin "untrusted"
under the new self-referential check, rejecting them regardless of a correct `Origin` header. Fixed
centrally: `apps/web/tests/integration/test-helpers.ts`'s shared `jsonRequest`/`getRequest`/
`mutatingRequest`/`formDataRequest` helpers now rewrite the placeholder host onto the file's own
`PUBLIC_SITE_URL` mock before constructing the `Request`; two files with their own local duplicate
helpers (`auth-flow.integration.test.ts`, `google-auth-flow.integration.test.ts`, predating the
shared-helper extraction) received the identical fix; ~13 remaining direct `new Request("http://x/...")`
call sites across 8 files were mechanically rewritten to a real trusted host. Full test suite
re-verified green after each fix (see `TEST_EVIDENCE.md`).
