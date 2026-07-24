import { useEffect, useState } from "react";
import { DataTable, StatusChip, Select } from "@crawlpact/ui";
import type { DataTableColumn } from "@crawlpact/ui";
import { AdminActionDialog } from "./AdminActionDialog";

type SubscriptionRow = {
  subscription: {
    id: string;
    paddleSubscriptionId: string;
    planId: string;
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    syncError: string | null;
  };
  billingCustomer: { paddleCustomerId: string };
  user: { id: string; displayName: string; planId: string };
  entitlementMismatch: boolean;
};

const STATUS_TONE: Record<string, "success" | "warning" | "error" | "info"> = {
  active: "success",
  trialing: "info",
  past_due: "warning",
  paused: "warning",
  cancelled: "error",
  expired: "error",
};

/** SRS §28.5: subscriptions view with filters and a real Paddle-resync action. */
export function SubscriptionsManager() {
  const [rows, setRows] = useState<SubscriptionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [filter, setFilter] = useState("any");
  const [resyncTarget, setResyncTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (filter === "mismatch") params.set("mismatch", "true");
    if (filter === "syncError") params.set("syncError", "true");
    if (filter === "pastDue") params.set("pastDue", "true");
    if (filter === "cancelling") params.set("cancelling", "true");
    try {
      const res = await fetch(`/api/admin/subscriptions?${params.toString()}`);
      const body = (await res.json()) as {
        ok: boolean;
        data?: SubscriptionRow[];
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
  }, [filter]);

  async function resync(reason: string) {
    if (!resyncTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/subscriptions/${resyncTarget}/resync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) throw new Error(body.error?.message ?? "Resync failed");
      setBanner("Resynchronised with Paddle.");
      setResyncTarget(null);
      await load();
    } catch (err) {
      setBanner((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const columns: DataTableColumn<SubscriptionRow>[] = [
    {
      key: "user",
      header: "User",
      render: (row) => (
        <a
          href={`/admin/users/${row.user.id}`}
          className="font-medium text-brand-700 hover:underline"
        >
          {row.user.displayName}
        </a>
      ),
    },
    { key: "plan", header: "Plan", render: (row) => row.subscription.planId },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <StatusChip
          tone={STATUS_TONE[row.subscription.status] ?? "info"}
          label={row.subscription.status}
        />
      ),
    },
    {
      key: "renewal",
      header: "Renews / ends",
      render: (row) =>
        row.subscription.currentPeriodEnd
          ? new Date(row.subscription.currentPeriodEnd).toLocaleDateString()
          : "—",
      hideBelow: "sm",
    },
    {
      key: "cancelling",
      header: "Cancelling",
      render: (row) => (row.subscription.cancelAtPeriodEnd ? "Yes" : "No"),
      hideBelow: "md",
    },
    {
      key: "flags",
      header: "Flags",
      render: (row) => (
        <div className="flex gap-1.5">
          {row.entitlementMismatch && <StatusChip tone="error" label="Entitlement mismatch" />}
          {row.subscription.syncError && <StatusChip tone="warning" label="Sync error" />}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <button
          type="button"
          className="text-supporting font-medium text-brand-700 hover:underline"
          onClick={() => setResyncTarget(row.subscription.id)}
        >
          Resync
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {banner && <p className="text-supporting text-neutral-700">{banner}</p>}
      <div className="w-64">
        <Select
          options={[
            { value: "any", label: "All subscriptions" },
            { value: "mismatch", label: "Entitlement mismatch" },
            { value: "syncError", label: "Sync errors" },
            { value: "pastDue", label: "Past due" },
            { value: "cancelling", label: "Cancelling" },
          ]}
          value={filter}
          onValueChange={setFilter}
        />
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.subscription.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="No subscriptions match this filter"
      />
      <AdminActionDialog
        open={resyncTarget !== null}
        onOpenChange={(open) => !open && setResyncTarget(null)}
        title="Resynchronise with Paddle"
        description="Refetches this subscription's live state directly from Paddle and reconciles the local cache."
        confirmLabel="Resynchronise"
        busy={busy}
        onConfirm={resync}
      />
    </div>
  );
}
