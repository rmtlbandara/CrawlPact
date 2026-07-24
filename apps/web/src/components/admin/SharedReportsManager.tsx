import { useEffect, useState } from "react";
import { DataTable, StatusChip } from "@crawlpact/ui";
import type { DataTableColumn } from "@crawlpact/ui";
import { AdminActionDialog } from "./AdminActionDialog";

type ShareRow = {
  share: {
    id: string;
    scanId: string;
    expiresAt: string | null;
    createdAt: string;
    revokedAt: string | null;
  };
  owner: { id: string; displayName: string };
};

/** SRS §28.9: every shared report link across every customer. */
export function SharedReportsManager() {
  const [rows, setRows] = useState<ShareRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/shared-reports");
      const body = (await res.json()) as {
        ok: boolean;
        data?: ShareRow[];
        error?: { message: string };
      };
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setRows(body.data ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function revoke(reason: string) {
    if (!revokeTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/shared-reports/${revokeTarget}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setBanner("Share revoked.");
      setRevokeTarget(null);
      await load();
    } catch (err) {
      setBanner((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const columns: DataTableColumn<ShareRow>[] = [
    {
      key: "owner",
      header: "Owner",
      render: (r) => (
        <a href={`/admin/users/${r.owner.id}`} className="text-brand-700 hover:underline">
          {r.owner.displayName}
        </a>
      ),
    },
    {
      key: "scanId",
      header: "Scan",
      render: (r) => <span className="font-mono text-supporting">{r.share.scanId}</span>,
      hideBelow: "md",
    },
    {
      key: "expires",
      header: "Expires",
      render: (r) =>
        r.share.expiresAt ? new Date(r.share.expiresAt).toLocaleDateString() : "Never",
      hideBelow: "sm",
    },
    {
      key: "created",
      header: "Created",
      render: (r) => new Date(r.share.createdAt).toLocaleDateString(),
      hideBelow: "lg",
    },
    {
      key: "status",
      header: "Status",
      render: (r) =>
        r.share.revokedAt ? (
          <StatusChip tone="error" label="Revoked" />
        ) : (
          <StatusChip tone="success" label="Active" />
        ),
    },
    {
      key: "actions",
      header: "",
      render: (r) =>
        !r.share.revokedAt && (
          <button
            type="button"
            className="text-supporting font-medium text-error hover:underline"
            onClick={() => setRevokeTarget(r.share.id)}
          >
            Revoke
          </button>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {banner && <p className="text-supporting text-neutral-700">{banner}</p>}
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.share.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="No shared reports exist"
      />
      <AdminActionDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title="Revoke this shared report"
        description="The public link immediately stops working. This does not affect the underlying scan."
        confirmLabel="Revoke"
        destructive
        busy={busy}
        onConfirm={revoke}
      />
    </div>
  );
}
