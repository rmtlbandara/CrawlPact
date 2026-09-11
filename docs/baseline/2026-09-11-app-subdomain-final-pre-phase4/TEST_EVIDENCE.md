# Final Pre-Phase-4 — Test Evidence

Status 2026-09-11. Evidence class noted per claim, per this pass's own requirement — "verified"
alone is not used where the evidence is only source inspection.

## Automated suite (evidence class: AUTOMATED TEST, re-run against current `main`/PR #175 tree)

| Suite        | Result                              | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------ | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| format:check | pass                                | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| lint         | pass                                | 0 warnings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| typecheck    | pass                                | 0 errors, 553 files, 72 pre-existing deprecation hints (unrelated)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| unit         | 677/677 pass                        | 52 files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| security     | 45/45 pass                          | 8 files (includes `csrf.integration.test.ts`, `admin-security.integration.test.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| db:validate  | pass                                | 56/56 tables consistent                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| integration  | not clean on local re-run this pass | Hit the same pre-existing local Miniflare port-exhaustion signature (`EADDRNOTAVAIL`/`fetch failed`/`dispose is not a function`) documented repeatedly throughout this migration, across a different unrelated subset of files each attempt — not a deterministic failure (zero application code changed since it last ran clean). **CI is treated as authoritative for this suite**: this exact tree's integration suite has run clean in CI's isolated environment multiple times (PR #173 ×1, PR #174 ×1 after retry, PR #175 ×1) since the code was last touched. |
| build        | pass                                | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

## CI (evidence class: CI, fresh runs on the final candidate commits — not reused from an older tree)

- PR #175 (`8c26ae0`, docs-only): `CI`, `Format/lint/typecheck/unit+integration/build`, and
  `Chromium E2E + accessibility smoke` all `pass` — run `34555633367`.
- No new code commit exists this pass beyond PR #175's docs, so no additional CI run was needed
  for application code.

## Live HTTP (evidence class: LIVE HTTP) — see `LIVE_HOST_MATRIX.md` for the full matrix

Representative highlights re-confirmed this pass:

- `/pay` → 200; webhook GET → 404; webhook unsigned POST → 403 (rejected).
- Security headers (CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy,
  X-Frame-Options) present and correct on public homepage, app shell, and `/sign-in`;
  `Cache-Control: private, no-store` + `X-Robots-Tag: noindex, nofollow, noarchive` on the latter
  two; `Cache-Control: public, max-age=0, must-revalidate` on the public page.
- `Cross-Origin-Opener-Policy` absent everywhere — unchanged, still an open evidence-based
  decision (see `SEO_ANALYTICS_PERFORMANCE_EVIDENCE.md`), not a regression.

## Production D1 (evidence class: READ-ONLY D1 — PII-free, aggregate/opaque-ID only)

### Passkey — corroborates OWNER-OBSERVED new-passkey registration

```
new credential:              created 2026-09-11T02:14:27.257Z (exactly 1 new row, passkey_credentials)
pre-existing credential used: last_used_at 2026-09-11T02:10:33.033Z (~4 minutes earlier)
```

No credential deleted. RP ID unchanged (`crawlpact.com`, confirmed live on the deployed Worker).

### Google OAuth — corroborates OWNER-OBSERVED Google Sign-In

```
existing linkage:  created 2026-09-07T11:10:23.331Z — last_used_at refreshed 2026-09-11T02:09:54.193Z
new linkage:        created 2026-09-11T02:15:28.709Z
```

Only 2 Google linkages exist in the entire production database, both accounted for above.

### Sessions — no anomaly

```
Last 48h: 8 non-admin sessions (7 revoked), 4 admin sessions (4/4 revoked), 1 currently active
non-admin session.
```

No unexpected `is_admin_session=1` grant traceable to either the new passkey or the new Google
linkage — both associated activity clusters produced ordinary (non-admin) sessions, consistent
with the owner's own described test-account flow, not a privilege-escalation anomaly.

### Recovery codes — see `OWNER_ACTION_QUEUE.md` item 1 (HIGH PRIORITY finding)

### Security events — no anomaly

Only pre-existing noise (2 `invalid_paddle_signature` + 5 `rate_limit`, all dated 2026-09-09,
predating this reconciliation effort) plus one `invalid_paddle_signature` at
`2026-09-10T14:36:56Z` matching this session's own unsigned webhook test almost to the second —
self-caused, expected, confirms signature verification is working. No events correlate with the
2026-09-11 02:xx–04:xx test-activity window beyond that.

### Audit continuations — inconclusive, not a failure signal

`audit_continuations` currently has 0 rows account-wide. Source inspection
(`apps/web/src/lib/data-retention.ts`) confirms the daily retention cron (`0 3 * * *`) deletes
consumed/expired continuations — that cron has run at least once inside this test window, so an
empty table is fully consistent with "created, consumed, then swept," not evidence the flow never
happened. **No positive or negative technical corroboration is available for the public-audit
continuation flow** — recorded as OWNER-OBSERVED ONLY in the reconciliation matrix.

## Not independently observed this pass (evidence class: OWNER-OBSERVED or UNVERIFIED / MANUAL REQUIRED)

Live cookie-attribute inspection, live sibling-origin CSRF request/response pairs, live Paddle
checkout initialization, recovery-code redemption UI flow itself, authenticated app/admin page
rendering, and the continuation/pricing-billing browser flows all have no browser automation
available to this session and no D1-observable consequence beyond what's listed above. These
remain OWNER-OBSERVED, cross-checked where a technical proxy existed, and explicitly not claimed
as independently proven where none did.
