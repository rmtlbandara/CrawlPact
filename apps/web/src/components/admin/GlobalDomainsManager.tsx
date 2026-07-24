import { useEffect, useState } from "react";
import { DataTable, SearchField, Select, StatusChip } from "@crawlpact/ui";
import type { DataTableColumn } from "@crawlpact/ui";
import { AdminActionDialog } from "./AdminActionDialog";

type DomainRow = {
  domain: {
    id: string;
    canonicalOrigin: string;
    displayName: string;
    preset: string;
    monitoringState: "active" | "paused";
    lastScanAt: string | null;
    nextScanAt: string | null;
    currentScore: number | null;
    consecutiveFailureCount: number;
  };
  owner: { id: string; displayName: string; planId: string };
  criticalFindingsCount: number;
};

/** SRS §28.8: global domain table + administrative actions across every customer. */
export function GlobalDomainsManager() {
  const [rows, setRows] = useState<DomainRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [query, setQuery] = useState("");
  const [monitoringFilter, setMonitoringFilter] = useState("any");
  const [scanTarget, setScanTarget] = useState<string | null>(null);
  const [monitoringTarget, setMonitoringTarget] = useState<{
    id: string;
    state: "active" | "paused";
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (monitoringFilter !== "any") params.set("monitoringState", monitoringFilter);
    try {
      const res = await fetch(`/api/admin/domains?${params.toString()}`);
      const body = (await res.json()) as {
        ok: boolean;
        data?: DomainRow[];
        error?: { message: string };
      };
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setRows(body.data ?? []);
      setError(undefined);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [query, monitoringFilter]);

  async function runScan(reason: string) {
    if (!scanTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/domains/${scanTarget}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = (await res.json()) as {
        ok: boolean;
        data?: { status: string };
        error?: { message: string };
      };
      if (!body.ok) throw new Error(body.error?.message ?? "Scan failed");
      setBanner(`Administrative scan finished: ${body.data?.status}`);
      setScanTarget(null);
      await load();
    } catch (err) {
      setBanner((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleMonitoring(reason: string) {
    if (!monitoringTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/domains/${monitoringTarget.id}/monitoring`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: monitoringTarget.state, reason }),
      });
      const body = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setBanner(`Monitoring ${monitoringTarget.state === "paused" ? "paused" : "resumed"}.`);
      setMonitoringTarget(null);
      await load();
    } catch (err) {
      setBanner((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const columns: DataTableColumn<DomainRow>[] = [
    {
      key: "domain",
      header: "Domain",
      render: (row) => (
        <span className="font-medium text-neutral-900">{row.domain.canonicalOrigin}</span>
      ),
    },
    {
      key: "owner",
      header: "Owner",
      render: (row) => (
        <a href={`/admin/users/${row.owner.id}`} className="text-brand-700 hover:underline">
          {row.owner.displayName}
        </a>
      ),
    },
    { key: "plan", header: "Plan", render: (row) => row.owner.planId, hideBelow: "sm" },
    { key: "preset", header: "Preset", render: (row) => row.domain.preset, hideBelow: "lg" },
    {
      key: "monitoring",
      header: "Monitoring",
      render: (row) => (
        <StatusChip
          tone={row.domain.monitoringState === "active" ? "success" : "warning"}
          label={row.domain.monitoringState}
        />
      ),
    },
    {
      key: "score",
      header: "Score",
      render: (row) => row.domain.currentScore ?? "—",
    },
    {
      key: "critical",
      header: "Critical findings",
      render: (row) =>
        row.criticalFindingsCount > 0 ? (
          <StatusChip tone="error" label={String(row.criticalFindingsCount)} />
        ) : (
          "0"
        ),
      hideBelow: "md",
    },
    {
      key: "failures",
      header: "Failures",
      render: (row) => row.domain.consecutiveFailureCount,
      hideBelow: "lg",
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex gap-3">
          <button
            type="button"
            className="text-supporting font-medium text-brand-700 hover:underline"
            onClick={() => setScanTarget(row.domain.id)}
          >
            Scan
          </button>
          <button
            type="button"
            className="text-supporting font-medium text-brand-700 hover:underline"
            onClick={() =>
              setMonitoringTarget({
                id: row.domain.id,
                state: row.domain.monitoringState === "active" ? "paused" : "active",
              })
            }
          >
            {row.domain.monitoringState === "active" ? "Pause" : "Resume"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {banner && <p className="text-supporting text-neutral-700">{banner}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <div className="max-w-md flex-1">
          <SearchField
            label="Search domains"
            placeholder="Search by domain or owner name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="w-48">
          <Select
            options={[
              { value: "any", label: "Any monitoring state" },
              { value: "active", label: "Active" },
              { value: "paused", label: "Paused" },
            ]}
            value={monitoringFilter}
            onValueChange={setMonitoringFilter}
          />
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.domain.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="No domains match this search"
      />
      <AdminActionDialog
        open={scanTarget !== null}
        onOpenChange={(open) => !open && setScanTarget(null)}
        title="Trigger an administrative scan"
        description="Runs a real scan immediately. Does not consume the owner's manual re-scan quota."
        confirmLabel="Run scan"
        busy={busy}
        onConfirm={runScan}
      />
      <AdminActionDialog
        open={monitoringTarget !== null}
        onOpenChange={(open) => !open && setMonitoringTarget(null)}
        title={monitoringTarget?.state === "paused" ? "Pause monitoring" : "Resume monitoring"}
        description="Applies to this domain only."
        confirmLabel={monitoringTarget?.state === "paused" ? "Pause" : "Resume"}
        busy={busy}
        onConfirm={toggleMonitoring}
      />
    </div>
  );
}
