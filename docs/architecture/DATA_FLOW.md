# Data Flow

**Corrected 2026-08-03 (Phase 1)** — this document previously described the scanner and scheduled
monitoring as "not implemented yet"/"Part 4, not yet implemented." Both are built and, per
`docs/baseline/2026-08-03/CAPABILITY_MATRIX.md`, the anonymous-audit path is `verified-live` in
production (`AUDIT_ENGINE_ENABLED=true`). See `docs/status/CURRENT_STATE.md` for current
capability status.

## Anonymous audit request (current)

```text
Browser (AuditForm island)
  → normalizeTarget() client-side (packages/core) — rejects obviously invalid input
  → POST /api/audit { target }
      → createAuditRequestSchema.safeParse (zod)
      → normalizeTarget() server-side (never trust client validation alone)
      → check AUDIT_ENGINE_ENABLED
          false → 503 AUDIT_ENGINE_DISABLED (honest disabled state, no fabricated result)
          true  → runs the real scan pipeline below
  ← standard API envelope (ok/data or ok:false/error)
Browser renders the result (or the honest disabled/error state) inline.
```

## Real scan pipeline (production default: `AUDIT_ENGINE_ENABLED=true`)

```text
POST /api/audit
  → validate + normalise target (as above)
  → packages/scanner: safe-fetch chokepoint resolves DNS, rejects unsafe IP ranges (ADR-0005)
  → fetch robots.txt / llms.txt / RSL / headers / sitemap (bounded, ≤12 requests)
  → packages/scanner: parse + evaluate against active crawler registry
  → policy engine: conflict detection, findings, Policy Health Score
  → persist scan + scan_resources + scan_crawler_results + findings (packages/database)
  → return auditId; GET /api/audit/:id and /api/audit/:id/report serve progress and results
```

## Scheduled monitoring

```text
Cloudflare Cron Trigger (daily, 03:00 UTC) → worker.ts `scheduled()`
  → gated behind AUDIT_ENGINE_ENABLED==="true" and runtime_configuration's
    scheduler_paused/maintenance_mode flags
  → select due domains (domains.next_scan_at <= now, monitoring_state = 'active'),
    MAX_DOMAINS_PER_SWEEP=20 per tick — see docs/risks/ACTIVE_RISKS.md for the CPU-budget risk
    this batch size carries at commercial scale
  → bounded batch, per-domain scan (same pipeline as above, triggered_by = 'scheduled')
  → semantic diff against previous scan → scan_diffs (website_drift | registry_drift)
  → notifications for material changes
  → scheduled_job_runs row recording the run
```

## Data that never leaves the request/response boundary

Session tokens, recovery codes (only hashes are stored), and Paddle webhook secrets are never
included in any API response body, log line, or admin export — see
`docs/security/SECURITY_CHECKLIST.md`.
