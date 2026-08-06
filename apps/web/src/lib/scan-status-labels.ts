import type { AuditStatus } from "@crawlpact/core";
import type { StatusTone } from "@crawlpact/ui";

/**
 * Single source for scan/audit status presentation, shared by the audit
 * report view and (Phase 8) the saved-domain scan-history list — extracted
 * from AuditReportView.tsx so both consumers render the same human labels
 * instead of the raw status enum string. See
 * docs/brand/MESSAGING_SURFACE_INVENTORY.md item C3.
 */
export const STATUS_TONE: Record<AuditStatus, StatusTone> = {
  queued: "info",
  running: "info",
  completed: "success",
  completed_with_warnings: "warning",
  incomplete: "unknown",
  target_unavailable: "error",
  blocked_for_safety: "error",
  rate_limited: "warning",
  internal_failure: "error",
  engine_disabled: "unknown",
};

export const STATUS_LABEL: Record<AuditStatus, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Complete",
  completed_with_warnings: "Complete with warnings",
  incomplete: "Incomplete",
  target_unavailable: "Target unavailable",
  blocked_for_safety: "Blocked for safety",
  rate_limited: "Rate limited",
  internal_failure: "Internal error",
  engine_disabled: "Engine disabled",
};
