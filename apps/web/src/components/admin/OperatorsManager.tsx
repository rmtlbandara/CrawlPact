import { useEffect, useState } from "react";
import { Button, DataTable, FormField, Input } from "@crawlpact/ui";
import type { DataTableColumn } from "@crawlpact/ui";
import { AdminActionDialog } from "./AdminActionDialog";

type OperatorRow = { id: string; name: string; websiteUrl: string | null; createdAt: string };

/** SRS §28.11: crawler operator CRUD. */
export function OperatorsManager() {
  const [rows, setRows] = useState<OperatorRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  async function load() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/registry/operators");
      const body = (await res.json()) as {
        ok: boolean;
        data?: OperatorRow[];
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

  async function create(reason: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/registry/operators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, websiteUrl: websiteUrl || undefined, reason }),
      });
      const body = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setOpen(false);
      setName("");
      setWebsiteUrl("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const columns: DataTableColumn<OperatorRow>[] = [
    { key: "name", header: "Operator", render: (r) => r.name },
    { key: "website", header: "Website", render: (r) => r.websiteUrl ?? "—" },
    { key: "created", header: "Added", render: (r) => new Date(r.createdAt).toLocaleDateString() },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Button className="self-start" onClick={() => setOpen(true)}>
        Add operator
      </Button>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="No operators yet"
      />
      <AdminActionDialog
        open={open}
        onOpenChange={setOpen}
        title="Add a crawler operator"
        description="A company or organisation that publishes one or more crawlers."
        confirmLabel="Add operator"
        busy={busy}
        onConfirm={create}
      >
        <div className="mb-4 flex flex-col gap-3">
          <FormField label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label="Website (optional)">
            <Input
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://..."
            />
          </FormField>
        </div>
      </AdminActionDialog>
    </div>
  );
}
