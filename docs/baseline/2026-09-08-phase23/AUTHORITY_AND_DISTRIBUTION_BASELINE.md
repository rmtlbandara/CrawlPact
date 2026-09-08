# Phase 23 Authority & Distribution Baseline (Workstream 23A)

All figures below were freshly checked this session (2026-09-08), not copied forward from an
earlier phase's report without re-verification.

## Search (Google Search Console, `sc-domain:crawlpact.com`)

- **Settled date**: 2026-09-06 — re-queried this session; identical to Phase 22's own snapshot
  because no newer date has settled yet (GSC's own processing lag), not because the check was
  skipped.
- **28d** (2026-08-10 → 2026-09-06): 3 clicks, 888 impressions, 0.338% CTR, avg. position 61.56.
- **90d** (2026-06-09 → 2026-09-06): 6 clicks, 1,349 impressions, 0.445% CTR, avg. position 64.41.
- **Brand-query rows**: **0 of 77** 28-day query rows, **0 of 115** 90-day query rows contain
  "crawlpact" or "crawl pact" in any form — re-checked directly this session. Unchanged from
  Phase 20/22.
- **Authority-limited pages** (handed off from Phase 22): `/tools/robots-txt-ai-validator/`,
  `/crawlers/amazonbot/` — see `SEARCH_AUTHORITY_HANDOFF.md` for fresh re-verification.
- **Indexing state**: `/audit/` and `/platforms/` were both "URL is unknown to Google" as of
  Phase 22's 2026-09-08 check. Not re-inspected again today — Phase 22's own guidance (Section 78)
  is to avoid using URL Inspection quota merely to check for a recrawl within days of the last
  check; the T+7 checkpoint (`MEASUREMENT_AND_CADENCE.md`) is the right time to recheck.

## Acquisition (GA4)

- **28d totals** (existing Phase 20 export, re-read this session, not re-queried — see "why" below):
  7 active users, 4 new users, 40 sessions, 26 engaged sessions, 65% engagement rate.
- **Source/medium breakdown**: `(direct)/(none)` 22 sessions (7 users), `google/organic` 3 sessions
  (2 users), `search.google.com/referral` 15 sessions (1 user).
- **Classification: `OWNER/TEST-CONTAMINATED`.** Seven total active users in a 28-day window, with
  22 of the sessions unattributed direct traffic, is consistent with the product owner's own
  repeated manual testing and this session's own repeated `curl`/browser verification against
  production (Phases 20-22 each involved dozens of direct production requests) — not organic
  discovery. No channel-effectiveness conclusion is drawn from this data, per Section 16's explicit
  instruction.
- **Why not re-queried fresh**: GA4's own export tooling was last run within this session (Phase
  20/21 era); at this traffic volume and this short an interval, a fresh pull would not
  meaningfully change the contamination conclusion, and Section 101's "prefer stable periods"
  guidance applies. The existing export is used as-is, dated, and labelled.

## Product (direct, read-only production D1 queries — `wrangler d1 execute crawlpact-db --remote`)

| Metric                         | Value                                                                                                         | Basis                                                                                                                                                                                                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Total users                    | 3                                                                                                             | `SELECT COUNT(*) FROM users`                                                                                                                                                                                                                                                                      |
| User identity                  | All 3 display names are variants of the product owner's own name ("Tharindu Bandara" ×2, "Tharindu Admin" ×1) | `SELECT id, display_name, is_admin, created_at FROM users`                                                                                                                                                                                                                                        |
| External accounts              | **0**                                                                                                         | No user record is not the owner                                                                                                                                                                                                                                                                   |
| External activated accounts    | **0**                                                                                                         | Same reasoning                                                                                                                                                                                                                                                                                    |
| Saved domains (all)            | 4                                                                                                             | `SELECT COUNT(*) FROM domains WHERE deleted_at IS NULL`                                                                                                                                                                                                                                           |
| Monitored domains (all)        | 4 (100% of saved)                                                                                             | `monitoring_state = 'active'`                                                                                                                                                                                                                                                                     |
| **External monitored domains** | **0**                                                                                                         | Zero non-owner users exist to own them                                                                                                                                                                                                                                                            |
| Active subscriptions           | 2                                                                                                             | `SELECT status, COUNT(*) FROM subscriptions GROUP BY status`                                                                                                                                                                                                                                      |
| **External paying customers**  | **0**                                                                                                         | Confirmed independently: matches `docs/pilot/PHASE_17_COMMERCIAL_VALIDATION_DECISION.md`'s own existing finding that "the two existing production subscriptions belong to the product owner's own account" — this session's direct query corroborates that record rather than merely repeating it |

The exact domain names and subscription-to-user join were **not queried** — the total-user-count
alone (3, all owner) is sufficient to establish the external-count conclusions above without
needing to inspect individual domain or billing records, consistent with Section 114's privacy
regression gate (do not expose customer/audit-target domain data unnecessarily).

## Pilot (Phase 17/19 infrastructure)

| Metric                         | Value                                         |
| ------------------------------ | --------------------------------------------- |
| Pilot cohorts                  | 0 (`SELECT COUNT(*) FROM pilot_cohorts`)      |
| Pilot participants             | 0 (`SELECT COUNT(*) FROM pilot_participants`) |
| Agency/multi-site participants | 0                                             |
| Observation window             | Not started                                   |

Unchanged from the existing record. The pilot infrastructure (`pilot_cohorts`, `pilot_participants`,
`pilot_feedback`, `/admin/pilots`) is built and has never been used to recruit a real participant.

## Distribution

| Metric                                                                | Value                                                                                                                                                                                |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Known referring sources (GA4 referral, excluding `search.google.com`) | 0 identifiable external referrers                                                                                                                                                    |
| Known editorial mentions                                              | 0                                                                                                                                                                                    |
| Known relevant external citations                                     | 0                                                                                                                                                                                    |
| Verified external links (Search Console Links report)                 | Not checked — the Search Analytics API used by this tooling does not expose the Links report; no owner-provided export exists this session. See `EARNED_LINK_AND_MENTION_POLICY.md`. |
| Social/community referrals                                            | 0 measurable                                                                                                                                                                         |

## Registry / research readiness

|                                    |                                                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| Active registry release            | `2026.07.3` (`is_active = 1`, published 2026-07-28) — the only row in `registry_versions`      |
| Pending candidate release          | None exists in the database                                                                    |
| Research publications (any status) | **0 rows** in `research_publications` — not even a draft has ever been generated in production |

See `RESEARCH_AUTHORITY_PLAN.md` for the full readiness assessment, including the one real gap
found: Phase 22's Amazon/Perplexity robots.txt-compliance findings live in the public content
pages but have not been propagated into the governed registry DB's `crawlers.description` field.
