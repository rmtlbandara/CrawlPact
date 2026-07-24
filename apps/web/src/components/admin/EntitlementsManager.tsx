import { useEffect, useState } from "react";
import { Button, DataTable, FormField, Input, Select, StatusChip } from "@crawlpact/ui";
import type { DataTableColumn } from "@crawlpact/ui";
import { AdminActionDialog } from "./AdminActionDialog";

type EntitlementRow = {
  entitlement: {
    id: string;
    grantedPlanId: string;
    reason: string;
    expiresAt: string;
    createdAt: string;
    revokedAt: string | null;
  };
  user: { id: string; displayName: string };
  grantedBy: { displayName: string | null };
};

/** SRS §28.5: temporary administrative entitlements — always expiring,
 * always reasoned, always audited, always visibly labelled as temporary. */
export function EntitlementsManager() {
  const [rows, setRows] = useState<EntitlementRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [grantOpen, setGrantOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const [userId, setUserId] = useState("");
  const [grantedPlanId, setGrantedPlanId] = useState("solo");
  const [expiresAt, setExpiresAt] = useState("");

  async function load() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/entitlements");
      const body = (await res.json()) as {
        ok: boolean;
        data?: EntitlementRow[];
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

  async function grant(reason: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/entitlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          grantedPlanId,
          expiresAt: new Date(expiresAt).toISOString(),
          reason,
        }),
      });
      const body = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) throw new Error(body.error?.message ?? "Grant failed");
      setBanner("Temporary entitlement granted.");
      setGrantOpen(false);
      setUserId("");
      setExpiresAt("");
      await load();
    } catch (err) {
      setBanner((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(reason: string) {
    if (!revokeTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/entitlements/${revokeTarget}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) throw new Error(body.error?.message ?? "Revoke failed");
      setBanner("Entitlement revoked.");
      setRevokeTarget(null);
      await load();
    } catch (err) {
      setBanner((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const columns: DataTableColumn<EntitlementRow>[] = [
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
    {
      key: "plan",
      header: "Granted plan",
      render: (row) => (
        <StatusChip tone="info" label={`Temporary: ${row.entitlement.grantedPlanId}`} />
      ),
    },
    { key: "reason", header: "Reason", render: (row) => row.entitlement.reason, hideBelow: "md" },
    {
      key: "expires",
      header: "Expires",
      render: (row) => new Date(row.entitlement.expiresAt).toLocaleString(),
    },
    {
      key: "grantedBy",
      header: "Granted by",
      render: (row) => row.grantedBy.displayName ?? "—",
      hideBelow: "lg",
    },
    {
      key: "status",
      header: "Status",
      render: (row) =>
        row.entitlement.revokedAt ? (
          <StatusChip tone="error" label="Revoked" />
        ) : new Date(row.entitlement.expiresAt).getTime() < Date.now() ? (
          <StatusChip tone="warning" label="Expired" />
        ) : (
          <StatusChip tone="success" label="Active" />
        ),
    },
    {
      key: "actions",
      header: "",
      render: (row) =>
        !row.entitlement.revokedAt && (
          <button
            type="button"
            className="text-supporting font-medium text-error hover:underline"
            onClick={() => setRevokeTarget(row.entitlement.id)}
          >
            Revoke
          </button>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {banner && <p className="text-supporting text-neutral-700">{banner}</p>}
      <Button className="self-start" onClick={() => setGrantOpen(true)}>
        Grant temporary entitlement
      </Button>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.entitlement.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="No temporary entitlements have been granted"
      />

      <AdminActionDialog
        open={grantOpen}
        onOpenChange={setGrantOpen}
        title="Grant a temporary entitlement"
        description="Always requires an expiry date and a reason. Visibly labelled as temporary and audited."
        confirmLabel="Grant entitlement"
        busy={busy}
        onConfirm={grant}
      >
        <div className="mb-4 flex flex-col gap-3">
          <FormField label="User ID">
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="usr_..."
            />
          </FormField>
          <FormField label="Plan to grant">
            <Select
              options={[
                { value: "solo", label: "Solo" },
                { value: "pro", label: "Pro" },
                { value: "agency", label: "Agency" },
              ]}
              value={grantedPlanId}
              onValueChange={setGrantedPlanId}
            />
          </FormField>
          <FormField label="Expires at">
            <Input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </FormField>
        </div>
      </AdminActionDialog>

      <AdminActionDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title="Revoke this temporary entitlement"
        description="Immediately reverts the user to whatever their own real subscription entitles them to (or free)."
        confirmLabel="Revoke"
        destructive
        busy={busy}
        onConfirm={revoke}
      />
    </div>
  );
}
