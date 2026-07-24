import { useEffect, useState } from "react";
import { Button, DataTable, FormField, Input, Select, StatusChip, Textarea } from "@crawlpact/ui";
import type { DataTableColumn } from "@crawlpact/ui";
import { AdminActionDialog } from "./AdminActionDialog";

type NoticeRow = {
  id: string;
  title: string;
  body: string;
  severity: "information" | "warning" | "critical";
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
};

const SEVERITY_TONE = { information: "info", warning: "warning", critical: "error" } as const;

/** SRS §28.15: system notices — short, structured operational messages.
 * Deliberately not a CMS; long-form content stays repository-managed. */
export function NoticesManager() {
  const [rows, setRows] = useState<NoticeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [createOpen, setCreateOpen] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<{ id: string; publish: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState("information");

  async function load() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/notices");
      const body = (await res.json()) as {
        ok: boolean;
        data?: NoticeRow[];
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
      const res = await fetch("/api/admin/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, severity, reason }),
      });
      const responseBody = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!responseBody.ok) throw new Error(responseBody.error?.message ?? "Request failed");
      setBanner("Notice created (unpublished).");
      setCreateOpen(false);
      setTitle("");
      setBody("");
      await load();
    } catch (err) {
      setBanner((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function togglePublish(reason: string) {
    if (!toggleTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/notices/${toggleTarget.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: toggleTarget.publish, reason }),
      });
      const responseBody = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!responseBody.ok) throw new Error(responseBody.error?.message ?? "Request failed");
      setBanner(toggleTarget.publish ? "Notice published." : "Notice unpublished.");
      setToggleTarget(null);
      await load();
    } catch (err) {
      setBanner((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const columns: DataTableColumn<NoticeRow>[] = [
    { key: "title", header: "Title", render: (r) => r.title },
    {
      key: "severity",
      header: "Severity",
      render: (r) => <StatusChip tone={SEVERITY_TONE[r.severity]} label={r.severity} />,
    },
    {
      key: "status",
      header: "Status",
      render: (r) =>
        r.isPublished ? (
          <StatusChip tone="success" label="Published" />
        ) : (
          <StatusChip tone="info" label="Draft" />
        ),
    },
    {
      key: "created",
      header: "Created",
      render: (r) => new Date(r.createdAt).toLocaleDateString(),
      hideBelow: "md",
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <button
          type="button"
          className="text-supporting font-medium text-brand-700 hover:underline"
          onClick={() => setToggleTarget({ id: r.id, publish: !r.isPublished })}
        >
          {r.isPublished ? "Unpublish" : "Publish"}
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {banner && <p className="text-supporting text-neutral-700">{banner}</p>}
      <Button className="self-start" onClick={() => setCreateOpen(true)}>
        Create notice
      </Button>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="No system notices yet"
      />

      <AdminActionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create a system notice"
        description="Starts as a draft — publish it separately once ready."
        confirmLabel="Create"
        busy={busy}
        onConfirm={create}
      >
        <div className="mb-4 flex flex-col gap-3">
          <FormField label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormField>
          <FormField label="Body">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
          </FormField>
          <FormField label="Severity">
            <Select
              options={[
                { value: "information", label: "Information" },
                { value: "warning", label: "Warning" },
                { value: "critical", label: "Critical" },
              ]}
              value={severity}
              onValueChange={setSeverity}
            />
          </FormField>
        </div>
      </AdminActionDialog>

      <AdminActionDialog
        open={toggleTarget !== null}
        onOpenChange={(open) => !open && setToggleTarget(null)}
        title={toggleTarget?.publish ? "Publish this notice" : "Unpublish this notice"}
        description="Controls whether this notice is currently visible to customers."
        confirmLabel={toggleTarget?.publish ? "Publish" : "Unpublish"}
        busy={busy}
        onConfirm={togglePublish}
      />
    </div>
  );
}
