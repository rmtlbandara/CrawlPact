import { useEffect, useState } from "react";
import { DataTable } from "@crawlpact/ui";
import type { DataTableColumn } from "@crawlpact/ui";
import { AdminActionDialog } from "./AdminActionDialog";

type ConfigRow = {
  key: string;
  value: string;
  valueType: "integer" | "boolean" | "string";
  description: string;
  minValue: number | null;
  maxValue: number | null;
};

// Kept in sync with lib/admin/runtime-config.ts's HIGH_IMPACT_KEYS — defined
// locally rather than imported, since that module pulls in server-only D1/
// Drizzle dependencies that must never end up in a client bundle.
const HIGH_IMPACT_KEYS = new Set(["maintenance_mode", "scheduler_paused"]);

/** SRS §28.16: runtime configuration — only pre-existing, reviewed keys can
 * be edited, each validated against its own min/max. No secrets ever
 * appear here (they live in Worker environment bindings). */
export function RuntimeConfigManager() {
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [editTarget, setEditTarget] = useState<ConfigRow | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/settings");
      const body = (await res.json()) as {
        ok: boolean;
        data?: ConfigRow[];
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

  async function save(reason: string) {
    if (!editTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/settings/${editTarget.key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value, reason }),
      });
      const body = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setBanner(`${editTarget.key} updated.`);
      setEditTarget(null);
      await load();
    } catch (err) {
      setBanner((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const columns: DataTableColumn<ConfigRow>[] = [
    {
      key: "key",
      header: "Setting",
      render: (r) => <span className="font-mono text-supporting">{r.key}</span>,
    },
    { key: "value", header: "Value", render: (r) => r.value },
    {
      key: "range",
      header: "Allowed range",
      render: (r) =>
        r.minValue !== null
          ? `${r.minValue}–${r.maxValue}`
          : r.valueType === "boolean"
            ? "true / false"
            : "—",
      hideBelow: "md",
    },
    { key: "description", header: "Description", render: (r) => r.description, hideBelow: "lg" },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <button
          type="button"
          className="text-supporting font-medium text-brand-700 hover:underline"
          onClick={() => {
            setEditTarget(r);
            setValue(r.value);
          }}
        >
          Edit
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
        getRowKey={(r) => r.key}
        isLoading={isLoading}
        error={error}
        emptyTitle="No runtime settings found"
      />

      <AdminActionDialog
        open={editTarget !== null}
        onOpenChange={(open) => !open && setEditTarget(null)}
        title={editTarget ? `Edit ${editTarget.key}` : "Edit setting"}
        description={
          editTarget && HIGH_IMPACT_KEYS.has(editTarget.key)
            ? "This is a high-impact setting that affects every customer immediately. Double-check the value before confirming."
            : (editTarget?.description ?? "")
        }
        confirmLabel="Save"
        destructive={editTarget ? HIGH_IMPACT_KEYS.has(editTarget.key) : false}
        busy={busy}
        onConfirm={save}
      >
        {editTarget && (
          <div className="mb-4">
            <label className="mb-1.5 block text-supporting font-medium text-neutral-800">
              Value{" "}
              {editTarget.minValue !== null && `(${editTarget.minValue}–${editTarget.maxValue})`}
            </label>
            <input
              className="h-11 w-full rounded-control border border-neutral-300 bg-white px-3 text-body text-neutral-950"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
        )}
      </AdminActionDialog>
    </div>
  );
}
