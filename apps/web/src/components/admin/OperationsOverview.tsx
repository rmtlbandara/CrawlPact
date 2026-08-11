import { useEffect, useState, useCallback } from "react";
import { Button, StatusChip, MetricCard, type StatusTone } from "@crawlpact/ui";
import { AdminActionDialog } from "./AdminActionDialog";

type AlertSeverity = "info" | "warning" | "critical";

type OperationalAlert = {
  id: number;
  alertKey: string;
  severity: AlertSeverity;
  source: string;
  detail: string;
  firstSeenAt: string;
  lastSeenAt: string;
  occurrenceCount: number;
  resolvedAt: string | null;
  acknowledgedAt: string | null;
};

type SchedulerAnomaly = { type: string; jobName: string; detail: string };

type RatioMetric = { numerator: number; denominator: number; percent: number | null };

type ReliabilityTrends = {
  windowHours: number;
  monitoringTimeliness: RatioMetric;
  jobReliability: RatioMetric;
  billingProcessingReliability: RatioMetric;
  authFailureCount: number;
  alertsOpenedInWindow: number;
};

type PublicStatusLevel =
  | "operational"
  | "degraded_performance"
  | "partial_outage"
  | "major_outage"
  | "maintenance"
  | "status_unavailable";
type InternalStatus = "operational" | "degraded" | "maintenance";

type OperationsSummary = {
  checkedAt: string;
  status: {
    checkedAt: string;
    publicOverall: PublicStatusLevel;
    internalOverall: InternalStatus;
    hasPublicImpact: boolean;
    activePublicIncidentCount: number;
    internalWarningCount: number;
  };
  capacity: {
    d1: { tableCount: number };
    r2: { agencyLogosObjectCount: number; truncated: boolean };
    monitoring: {
      dueNowCount: number;
      pausedDomainCount: number;
      platformFailureCountLast24h: number;
      targetFailureCountLast24h: number;
      longOverdueActiveDomainCount: number;
    };
    notifications: { createdLast24h: number; activeAtomTokenCount: number };
  };
  schedulerAnomalies: SchedulerAnomaly[];
  activeAlerts: OperationalAlert[];
  trends: ReliabilityTrends[];
  deployment: null;
  registryHealth: {
    activeReleaseId: string | null;
    activeReleaseVersionLabel: string | null;
    activeReleasePublished: boolean;
    activeRulesetExists: boolean;
    checksumValid: boolean | null;
    entriesParseCleanly: boolean;
    duplicateEvaluationTokens: string[];
    unverifiedEvaluationEntries: string[];
    reviewDueCount: number;
  };
};

const SEVERITY_TONE: Record<AlertSeverity, StatusTone> = {
  info: "unknown",
  warning: "warning",
  critical: "critical",
};

const STATUS_TONE: Record<PublicStatusLevel, StatusTone> = {
  operational: "success",
  degraded_performance: "warning",
  partial_outage: "warning",
  major_outage: "critical",
  maintenance: "warning",
  status_unavailable: "unknown",
};

const INTERNAL_TONE: Record<InternalStatus, StatusTone> = {
  operational: "success",
  degraded: "error",
  maintenance: "warning",
};

const WINDOW_LABEL: Record<number, string> = {
  1: "1 hour",
  24: "24 hours",
  168: "7 days",
  720: "30 days",
};

function formatRatio(r: RatioMetric): string {
  if (r.denominator === 0) return "Insufficient historical data";
  return `${r.numerator} / ${r.denominator} — ${r.percent}%`;
}

function formatTimestamp(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, " UTC");
}

/**
 * Phase 14 Super Admin operations control plane (§29-31). Composes
 * `/api/admin/operations` — never re-derives any signal client-side. Every
 * manual action below (re-run health evaluation, re-run notification
 * reconciliation, retention dry-run, acknowledge alert) goes through
 * `AdminActionDialog`, so a reason is always collected and always audited,
 * matching every other Super Admin mutation in this codebase.
 */
