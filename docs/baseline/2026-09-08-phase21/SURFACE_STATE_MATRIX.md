# Phase 21 Surface State Matrix

Coverage table for this phase's review. "Reviewed" means a real screenshot was inspected and/or a
real automated test exercises this surface; it does not mean every documented UI state (hover,
error, empty, loading) was individually captured for every surface — see the per-row notes.

| Surface | Breakpoints reviewed | States reviewed | Notes |
| --- | --- | --- | --- |
| Public marketing home (`/`) | 360/768/1280 | default | Also covered by `responsive-smoke.spec.ts` at 360/768/1280/1440/1920 and `home.spec.ts` a11y scan. |
| Pricing (`/pricing/`) | 360/768/1280 | default | Plan cards, comparison table. No overflow. |
| Anonymous audit form (`/audit/`) | 360/768/1280 | default (idle form) | Real-scan report state not re-captured this phase (covered by existing `audit-conversion.spec.ts`/`home.spec.ts` real-scan a11y test). |
| Sample report (`/sample-report/`) | 360/768/1280 | default | Synthetic demonstration report — findings, crawler-access matrix, llms.txt/RSL/Content-Signals sections all readable at 360px. |
| Sign-in (`/sign-in`) | 360/768/1280 | default, Google button (investigated locale rendering — FINDING register) | Create-account/recovery-code tabs not re-captured; existing E2E suite exercises those flows functionally. |
| Content-collection templates (crawlers/guides/for/platforms) | 360/768/1280 | default | One representative route per template (`gptbot`, `guides/`, `for/agencies/`); the full per-entry sweep is `forced-colors-and-zoom.spec.ts`'s existing 320px reflow test, which already iterates every real crawler/guide entry. |
| Status (`/status/`) | 360/768/1280 | default | |
| Free tools hub (`/tools/`) | 360/768 | default | |
| Customer app overview (`/app`) | 360/768/1280 | empty state (fixture account has 0 saved domains) | Populated/attention-queue states not re-captured; existing a11y suite covers the empty state explicitly. |
| Customer workspace (`/app/workspace`) | 768 | empty state | |
| Customer domains (`/app/domains`) | 360 | empty state | |
| Customer groups (`/app/groups`) | — | empty state | Not separately screenshotted; reachable and covered by `responsive-smoke`'s authenticated-shell loop. |
| Customer notifications (`/app/notifications`) | 360 | empty state | |
| Customer billing (`/app/billing`) | 360 | Free plan, plan-comparison cards | Already covered by pre-existing `responsive-smoke.spec.ts` "billing page" test at all 5 viewports. |
| Customer account (`/app/account`) | 360 | Profile, Google connect, passkeys, recovery codes, sessions, delete account | Found FINDING-04 here (raw User-Agent string). |
| Super Admin global dashboard (`/admin`) | 360/768 | populated (real seeded fixture data: 1986 users, 534 saved domains) | |
| Super Admin operations (`/admin/operations`) | 360 | loading → loaded (confirmed via existing test's own wait, not a defect) | |
| Super Admin users (`/admin/users`) | 360 | populated list (real seeded E2E fixture accounts) | |
| Super Admin domains (`/admin/domains`) | 360 | populated list | Not read in fine detail at 360px (compressed-thumbnail limitation); no overflow assertion failed. |
| Super Admin runtime settings (`/admin/settings`) | 360/768/1024/1280 | populated table, edit dialog not opened | Found and fixed FINDING-01 and FINDING-02/03 here. |
| Shared/print reports (`/shared/[token]`, print CSS) | — | not re-verified this phase | Pre-existing coverage: `tests/e2e/landing-page.spec.ts`'s print-media check and `AuditReportView`'s "Print report" button (Phase 3). Not re-screenshotted. |

## Not reviewed this phase (explicitly, not silently)

- `/admin/scans`, `/admin/jobs`, `/admin/webhooks`, `/admin/subscriptions`, `/admin/transactions`,
  `/admin/entitlements`, `/admin/incidents`, `/admin/security`, `/admin/blocked-targets`,
  `/admin/audit-logs`, `/admin/notices`, `/admin/plans`, `/admin/pilots`, `/admin/research`,
  `/admin/registry/*`, `/admin/shared-reports`, `/admin/analytics`, `/admin/health`,
  `/admin/users/[userId]` detail — all use the same `AdminNav`/`AdminLayout`/`DataTable`
  foundation already fixed in this phase, so the specific defects found are already resolved for
  these too by construction, but no individual screenshot of each was taken or reviewed.
- `/app/domains/[domainId]` (and its compare sub-route), `/app/agency-branding`,
  `/app/workspace/domains`, `/app/workspace/import`, `/app/continue` — same reasoning; the shared
  `AppNav`/`AppLayout` fixes apply, but individual pages weren't visually reviewed.
- Error/loading/hover/focus states across the board were not individually captured — the existing
  automated suites (`forced-colors-and-zoom.spec.ts` for focus visibility, `home.spec.ts` for
  several explicit error/empty states) remain the source of truth for those, unchanged by this
  phase.
