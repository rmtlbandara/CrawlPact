# Documentation Conflict Register — 2026-08-03

Phase 0 baseline. No document listed below was corrected during this phase — Phase 1 owns
documentation correction. Method: full read of `docs/status/{IMPLEMENTATION_STATUS,KNOWN_RISKS,
REQUIREMENTS_TRACEABILITY,FINAL_SRS_COMPLIANCE_REPORT,FINAL_SECURITY_AUDIT,
FINAL_PRODUCTION_READINESS_REPORT}.md`, `docs/architecture/adr/README.md`,
`docs/release/PRODUCTION_READINESS_CHECKLIST.md`, targeted SRS sections (§6.2, §7–8, §28.13,
§30.4, §39), plus the newer `docs/reports/CRAWLPACT_PRODUCTION_CONTENT_TRUST_SEO_*.md`, cross-checked
against `git log`, live migration/schema files, `wrangler.jsonc`, `middleware.ts`, `analytics.ts`,
`privacy.astro`, `SECURITY_CHECKLIST.md`, `BILLING_SECURITY.md`, `D1_R2_DATA_PLACEMENT_POLICY.md`.

## Central meta-finding

Three of the documents this phase was asked to check as authoritative status snapshots
(`FINAL_SRS_COMPLIANCE_REPORT.md`, `FINAL_SECURITY_AUDIT.md`, `FINAL_PRODUCTION_READINESS_REPORT.md`)
are Part 3 Step 23–25 deliverables **dated 2026-07-24**. At least 19 more merged PRs of work
happened after that date (2026-07-26 → 2026-07-31: Cloudflare account setup, audit engine enabled,
Paddle live webhook verification, release-flow/CI remediation, Google Analytics rollout, R2
agency-logo uploads, a new incident-tracking/status-page system, and a full production
content/trust/SEO pass). None of the three "Final" reports were revised despite their names
implying finality. Almost every conflict below is a symptom of this one root cause.

| ID     | Topic                                                                                                                                   | Severity | Status                   |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------ |
| DC-001 | Migration/table counts stale in 9 documents                                                                                             | P2       | open                     |
| DC-002 | REQUIREMENTS_TRACEABILITY.md §31 claims "no R2"; R2 adopted 2026-07-30                                                                  | P2       | open                     |
| DC-003 | FINAL_PRODUCTION_READINESS_REPORT.md's own summary contradicts its linked checklist                                                     | P2       | open                     |
| DC-004 | SECURITY_CHECKLIST.md says Paddle payloads unverified live; resolved 2026-07-28                                                         | **P1**   | open                     |
| DC-005 | KNOWN_RISKS.md's own table still shows "keep AUDIT_ENGINE_ENABLED disabled" as current, unstruck                                        | **P1**   | open                     |
| DC-006 | Three "Final" reports predate and omit GA, R2, and incident-tracking                                                                    | **P1**   | open                     |
| DC-007 | Incident-tracking system has no SRS requirement or traceability row                                                                     | P2       | open                     |
| DC-008 | Scanner "coming soon" hardcoded claim — historical, now fixed, precedent for recurrence                                                 | P2       | open (as prevention gap) |
| DC-009 | DATA_RETENTION.md omits `product_events`/`security_events`/`notifications` from its "still open" section                                | P2       | open                     |
| DC-010 | "Legal identity" gap framed as major trust issue; SRS itself imposes no such requirement                                                | P2       | open                     |
| DC-011 | Crawler registry/content-page counts stale (22/23 actual vs. documented 20/21)                                                          | P2       | open                     |
| DC-012 | SRS §28.13's 14-metric analytics dashboard requirement not cross-referenced from the readiness checklist, risking conflation with §28.2 | P2       | open                     |
| DC-013 | Crawler/operator count self-contradictory within one registry governance doc (21 vs. "23 total")                                        | P2       | open                     |
| DC-014 | Registry governance doc claims no interactive publish UI exists; full admin UI/API/tests already do                                     | P2       | open                     |
| DC-015 | `db:validate` reports 40 tables; live production `sqlite_master` query this session shows 39                                            | P2       | open                     |

### DC-001 — Migration count and table count stale in at least 9 documents

**Documents**: `IMPLEMENTATION_STATUS.md` (multiple lines), `REQUIREMENTS_TRACEABILITY.md:51`,
`EVIDENCE_OBSERVATORY_REDESIGN_SPEC.md:432`, `EVIDENCE_OBSERVATORY_REDESIGN_DELIVERABLES.md:141`,
`UI_UX_CONVERSION_AUDIT.md:54`, `RELEASE_CHECKLIST.md:24`, `PADDLE_LIVE_CONFIGURATION_REPORT.md:141`,
`DEPLOYMENT.md:83`, `CLOUDFLARE_CONFIGURATION.md:69`. **Statement**: all state "16 migrations, 38
tables." **Contradicting evidence**: repository currently has 18 migration files; the newest
reports (`CRAWLPACT_PRODUCTION_CONTENT_TRUST_SEO_*` reports) correctly state 40 tables as of
2026-07-31. **Impact**: anyone trusting the older documents gets a count two migrations/two tables
short, including the entire incident-tracking schema being invisible. **Phase**: 1.

