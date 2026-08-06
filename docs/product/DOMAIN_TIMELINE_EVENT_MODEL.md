# `domain_change_events` — Event Schema

Added by migration `packages/database/migrations/0026_domain_change_events.sql`, additive only.

| Column                         | Type                                                    | Notes                                                                                                                                    |
| ------------------------------ | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                           | text PK                                                 | `crypto.randomUUID()`                                                                                                                    |
| `domain_id`                    | text NOT NULL, FK → `domains.id`                        | `ON DELETE CASCADE` — an event has no meaning once its domain is gone (matches `scan_diffs`)                                             |
| `event_type`                   | text NOT NULL                                           | `baseline \| website_policy_change \| registry_driven_change \| mixed_change \| operational_change`                                      |
| `change_origin`                | text NOT NULL                                           | `website_policy \| registry_driven \| mixed \| operational \| uncertain \| baseline` — see attribution model doc                         |
| `attention_level`              | text NOT NULL                                           | `informational \| review_recommended \| high_attention` — see finding-lifecycle/severity doc                                             |
| `observed_at`                  | text NOT NULL                                           | ISO timestamp, the current scan's `startedAt` (or the preset-change time for operational preset events)                                  |
| `previous_scan_id`             | text, FK → `scans.id`, `ON DELETE SET NULL`             | nullable — absent for `baseline` and `preset_changed` events                                                                             |
| `current_scan_id`              | text, FK → `scans.id`, `ON DELETE SET NULL`             | nullable — absent for `preset_changed` events                                                                                            |
| `previous_registry_version_id` | text, FK → `registry_versions.id`, `ON DELETE SET NULL` |                                                                                                                                          |
| `current_registry_version_id`  | text, FK → `registry_versions.id`, `ON DELETE SET NULL` |                                                                                                                                          |
| `affected_purposes_json`       | text NOT NULL                                           | JSON array of `search \| training \| user_triggered \| agent \| multipurpose \| unknown`                                                 |
| `finding_counts_json`          | text NOT NULL                                           | JSON `{appeared, persisting, changed, resolved}` — all `0` for baseline/operational events                                               |
| `summary`                      | text NOT NULL                                           | one human-readable sentence, generated deterministically (never from an LLM)                                                             |
| `details_json`                 | text NOT NULL                                           | bounded JSON: crawler-result changes, resource types compared, preset from/to — enough to render the event row without re-querying scans |
| `completeness`                 | text NOT NULL                                           | `complete \| partial` — mirrors the current scan's status                                                                                |
| `fingerprint`                  | text NOT NULL, UNIQUE                                   | see below                                                                                                                                |
| `model_version`                | text NOT NULL                                           | `"1"` — the attribution/model version that produced this row                                                                             |
| `created_at`                   | text NOT NULL                                           | insert time (may differ slightly from `observed_at`)                                                                                     |

Indexes: `idx_domain_change_events_domain_observed` on `(domain_id, observed_at DESC)` for
timeline pagination; `idx_domain_change_events_fingerprint` (unique) for idempotency.

## Fingerprint

`sha256(domainId + "|" + eventType + "|" + (previousScanId ?? "none") + "|" + currentScanId +
"|" + modelVersion)` for scan-comparison events; for `preset_changed`,
`sha256(domainId + "|preset_changed|" + fromPreset + "|" + toPreset + "|" + observedAtIsoMinute)`
(minute-granularity so two genuinely separate preset changes in the same minute — unlikely, but
not impossible via rapid API calls — still get two idempotency-safe rows only when they actually
differ in `from`/`to`).

## Foreign-key behaviour (Phase 11 rules)

- `domain_id`: `ON DELETE CASCADE` — same as `scan_diffs`.
- `previous_scan_id` / `current_scan_id`: `ON DELETE SET NULL` — a purged scan does not delete the
  timeline row; the event's own summary/JSON fields remain the source of truth for what the row
  says, matching the Phase 11 `scan_diffs` fix exactly.
- `previous_registry_version_id` / `current_registry_version_id`: `ON DELETE SET NULL` — registry
  versions are not currently deletable in this codebase (only publish/rollback flip `isActive`),
  but the FK is defensively `SET NULL` rather than `NO ACTION` to match this phase's own
  retention-compatibility rule.

## Why not reuse `scan_diffs` directly

`scan_diffs` already exists with a similar shape but serves a different, narrower role today: it
is the input to the existing notification pipeline (`createNotification()` in
`monitoring.ts`), uses a 3-value `diffType` that cannot represent `mixed`/`uncertain`, and has no
idempotency/fingerprint mechanism (`monitoring.ts` inserts unconditionally whenever
`crawlerResultChanges.length > 0`). Extending it in place would risk changing notification
behaviour as a side effect of a UI feature — exactly the kind of scope bleed the phase boundaries
prohibit. `domain_change_events` is instead purpose-built for the timeline, generated _alongside_
(not instead of) the existing `scan_diffs` write, so the notification pipeline is untouched.
