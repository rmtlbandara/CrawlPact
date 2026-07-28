import { useEffect, useState } from "react";
import { DataTable, Select, StatusChip } from "@crawlpact/ui";
import type { DataTableColumn } from "@crawlpact/ui";
import { AdminActionDialog } from "./AdminActionDialog";

type WebhookRow = {
  id: string;
  paddleEventId: string;
  eventType: string;
  status: string;
  attempts: number;
  relatedBillingCustomerId: string | null;
  relatedSubscriptionId: string | null;
  error: string | null;
  receivedAt: string;
  occurredAt: string;
  lastRetryAt: string | null;
};

const STATUS_TONE: Record<string, "success" | "warning" | "error" | "info"> = {
  pending: "info",
  processed: "success",
  ignored: "info",
  failed: "warning",
  retrying: "warning",
  permanently_failed: "error",
};

const ELIGIBLE_FOR_RETRY = new Set(["failed", "retrying"]);

/** SRS §28.7: Paddle webhook operations dashboard + safe, idempotent retry. */
export function WebhooksManager() {
  const [rows, setRows] = useState<WebhookRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState("any");
  const [retryTarget, setRetryTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "any") params.set("status", statusFilter);
    try {
      const res = await fetch(`/api/admin/webhooks?${params.toString()}`);
      const body = (await res.json()) as {
        ok: boolean;
        data?: WebhookRow[];
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
  }, [statusFilter]);

  async function retry(reason: string) {
    if (!retryTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/webhooks/${retryTarget}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = (await res.json()) as {
        ok: boolean;
        data?: { outcome: string };
        error?: { message: string };
      };
      if (!body.ok) throw new Error(body.error?.message ?? "Retry failed");
      setBanner(`Retry outcome: ${body.data?.outcome}`);
      setRetryTarget(null);
      await load();
    } catch (err) {
      setBanner((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const columns: DataTableColumn<WebhookRow>[] = [
    { key: "eventType", header: "Event type", render: (row) => row.eventType },
    {
      key: "eventId",
      header: "Event ID",
      render: (row) => <span className="font-mono text-supporting">{row.paddleEventId}</span>,
      hideBelow: "lg",
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <StatusChip
          tone={STATUS_TONE[row.status] ?? "info"}
          label={row.status.replace(/_/g, " ")}
        />
      ),
    },
    { key: "attempts", header: "Attempts", render: (row) => row.attempts, hideBelow: "sm" },
    {
      key: "occurredAt",
      header: "Occurred",
      render: (row) => new Date(row.occurredAt).toLocaleString(),
      hideBelow: "md",
    },
    {
      key: "receivedAt",
      header: "Received",
      render: (row) => new Date(row.receivedAt).toLocaleString(),
      hideBelow: "lg",
    },
    { key: "error", header: "Error", render: (row) => row.error ?? "—", hideBelow: "md" },
    {
      key: "actions",
      header: "",
      render: (row) =>
        ELIGIBLE_FOR_RETRY.has(row.status) && (
          <button
            type="button"
            className="text-supporting font-medium text-brand-700 hover:underline"
            onClick={() => setRetryTarget(row.id)}
          >
            Retry
          </button>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {banner && <p className="text-supporting text-neutral-700">{banner}</p>}
      <div className="w-56">
        <Select
          ariaLabel="Filter webhook events by status"
          options={[
            { value: "any", label: "All statuses" },
            { value: "pending", label: "Pending" },
            { value: "processed", label: "Processed" },
            { value: "ignored", label: "Ignored" },
            { value: "failed", label: "Failed" },
            { value: "retrying", label: "Retrying" },
            { value: "permanently_failed", label: "Permanently failed" },
          ]}
          value={statusFilter}
          onValueChange={setStatusFilter}
        />
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="No webhook events recorded yet"
      />
      <AdminActionDialog
        open={retryTarget !== null}
        onOpenChange={(open) => !open && setRetryTarget(null)}
        title="Retry this webhook event"
        description="Re-runs the same idempotent processing path a live Paddle delivery takes. Safe to retry — will not double-apply an already-processed event."
        confirmLabel="Retry"
        busy={busy}
        onConfirm={retry}
      />
    </div>
  );
}
