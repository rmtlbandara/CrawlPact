# Data Flow

## Anonymous audit request (current, Part 1 behaviour)

```text
Browser (AuditForm island)
  → normalizeTarget() client-side (packages/core) — rejects obviously invalid input
  → POST /api/audit { target }
      → createAuditRequestSchema.safeParse (zod)
      → normalizeTarget() server-side (never trust client validation alone)
      → check AUDIT_ENGINE_ENABLED
          false → 503 AUDIT_ENGINE_DISABLED (current default; no fabricated result)
          true  → 500 INTERNAL_ERROR (scanner not implemented yet — fails loudly, not silently)
  ← standard API envelope (ok/data or ok:false/error)
Browser renders the honest disabled/error state inline.
```

## Future audit request (Part 2+, once the scanner ships)

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

## Scheduled monitoring (Part 4, not yet implemented)

```text
Cloudflare Cron Trigger → worker.ts `scheduled()`
  → select due domains (domains.next_scan_at <= now, monitoring_state = 'active')
  → bounded batch, per-domain scan (same pipeline as above, triggered_by = 'scheduled')
  → semantic diff against previous scan → scan_diffs (website_drift | registry_drift)
  → notifications for material changes
  → scheduled_job_runs row recording the run (Part 1 already writes a placeholder row here)
```

## Data that never leaves the request/response boundary

Session tokens, recovery codes (only hashes are stored), and Paddle webhook secrets are never
included in any API response body, log line, or admin export — see
`docs/security/SECURITY_CHECKLIST.md`.
