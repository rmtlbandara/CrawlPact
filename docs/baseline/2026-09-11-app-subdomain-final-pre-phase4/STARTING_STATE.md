# Final Pre-Phase-4 — Starting State (live-verified, 2026-09-11)

Independently reconstructed from git and live external systems this pass — not copied from any
earlier report or from this prompt's own "known starting references" without re-checking.

## Git / PR state

```
main HEAD:        324eefd1db28bc8e0c622ede821caeaaf0e3bd0a   (confirmed, matches prior record)
current branch:   docs/phase4-external-validation-corroboration
branch HEAD:       8c26ae0b3da69739412c5f44100d2ada96517f2d   (confirmed)
working tree:      clean
```

PR #175 (`docs/phase4-external-validation-corroboration` → `main`): **OPEN, mergeable, CI fully
green** (`CI`, `Format, lint, typecheck, unit + integration tests, build`, and
`Chromium E2E + accessibility smoke` all `pass`, run `34555633367`). **Not merged this pass** —
per this pass's own instruction, its "remaining gates" framing predates the owner's further live
validation (cookie isolation, CSRF, checkout, recovery, admin, continuation, pricing/billing) and
needs reconciliation before merge, not a stale-content merge.

## Production Cloudflare state (re-verified live, evidence source: direct API read)

| Item                                  | Value                                                                           | Unchanged since                      |
| ------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------ |
| Worker deployment                     | `8eacde5b-46b9-4c3f-92be-9d3c63de43fc`                                          | 2026-09-10T14:36:46Z                 |
| Worker version                        | `a73071e7-afe8-465a-a4cf-fee0237cb5f3`                                          | same                                 |
| Rollback target                       | `b0dfdff2-03da-4bbe-8403-aadf755a1851` / `5aacab1e-4e29-46ca-8f0c-886ee1f9794c` | unchanged                            |
| `crawlpact.com` Custom Domain         | attached, enabled                                                               | unchanged                            |
| `app.crawlpact.com` Custom Domain     | attached, enabled                                                               | unchanged                            |
| `preview.crawlpact.com` Custom Domain | attached, enabled                                                               | unchanged                            |
| Production `workers.dev`              | `{"enabled":true,"previews_enabled":true}`                                      | unchanged                            |
| BIC Configuration Rule                | 1 rule, `689db52e511b4346a1b142aefc9c11ce`, unchanged expression/enabled state  | unchanged since 2026-09-10T05:15:29Z |
| Zone `browser_check`                  | `on`                                                                            | unchanged                            |
| Zone `security_level`                 | `medium`                                                                        | unchanged                            |
| Logpush jobs (account-wide)           | 0                                                                               | —                                    |
| Worker `logpush` setting              | `false`                                                                         | —                                    |
| Worker `tail_consumers`               | `[]`                                                                            | —                                    |

## Paddle state (re-verified live via API)

```
crawlpact.com      chedom_01kyfnvdzbbvxx40vr7b3hvz98   approved   (unchanged since 2026-07-26)
app.crawlpact.com  chedom_01m24mn1cqys7mcn80rgt6t4t2   approved   (unchanged since 2026-09-10T11:10:42Z)
```

Both `payment_method_verification.apple_pay.status: "verified"`. Not resubmitted, not touched.

## Tooling actually available this pass (re-probed, not assumed carried-over)

Connected: Cloudflare (`cloudflare-api`, `cloudflare-docs`, `cloudflare-bindings` search-only —
the D1-query-capable `cloudflare-bindings` execute path required re-authorization and was
unavailable; D1 access this pass went through the `cloudflare-api` server's generic REST
`execute`, which reached the same D1 REST endpoint successfully), GitHub, Paddle, WebSearch/
WebFetch.

**Not connected, re-confirmed by direct probe**: Google Cloud/OAuth Console, Google Search
Console, GA4, Microsoft Clarity, CrUX, browser automation (Playwright or equivalent). Identical
conclusion to every earlier check this migration — not re-derived from memory, re-probed fresh
this pass.

## D1 (production, read-only, PII-minimized — evidence class: READ-ONLY D1)

Tables inspected: `passkey_credentials`, `sessions`, `security_events`, `users`, `oauth_accounts`,
`recovery_codes`, `audit_continuations`. Only opaque IDs, timestamps, and counts were ever
selected — never `code_hash`, `public_key`, `credential_id`, email, or session/token values. Full
findings in `TEST_EVIDENCE.md` and `OWNER_ACTION_QUEUE.md`.
