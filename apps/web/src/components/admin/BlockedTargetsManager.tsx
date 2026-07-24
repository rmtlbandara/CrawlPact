import { useEffect, useState } from "react";
import { Button, DataTable, FormField, Input, StatusChip } from "@crawlpact/ui";
import type { DataTableColumn } from "@crawlpact/ui";
import { AdminActionDialog } from "./AdminActionDialog";

type BlockedTargetRow = {
  target: {
    id: string;
    targetPattern: string;
    reason: string;
    createdAt: string;
    removedAt: string | null;
  };
  blockedBy: { displayName: string | null };
};

/** SRS §28.8/§28.14: target blocklist management. */
export function BlockedTargetsManager() {
  const [rows, setRows] = useState<BlockedTargetRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [addOpen, setAddOpen] = useState(false);
  const [unblockTarget, setUnblockTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [pattern, setPattern] = useState("");

  async function load() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/blocked-targets");
      const body = (await res.json()) as {
        ok: boolean;
        data?: BlockedTargetRow[];
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
  }, []);

  async function block(reason: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/blocked-targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPattern: pattern, reason }),
      });
      const body = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setBanner("Target blocked.");
      setAddOpen(false);
      setPattern("");
      await load();
    } catch (err) {
      setBanner((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function unblock(reason: string) {
    if (!unblockTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/blocked-targets/${unblockTarget}/unblock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setBanner("Target unblocked.");
      setUnblockTarget(null);
      await load();
    } catch (err) {
      setBanner((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const columns: DataTableColumn<BlockedTargetRow>[] = [
    {
      key: "pattern",
      header: "Target pattern",
      render: (row) => <span className="font-mono">{row.target.targetPattern}</span>,
    },
    { key: "reason", header: "Reason", render: (row) => row.target.reason },
    {
      key: "blockedBy",
      header: "Blocked by",
      render: (row) => row.blockedBy.displayName ?? "—",
      hideBelow: "md",
    },
    {
      key: "status",
      header: "Status",
      render: (row) =>
        row.target.removedAt ? (
          <StatusChip tone="info" label="Removed" />
        ) : (
          <StatusChip tone="error" label="Blocked" />
        ),
    },
    {
      key: "actions",
      header: "",
      render: (row) =>
        !row.target.removedAt && (
          <button
            type="button"
            className="text-supporting font-medium text-brand-700 hover:underline"
            onClick={() => setUnblockTarget(row.target.id)}
          >
            Unblock
          </button>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {banner && <p className="text-supporting text-neutral-700">{banner}</p>}
      <Button className="self-start" onClick={() => setAddOpen(true)}>
        Block a target
      </Button>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.target.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="No targets are blocked"
      />

      <AdminActionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Block a target"
        description="Enforced on every scan path — anonymous audits, manual re-scans, and scheduled monitoring."
        confirmLabel="Block"
        destructive
        busy={busy}
        onConfirm={block}
      >
        <div className="mb-4">
          <FormField
            label="Target pattern"
            description="A hostname or URL substring to reject before any fetch."
          >
            <Input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="example.com"
            />
          </FormField>
        </div>
      </AdminActionDialog>

      <AdminActionDialog
        open={unblockTarget !== null}
        onOpenChange={(open) => !open && setUnblockTarget(null)}
        title="Unblock this target"
        description="Future scans against this pattern will be allowed again."
        confirmLabel="Unblock"
        busy={busy}
        onConfirm={unblock}
      />
    </div>
  );
}
