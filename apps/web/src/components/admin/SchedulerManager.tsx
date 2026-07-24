import { useEffect, useState } from "react";
import { Button, DataTable, StatusChip } from "@crawlpact/ui";
import type { DataTableColumn } from "@crawlpact/ui";
import { AdminActionDialog } from "./AdminActionDialog";

type JobRun = {
  id: number;
  jobName: string;
  status: "running" | "completed" | "failed";
  domainsSelected: number;
  scansCreated: number;
  scansCompleted: number;
  scansFailed: number;
  errorSummary: string | null;
  startedAt: string;
  completedAt: string | null;
};

type Anomaly = { type: string; jobName: string; detail: string };

/** SRS §28.10: scheduled-job history, anomaly detection, and a global
 * scheduler pause/resume for incident response. */
export function SchedulerManager() {
  const [runs, setRuns] = useState<JobRun[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [paused, setPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/jobs");
      const body = (await res.json()) as {
        ok: boolean;
        data?: { runs: JobRun[]; anomalies: Anomaly[]; paused: boolean };
        error?: { message: string };
      };
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setRuns(body.data!.runs);
      setAnomalies(body.data!.anomalies);
      setPaused(body.data!.paused);
      setError(undefined);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function togglePause(reason: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/jobs/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: !paused, reason }),
      });
      const body = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setBanner(!paused ? "Scheduled monitoring paused." : "Scheduled monitoring resumed.");
      setDialogOpen(false);
      await load();
    } catch (err) {
      setBanner((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const columns: DataTableColumn<JobRun>[] = [
    { key: "jobName", header: "Job", render: (r) => r.jobName },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <StatusChip
          tone={r.status === "failed" ? "error" : r.status === "running" ? "info" : "success"}
          label={r.status}
        />
      ),
    },
    {
      key: "domainsSelected",
      header: "Domains",
      render: (r) => r.domainsSelected,
      hideBelow: "sm",
    },
    {
      key: "scansCompleted",
      header: "Completed",
      render: (r) => r.scansCompleted,
      hideBelow: "sm",
    },
    { key: "scansFailed", header: "Failed", render: (r) => r.scansFailed, hideBelow: "sm" },
    { key: "started", header: "Started", render: (r) => new Date(r.startedAt).toLocaleString() },
    { key: "error", header: "Error", render: (r) => r.errorSummary ?? "—", hideBelow: "lg" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {banner && <p className="text-supporting text-neutral-700">{banner}</p>}

      <div className="flex items-center gap-3">
        <StatusChip
          tone={paused ? "warning" : "success"}
          label={paused ? "Scheduler paused" : "Scheduler active"}
        />
        <Button variant={paused ? "primary" : "destructive"} onClick={() => setDialogOpen(true)}>
          {paused ? "Resume scheduled monitoring" : "Pause scheduled monitoring"}
        </Button>
      </div>

      {anomalies.length > 0 && (
        <section>
          <h2 className="text-h3 text-neutral-950">Detected anomalies</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {anomalies.map((a, i) => (
              <li
                key={i}
                className="rounded-card border border-warning bg-warning-bg p-3 text-supporting text-warning"
              >
                <strong>{a.jobName}</strong> — {a.type.replace(/_/g, " ")}: {a.detail}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-h3 text-neutral-950">Recent job runs</h2>
        <div className="mt-3">
          <DataTable
            columns={columns}
            rows={runs}
            getRowKey={(r) => String(r.id)}
            isLoading={isLoading}
            error={error}
            emptyTitle="No scheduled jobs have run yet"
          />
        </div>
      </section>

      <AdminActionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={paused ? "Resume scheduled monitoring" : "Pause scheduled monitoring globally"}
        description="Only the monitoring sweep is affected. Paddle webhooks and the public website remain fully operational."
        confirmLabel={paused ? "Resume" : "Pause"}
        destructive={!paused}
        busy={busy}
        onConfirm={togglePause}
      />
    </div>
  );
}