### DC-002 — REQUIREMENTS_TRACEABILITY.md §31 claims "no R2"; R2 adopted since 2026-07-30

`REQUIREMENTS_TRACEABILITY.md:50` states "single-Worker + D1, no R2." The document it cites as its
own source, `D1_R2_DATA_PLACEMENT_POLICY.md:140-154`, has itself since documented "2026-07-30:
revisit trigger #1 fired — R2 adopted for agency logo uploads" — a real `AGENCY_LOGOS` R2 bucket
now exists (confirmed live this session). **Phase**: 1.

### DC-003 — FINAL_PRODUCTION_READINESS_REPORT.md's own summary contradicts its own linked checklist

Report summary states "Not started: 2/46" including item 40 (canonical redirects). The checklist
itself (row 40) says "Done — verified live 2026-07-27," explicitly noting the row "was stale
(claimed 'not started' after a real domain had already been connected)" — but the report's
headline count (41 Done/3 Partial/2 Not started) was never recomputed; the true current tally is
42 Done/3 Partial/1 Not started. **Phase**: 1.

### DC-004 — SECURITY_CHECKLIST.md says Paddle webhook payloads are "unverified against a live account"; resolved 2026-07-28

`SECURITY_CHECKLIST.md:42` states this is unverified. `BILLING_SECURITY.md:8-14` and
`KNOWN_RISKS.md` both record it resolved 2026-07-28 via a real webhook simulation. Two sibling
security documents in the same directory disagree on the same fact. **Severity: P1** — a
security-status document giving an outdated answer. **Phase**: 1.

### DC-005 — KNOWN_RISKS.md's own risk table still presents "keep AUDIT_ENGINE_ENABLED disabled" as current, unstruck

A row in KNOWN_RISKS.md's "Release-engineering hardening pass (2026-07-27)" table states
"Re-confirmed 2026-07-28: `AUDIT_ENGINE_ENABLED` remains `false`... Decision: keep disabled for
now" with no strikethrough — while `IMPLEMENTATION_STATUS.md` and a live `wrangler.jsonc` read
(confirmed this session) show it was overridden to `true` later the same day, 2026-07-28. Every
other resolved row in the same document uses a `~~strikethrough~~ **Resolved**` convention; this
one row was never updated to match, despite sitting in the same file as the entry that supersedes
it. **Severity: P1** — this is precisely the "scanner described as disabled after being enabled"
failure mode Phase 0 was asked to check for, and it's inside the risk ledger itself. **Phase**: 1
(trivial fix — strike the row, cross-reference the override).

### DC-006 — Three "Final" reports predate and omit GA, R2, and the incident/status-page system

None of `FINAL_SRS_COMPLIANCE_REPORT.md`, `FINAL_SECURITY_AUDIT.md`, or
`FINAL_PRODUCTION_READINESS_REPORT.md` mentions the Google Analytics deviation (added 2026-07-30),
R2 agency-logo adoption (2026-07-30), or the incident-tracking/status-page system (migration 0018,
shipped to production) — confirmed by direct grep, zero hits for any of the three terms across all
three documents. **Severity: P1**. **Phase**: 1 — refresh all three, or retitle them as historical
snapshots rather than "Final."

### DC-007 — Incident-tracking system has no SRS requirement and no traceability row

`packages/database/migrations/0018_incidents.sql`, `pages/admin/incidents/`,
`lib/admin/incidents.ts` are real and shipped, but the SRS has no "status page"/"incident"
requirement backing this feature (the only related SRS hits are an unrelated §6.2 prohibition on
external uptime-monitoring integrations and one line about pausing monitoring during an incident),
and `REQUIREMENTS_TRACEABILITY.md` has no row for it. Not necessarily wrong — it's disclosed in
`docs/architecture/INCIDENT_TRACKING_SYSTEM_DESIGN.md` — but means the traceability matrix can no
longer be read as a complete feature inventory. **Phase**: 1.

### DC-008 — Scanner "coming soon" hardcoded claim (historical, now fixed — a recurrence precedent)

`EVIDENCE_OBSERVATORY_REDESIGN_SPEC.md` documents its own prior error: `scanner.astro` once had a
hardcoded "not yet enabled" claim baked into static prerendered output while production actually
had the engine enabled since commit `6320032`. Confirmed already fixed (`scanner.astro:6` now
reads the flag live). Included here as a documented precedent of exactly the failure class Phase 0
was asked to check for, useful for a Phase 1/12 grep-based CI guard against recurrence. **Phase**:
1/12.