export function OperationsOverview() {
  const [summary, setSummary] = useState<OperationsSummary | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [banner, setBanner] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [openDialog, setOpenDialog] = useState<
    "evaluate" | "reconcile" | "retention-dry-run" | number | null
  >(null);

  const load = useCallback(() => {
    fetch("/api/admin/operations")
      .then(
        (res) =>
          res.json() as Promise<{
            ok: boolean;
            data?: OperationsSummary;
            error?: { message: string };
          }>,
      )
      .then((body) => {
        if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
        setSummary(body.data!);
      })
      .catch((err) => setError((err as Error).message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runAction(path: string, reason: string, successMessage: string) {
    setBusy(true);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setBanner(successMessage);
      setOpenDialog(null);
      load();
    } catch (err) {
      setBanner((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="text-supporting text-error">{error}</p>;
  if (!summary) return <p className="text-supporting text-neutral-600">Loading…</p>;

  return (
    <div className="flex flex-col gap-8">
      {banner && (
        <div className="rounded-card border border-neutral-200 bg-neutral-50 p-3 text-supporting text-neutral-800">
          {banner}
        </div>
      )}

      <section aria-labelledby="ops-summary-heading">
        <h2 id="ops-summary-heading" className="text-card-heading text-neutral-950">
          Operations summary
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-card border border-neutral-200 bg-white p-4">
            <p className="text-supporting text-neutral-500">Public overall status</p>
            <div className="mt-2">
              <StatusChip
                tone={STATUS_TONE[summary.status.publicOverall]}
                label={summary.status.publicOverall}
              />
            </div>
          </div>
          <div className="rounded-card border border-neutral-200 bg-white p-4">
            <p className="text-supporting text-neutral-500">Internal overall state</p>
            <div className="mt-2">
              <StatusChip
                tone={INTERNAL_TONE[summary.status.internalOverall]}
                label={summary.status.internalOverall}
              />
            </div>
          </div>
          <MetricCard label="Active alerts" value={summary.activeAlerts.length} />
          <MetricCard label="Scheduler anomalies" value={summary.schedulerAnomalies.length} />
        </div>
        <p className="mt-3 text-metadata text-neutral-500">
          Last evaluated: {formatTimestamp(summary.checkedAt)}. Deployment commit/Worker version are
          not available from within this Worker — see the most recent
          <code> deploy-production.yml</code> run summary in GitHub Actions.
        </p>
      </section>

      <section aria-labelledby="ops-alerts-heading">
        <h2 id="ops-alerts-heading" className="text-card-heading text-neutral-950">
          Active operational alerts
        </h2>
        {summary.activeAlerts.length === 0 ? (
          <p className="mt-2 text-supporting text-neutral-600">No active alerts.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {summary.activeAlerts.map((alert) => (
              <li key={alert.id} className="rounded-card border border-neutral-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StatusChip tone={SEVERITY_TONE[alert.severity]} label={alert.severity} />
                    <span className="font-medium text-neutral-900">{alert.alertKey}</span>
                  </div>
                  {!alert.acknowledgedAt && (
                    <Button variant="secondary" onClick={() => setOpenDialog(alert.id)}>
                      Acknowledge
                    </Button>
                  )}
                </div>
                <p className="mt-2 text-supporting text-neutral-600">{alert.detail}</p>
                <p className="mt-1 text-metadata text-neutral-400">
                  Source: {alert.source} · First seen {formatTimestamp(alert.firstSeenAt)} · Last
                  seen {formatTimestamp(alert.lastSeenAt)} · Occurrences: {alert.occurrenceCount}
                  {alert.acknowledgedAt && " · Acknowledged"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="ops-capacity-heading">
        <h2 id="ops-capacity-heading" className="text-card-heading text-neutral-950">
          Capacity and monitoring
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="D1 tables" value={summary.capacity.d1.tableCount} />
          <MetricCard
            label="R2 agency-logo objects"
            value={
              summary.capacity.r2.truncated
                ? `${summary.capacity.r2.agencyLogosObjectCount}+`
                : summary.capacity.r2.agencyLogosObjectCount
            }
          />
          <MetricCard label="Monitoring due now" value={summary.capacity.monitoring.dueNowCount} />
          <MetricCard
            label="Long-overdue active domains"
            value={summary.capacity.monitoring.longOverdueActiveDomainCount}
          />
          <MetricCard
            label="Paused domains"
            value={summary.capacity.monitoring.pausedDomainCount}
          />
          <MetricCard
            label="Platform failures (24h)"
            value={summary.capacity.monitoring.platformFailureCountLast24h}
          />
          <MetricCard
            label="Target failures (24h)"
            value={summary.capacity.monitoring.targetFailureCountLast24h}
          />
          <MetricCard
            label="Notifications created (24h)"
            value={summary.capacity.notifications.createdLast24h}
          />
        </div>
      </section>

      <section aria-labelledby="ops-registry-heading">
        <h2 id="ops-registry-heading" className="text-card-heading text-neutral-950">
          Registry health
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Active release"
            value={summary.registryHealth.activeReleaseVersionLabel ?? "None active"}
          />
          <MetricCard
            label="Checksum"
            value={
              summary.registryHealth.checksumValid === null
                ? "Not computed"
                : summary.registryHealth.checksumValid
                  ? "Valid"
                  : "MISMATCH"
            }
          />
          <MetricCard
            label="Sources due for review"
            value={summary.registryHealth.reviewDueCount}
          />
          <MetricCard
            label="Unverified evaluation entries"
            value={summary.registryHealth.unverifiedEvaluationEntries.length}
          />
        </div>
        {(summary.registryHealth.duplicateEvaluationTokens.length > 0 ||
          !summary.registryHealth.entriesParseCleanly ||
          !summary.registryHealth.activeRulesetExists) && (
          <p className="mt-2 text-supporting text-red-700">
            {!summary.registryHealth.activeRulesetExists && "No active ruleset. "}
            {!summary.registryHealth.entriesParseCleanly &&
              "Active release entries failed to parse. "}
            {summary.registryHealth.duplicateEvaluationTokens.length > 0 &&
              `Duplicate evaluation tokens: ${summary.registryHealth.duplicateEvaluationTokens.join(", ")}.`}
          </p>
        )}
      </section>

      <section aria-labelledby="ops-scheduler-heading">
        <h2 id="ops-scheduler-heading" className="text-card-heading text-neutral-950">
          Scheduler anomalies
        </h2>
        {summary.schedulerAnomalies.length === 0 ? (
          <p className="mt-2 text-supporting text-neutral-600">None detected.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {summary.schedulerAnomalies.map((a, i) => (
              <li
                key={`${a.jobName}-${a.type}-${i}`}
                className="rounded-card border border-neutral-200 bg-white p-3 text-supporting"
              >
                <span className="font-medium text-neutral-900">
                  {a.jobName} — {a.type}:
                </span>{" "}
                {a.detail}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="ops-trends-heading">
        <h2 id="ops-trends-heading" className="text-card-heading text-neutral-950">
          Reliability trends
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-supporting">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="py-2 pr-4">Window</th>
                <th className="py-2 pr-4">Monitoring timeliness</th>
                <th className="py-2 pr-4">Job reliability</th>
                <th className="py-2 pr-4">Billing processing</th>
                <th className="py-2 pr-4">Auth failures</th>
                <th className="py-2">Alerts opened</th>
              </tr>
            </thead>
            <tbody>
              {summary.trends.map((t) => (
                <tr key={t.windowHours} className="border-b border-neutral-100">
                  <td className="py-2 pr-4 font-medium text-neutral-900">
                    {WINDOW_LABEL[t.windowHours] ?? `${t.windowHours}h`}
                  </td>
                  <td className="py-2 pr-4">{formatRatio(t.monitoringTimeliness)}</td>
                  <td className="py-2 pr-4">{formatRatio(t.jobReliability)}</td>
                  <td className="py-2 pr-4">{formatRatio(t.billingProcessingReliability)}</td>
                  <td className="py-2 pr-4">{t.authFailureCount}</td>
                  <td className="py-2">{t.alertsOpenedInWindow}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="ops-actions-heading">
        <h2 id="ops-actions-heading" className="text-card-heading text-neutral-950">
          Manual operational actions
        </h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setOpenDialog("evaluate")}>
            Re-run health evaluation
          </Button>
          <Button variant="secondary" onClick={() => setOpenDialog("reconcile")}>
            Re-run notification reconciliation
          </Button>
          <Button variant="secondary" onClick={() => setOpenDialog("retention-dry-run")}>
            Re-run retention dry-run
          </Button>
        </div>
      </section>

      <section aria-labelledby="ops-drilldown-heading">
        <h2 id="ops-drilldown-heading" className="text-card-heading text-neutral-950">
          Drill down
        </h2>
        <div className="mt-4 flex flex-wrap gap-4 text-supporting">
          <a className="text-brand-700 underline" href="/admin/jobs">
            Jobs
          </a>
          <a className="text-brand-700 underline" href="/admin/scans">
            Scans
          </a>
          <a className="text-brand-700 underline" href="/admin/webhooks">
            Webhooks
          </a>
          <a className="text-brand-700 underline" href="/admin/security">
            Security
          </a>
          <a className="text-brand-700 underline" href="/admin/incidents">
            Incidents
          </a>
          <a className="text-brand-700 underline" href="/admin/domains">
            Domains
          </a>
          <a className="text-brand-700 underline" href="/admin/audit-logs">
            Audit logs
          </a>
          <a className="text-brand-700 underline" href="/admin/health">
            Health (per-component)
          </a>
        </div>
      </section>

      <AdminActionDialog
        open={openDialog === "evaluate"}
        onOpenChange={(open) => !open && setOpenDialog(null)}
        title="Re-run health evaluation"
        description="Re-evaluates every internal operational alert condition now, instead of waiting for the next daily run."
        confirmLabel="Re-run"
        busy={busy}
        onConfirm={(reason) =>
          runAction("/api/admin/operations/evaluate", reason, "Health evaluation re-run.")
        }
      />
      <AdminActionDialog
        open={openDialog === "reconcile"}
        onOpenChange={(open) => !open && setOpenDialog(null)}
        title="Re-run notification reconciliation"
        description="Recovers any policy-change notification that should exist but doesn't, using the same bounded, idempotent logic as the daily cron."
        confirmLabel="Re-run"
        busy={busy}
        onConfirm={(reason) =>
          runAction(
            "/api/admin/operations/reconcile-notifications",
            reason,
            "Notification reconciliation re-run.",
          )
        }
      />
      <AdminActionDialog
        open={openDialog === "retention-dry-run"}
        onOpenChange={(open) => !open && setOpenDialog(null)}
        title="Re-run retention dry-run"
        description="Reports exactly what the next scheduled retention run would affect. Never deletes anything — always a dry run."
        confirmLabel="Re-run"
        busy={busy}
        onConfirm={(reason) =>
          runAction(
            "/api/admin/operations/retention-dry-run",
            reason,
            "Retention dry-run complete — see server logs / audit log for the result.",
          )
        }
      />
      {typeof openDialog === "number" && (
        <AdminActionDialog
          open
          onOpenChange={(open) => !open && setOpenDialog(null)}
          title="Acknowledge alert"
          description="Records that an operator has seen this alert. It stays active until the underlying condition is objectively no longer present."
          confirmLabel="Acknowledge"
          busy={busy}
          onConfirm={(reason) =>
            runAction(
              `/api/admin/operations/alerts/${openDialog}/acknowledge`,
              reason,
              "Alert acknowledged.",
            )
          }
        />
      )}
    </div>
  );
}
