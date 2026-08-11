---
Document owner: Engineering owner
Status: current-authoritative
Last verified: 2026-08-11
---

# Phase 15 — Registry Re-Evaluation Entitlement Decision

Section 57 of the Phase 15 prompt requires this question to be answered from evidence, not
assumption: **how does registry-driven re-evaluation interact with plan entitlements?** This
document answers each sub-question from the actual code path, cites the exact files, and states
the resulting product decision.

## How registry-driven re-evaluation actually works today

`publishRegistryVersion`/`rollbackRegistryVersion` compute the semantic diff between the
previously-active and newly-active release (`apps/web/src/lib/registry-semantic-diff.ts`), find
saved domains whose last scan evaluated one of the changed crawlers
(`getAffectedDomains`, `apps/web/src/lib/admin/registry.ts`), and call
`scheduleReEvaluation(db, domainIds)` (same file). That function does exactly one thing:

```ts
await db
  .update(schema.domains)
  .set({ nextScanAt: now, updatedAt: now })
  .where(inArray(schema.domains.id, domainIds));
```

It does **not** insert a `scans` row, does not touch any quota counter, and does not itself
trigger a network fetch. The only thing that can act on the resulting `nextScanAt` is the
existing scheduled-monitoring sweep (`apps/web/src/lib/monitoring.ts`).

## Question-by-question answers (from code, not guessed)

**Does Free receive automatic registry-driven re-evaluation despite having no scheduled
monitoring?**
No. `monitoring.ts:72` filters sweep candidates to
`c.monitoringFrequency !== "none" && ...`. The `free` plan row
(`packages/database/seed/reference-data.sql` / `apps/web/tests/integration/d1-harness.ts`) has
`monitoring_frequency = 'none'`. Setting `nextScanAt = now` on a Free-plan domain has no effect —
the sweep will never select it. Free-plan domains never receive an automatic, system-triggered
re-scan from a registry release, exactly as they never receive one from anything else.

**Is registry re-evaluation a system integrity operation separate from automatic monitoring?**
No — it deliberately reuses the _same_ mechanism (`nextScanAt` + the existing sweep + the
existing `monitoringFrequency` gate), not a parallel one. This was a design choice already
present before Phase 15 (`scheduleReEvaluation`'s own docstring: "schedules affected domains for
their next monitoring sweep immediately rather than waiting for their normal cadence"). Phase 15
did not introduce a second, registry-specific evaluation channel, and per Section 55/56 it should
not — reusing the existing bounded, capacity-safe sweep is exactly what those sections ask for.

**Does it consume a manual rescan?**
No. The manual-rescan quota is enforced by counting `scans` rows with
`triggeredBy = 'manual'` within the calendar month
(`apps/web/src/pages/api/domains/[domainId]/scan.ts:45`). The sweep inserts scans with
`triggeredBy: "scheduled"` (`monitoring.ts:447,499`). A registry-driven re-scan is always
`triggeredBy: "scheduled"`, never `"manual"` — confirmed by code, not inferred.

**Does it affect plan quota?**
No numeric quota field exists for scheduled scans; `manualRescansPerDomainPerMonth` is the only
quota this system has, and it is untouched (see above).

**Does it require a new network scan?**
Yes, once the sweep picks the domain up — this implementation does not attempt retained-evidence
re-evaluation (Section 60); see "What was deliberately not done" below.

## The resulting behaviour, and why it already satisfies Section 59 without new code

Section 59 lists three acceptable options when a plan doesn't get immediate re-evaluation. The
codebase, unmodified by this decision, already implements the first two simultaneously:

1. **"Apply the new registry on the user's next scan"** — true for every plan, including Free.
   Every scan-producing code path (`api/audit/index.ts`, `api/domains/[domainId]/scan.ts`,
   `audit-continuation.ts`, `admin/domains.ts`, the monitoring sweep) calls `getActiveRegistry(db)`
   fresh at scan time — there is no caching of "the registry as it was when the domain was saved."
   A Free-plan user's next manual re-scan (or next anonymous audit) automatically evaluates
   against whichever release is active at that moment.
2. **"Mark saved domain as potentially affected"** — for monitored plans (Solo/Pro/Agency),
   `scheduleReEvaluation` does exactly this by moving `nextScanAt` into the past, which the
   existing sweep treats as "due now."

Free-plan domains are not marked in any way today — `getAffectedDomains` doesn't distinguish by
plan, so a Free-plan domain, if it happens to be in the affected set, still gets `nextScanAt`
written, but that write is inert per the sweep's own filter. This is silent-but-harmless, not
silent-but-wrong: no unintended monitoring is introduced (Section 59's actual prohibition), it
simply has no observable effect until the user's next real scan.

## Decision

**No code change is required to satisfy Section 57-59.** The existing mechanism already:

- never silently grants Free-plan accounts ongoing monitoring (the sweep's plan gate makes this
  structurally impossible, not merely policy),
- never consumes a manual-rescan allowance,
- never changes a plan's numeric limits,
- eventually reaches every plan (monitored plans proactively via the sweep, all plans reactively
  on their next scan).

This is recorded as a decision, not a silent pass, because Section 57 explicitly forbids
guessing — the above is the evidence trail for why "no change" is the correct answer here rather
than an oversight.

## What was deliberately not done

- **Retained-evidence re-evaluation** (Section 60): not implemented. Phase 11's minimised
  evidence (`scan_resources.snapshot_text`, `html_meta`) is not currently re-run against a new
  registry release without a fresh fetch. Every re-evaluation, monitored or manual, performs a
  real scan. This is the deliberately conservative, always-correct default the prompt itself
  prefers ("Otherwise use a fresh scan") when reliability isn't independently proven — reusing
  retained evidence for registry-only re-evaluation was judged out of scope for this phase given
  the added complexity of proving evidence-format compatibility across every ruleset.
- **A dedicated "registry re-evaluation" plan-quota exemption flag**: not needed, since nothing
  currently at risk of consuming a quota does so (see above) — adding one would be unused
  scaffolding.