### DC-009 — DATA_RETENTION.md omits three no-purge-job tables from its own "still open" section

`DATA_RETENTION.md`'s "What's still open" section lists only billing records
(`transactions`/`webhook_events`) as lacking a purge job. `KNOWN_RISKS.md` separately states
`product_events`/`security_events`/`notifications` also have no purge job at all and are
"structurally unbounded." A reader checking only the dedicated retention document — the more
likely place to look — would miss this, including the fact that the table backing first-party
analytics has no purge job. **Phase**: 1.

### DC-010 — "Legal identity" gap framed as a major trust issue; the SRS itself imposes no such requirement

`KNOWN_RISKS.md`, `LEGAL_INFORMATION_CHECKLIST.md`, and a completion report all frame the missing
legal entity/address/jurisdiction/contact disclosure as a significant tracked gap. An exhaustive
grep of the SRS for "legal entity," "jurisdiction," "registered address," "governing law,"
"company name," "incorporat" returns **zero matches** — the SRS's only related text (§39) is a
soft, trademark-specific, pre-investment recommendation, not an entity/jurisdiction/contact launch
requirement. Not a direct contradiction (no document claims the SRS mandates this), but a real risk
that a future pass could miscite the SRS as this requirement's source — it is in fact a
product-owner governance decision, independently made and already correctly marked "deferred by
explicit product-owner instruction 2026-07-31." **Phase**: 2 (clarify sourcing).

### DC-011 — Crawler registry/content-page counts stale in status docs

`IMPLEMENTATION_STATUS.md` and `REQUIREMENTS_TRACEABILITY.md` state "20 crawler-reference pages"
implying ~21 registry crawlers. Direct count: 22 content files, 23 distinct registry crawler IDs
(two Amazon crawlers added in the 2026-07-31 content pass). The underlying disclosed gap
(Bingbot has no content page, JS-rendered source) is still accurate — only the absolute numbers
are stale. Low impact (SRS §30.4's 20-page floor is still exceeded either way). **Phase**: 2.

### DC-012 — SRS §28.13's 14-metric analytics dashboard requirement not distinguished from §28.2's global dashboard

SRS §28.13 requires a Super-Admin-visible dashboard of 14 named usage metrics — confirmed still
not built (no `admin/*analytic*` page exists), and this is honestly disclosed in
`REQUIREMENTS_TRACEABILITY.md` itself. Flagged here only because `PRODUCTION_READINESS_CHECKLIST.md`
item 28 ("Super Admin dashboard shows global data," fully Done) covers a _different_ SRS subsection
(§28.2), and the checklist doesn't make that distinction explicit — risk of conflating the two.
**Phase**: 2.

### DC-013 — Crawler/operator count self-contradictory within `CRAWLER_REGISTRY_GOVERNANCE.md` itself

The same document states "21 crawlers" at one point and, in its own "correction pending
publication" note, says the corrected total is "23 crawlers total" — the seed data already matches
the higher, corrected number. **Phase**: 15.

### DC-014 — Registry governance doc claims no interactive publish UI exists; a full one already does

`CRAWLER_REGISTRY_GOVERNANCE.md:84-88` states publish/release UI is unbuilt "Part 6... work." A
full admin registry UI, API route tree, and a 10-case integration test suite already exist in the
repository. Either the doc is stale, or a scope subtlety (publish-time FR-REG-005 enforcement
specifically, vs. general CRUD) is undocumented. **Phase**: 15.

### DC-015 — `db:validate` reports 40 tables; live production query this session shows 39

`pnpm db:validate` (static, local) reports "40 tables verified consistent." A live read-only query
against production `crawlpact-db`'s `sqlite_master` this session (see
`PRODUCTION_INFRASTRUCTURE_INVENTORY.md` §2.2) enumerates 39 real tables. Both are accurate
readings of what they each measure; root cause not investigated in this inspection-only phase.
**Phase**: 1 or 11.

## Topics checked with no conflict found

- **Authentication**: no contradictions — `FINAL_SECURITY_AUDIT.md`'s auth section matches current
  `lib/auth/*` behavior exactly.
- **Pricing/plan limits**: SRS §8's table matches `reference-data.sql` and `pricing.astro` exactly
  (see `BILLING_AND_PLAN_BASELINE.md` for the separate, code-level plan-consistency findings, which
  are distinct from documentation conflicts).
- **Notification channels**: SRS bans email/SMS providers; confirmed no such integration exists
  anywhere.
- **Agency features/Super Admin**: internally consistent modulo the stale counts in DC-001.
- **Monitoring/CPU-budget claims**: correctly framed as estimates throughout, and explicitly
  labelled "accepted, not resolved" even after the engine was enabled.

## Verification limitations

- This register reflects a documentation cross-read, not an exhaustive line-by-line diff of every
  document in `docs/`. Additional stale-count instances beyond the 9 cited in DC-001 may exist.
