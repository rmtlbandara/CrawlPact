import { useEffect, useState } from "react";
import { MetricCard, StatusChip } from "@crawlpact/ui";

type Summary = {
  started: number;
  completed: number;
  failed: number;
  pending: number;
  retrying: number;
  pendingRetryingNote: string;
  pausedDomains: number;
  averageDurationMs: number | null;
  averageExternalRequests: number | null;
  failureCategories: { category: string | null; count: number }[];
};

type HighFailureHost = { canonicalOrigin: string; failures: number };

/** SRS §28.9: scan operations dashboard, using only real, tracked data (see
 * lib/admin/scans.ts for the disclosed gap against the SRS's fuller
 * error-class wishlist — no fabricated TLS/HTTP-status/parser categories). */
export function ScanOperationsDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [hosts, setHosts] = useState<HighFailureHost[]>([]);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    fetch("/api/admin/scans?range=30d")
      .then(
        (res) =>
          res.json() as Promise<{
            ok: boolean;
            data?: { summary: Summary; highFailureHosts: HighFailureHost[] };
            error?: { message: string };
          }>,
      )
      .then((body) => {
        if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
        setSummary(body.data!.summary);
        setHosts(body.data!.highFailureHosts);
      })
      .catch((err) => setError((err as Error).message));
  }, []);

  if (error) return <p className="text-supporting text-error">{error}</p>;
  if (!summary) return <p className="text-supporting text-neutral-600">Loading…</p>;

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <MetricCard label="Started (30d)" value={summary.started} />
        <MetricCard label="Completed" value={summary.completed} />
        <MetricCard label="Failed" value={summary.failed} />
        <MetricCard label="Paused domains" value={summary.pausedDomains} />
        <MetricCard
          label="Average duration"
          value={
            summary.averageDurationMs !== null
              ? `${Math.round(summary.averageDurationMs / 1000)}s`
              : "—"
          }
        />
        <MetricCard
          label="Avg. requests/scan"
          value={
            summary.averageExternalRequests !== null
              ? summary.averageExternalRequests.toFixed(1)
              : "—"
          }
        />
        <MetricCard
          label="Pending"
          value={summary.pending}
          helpText={summary.pendingRetryingNote}
        />
        <MetricCard
          label="Retrying"
          value={summary.retrying}
          helpText={summary.pendingRetryingNote}
        />
      </div>

      <section>
        <h2 className="text-h3 text-neutral-950">Failure categories (30d)</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {summary.failureCategories.length === 0 && (
            <p className="text-supporting text-neutral-600">No failures recorded in this range.</p>
          )}
          {summary.failureCategories.map((c) => (
            <StatusChip
              key={c.category}
              tone="warning"
              label={`${c.category ?? "unknown"}: ${c.count}`}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-h3 text-neutral-950">High-failure hosts</h2>
        <ul className="mt-3 divide-y divide-neutral-200 rounded-card border border-neutral-200 bg-white">
          {hosts.length === 0 && <li className="p-4 text-supporting text-neutral-600">None.</li>}
          {hosts.map((h) => (
            <li
              key={h.canonicalOrigin}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <span className="text-body text-neutral-800">{h.canonicalOrigin}</span>
              <StatusChip tone="error" label={`${h.failures} failures`} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
