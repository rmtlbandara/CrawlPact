import { useEffect, useState } from "react";
import { Button, DataTable, FormField, Input, StatusChip } from "@crawlpact/ui";
import type { DataTableColumn } from "@crawlpact/ui";
import { AdminActionDialog } from "./AdminActionDialog";

type RulesetRow = {
  id: string;
  versionLabel: string;
  description: string;
  isActive: boolean;
  createdAt: string;
};

/** SRS §28.12: ruleset version management with the same discipline as registry releases. */
export function RulesetsManager() {
  const [rows, setRows] = useState<RulesetRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [createOpen, setCreateOpen] = useState(false);
  const [publishTarget, setPublishTarget] = useState<string | null>(null);
  const [rollbackTarget, setRollbackTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [versionLabel, setVersionLabel] = useState("");

  async function load() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/registry/rulesets");
      const body = (await res.json()) as {
        ok: boolean;
        data?: RulesetRow[];
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
      const res = await fetch("/api/admin/registry/rulesets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionLabel, description: reason }),
      });
      const body = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setBanner("Ruleset version registered.");
      setCreateOpen(false);
      setVersionLabel("");
      await load();
    } catch (err) {
      setBanner((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function publish(reason: string) {
    if (!publishTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/registry/rulesets/${publishTarget}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setBanner("Published.");
      setPublishTarget(null);
      await load();
    } catch (err) {
      setBanner((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function rollback(reason: string) {
    if (!rollbackTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/registry/rulesets/${rollbackTarget}/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setBanner("Rolled back.");
      setRollbackTarget(null);
      await load();
    } catch (err) {
      setBanner((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const columns: DataTableColumn<RulesetRow>[] = [
    { key: "label", header: "Version", render: (r) => r.versionLabel },
    {
      key: "status",
      header: "Status",
      render: (r) =>
        r.isActive ? (
          <StatusChip tone="success" label="Active" />
        ) : (
          <StatusChip tone="info" label="Not active" />
        ),
    },
    { key: "description", header: "Description", render: (r) => r.description, hideBelow: "md" },
    {
      key: "actions",
      header: "",
      render: (r) =>
        !r.isActive && (
          <div className="flex gap-3">
            <button
              type="button"
              className="text-supporting font-medium text-brand-700 hover:underline"
              onClick={() => setPublishTarget(r.id)}
            >
              Publish
            </button>
            <button
              type="button"
              className="text-supporting font-medium text-brand-700 hover:underline"
              onClick={() => setRollbackTarget(r.id)}
            >
              Roll back to this
            </button>
          </div>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {banner && <p className="text-supporting text-neutral-700">{banner}</p>}
      <Button className="self-start" onClick={() => setCreateOpen(true)}>
        Register a new ruleset version
      </Button>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="No ruleset versions yet"
      />

      <AdminActionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Register a ruleset version"
        description="Documents a change to findings/scoring logic. The reason below is this version's description."
        confirmLabel="Register"
        busy={busy}
        onConfirm={create}
      >
        <div className="mb-4">
          <FormField label="Version label">
            <Input
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
              placeholder="2026.08.1"
            />
          </FormField>
        </div>
      </AdminActionDialog>

      <AdminActionDialog
        open={publishTarget !== null}
        onOpenChange={(open) => !open && setPublishTarget(null)}
        title="Publish this ruleset version"
        description="Historical findings keep the ruleset version they were created under."
        confirmLabel="Publish"
        busy={busy}
        onConfirm={publish}
      />

      <AdminActionDialog
        open={rollbackTarget !== null}
        onOpenChange={(open) => !open && setRollbackTarget(null)}
        title="Roll back to this ruleset version"
        description="Repoints the active ruleset. No version is deleted."
        confirmLabel="Roll back"
        destructive
        busy={busy}
        onConfirm={rollback}
      />
    </div>
  );
}
