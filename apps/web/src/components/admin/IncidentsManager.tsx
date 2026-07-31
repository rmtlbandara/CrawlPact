import { useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  DataTable,
  FormField,
  Input,
  Select,
  StatusChip,
  Switch,
  Textarea,
} from "@crawlpact/ui";
import type { DataTableColumn } from "@crawlpact/ui";
import { AdminActionDialog } from "./AdminActionDialog";
import { STATUS_COMPONENTS, statusComponentLabel } from "../../lib/status/components";

type IncidentRow = {
  id: string;
  title: string;
  publicSummary: string;
  severity: "minor" | "major" | "critical";
  status: "investigating" | "identified" | "monitoring" | "resolved";
  affectedComponents: string[];
  isScheduledMaintenance: boolean;
  isPublic: boolean;
  startsAt: string;
  resolvedAt: string | null;
  createdAt: string;
};

const SEVERITY_TONE = { minor: "info", major: "warning", critical: "error" } as const;
const STATUS_TONE = {
  investigating: "warning",
  identified: "warning",
  monitoring: "info",
  resolved: "success",
} as const;

const STATUS_OPTIONS = [
  { value: "investigating", label: "Investigating" },
  { value: "identified", label: "Identified" },
  { value: "monitoring", label: "Monitoring" },
  { value: "resolved", label: "Resolved" },
];

/** Super Admin incident management — see
 * docs/architecture/INCIDENT_TRACKING_SYSTEM_DESIGN.md. */
export function IncidentsManager() {
  const [rows, setRows] = useState<IncidentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [createOpen, setCreateOpen] = useState(false);
  const [updateTarget, setUpdateTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [publicSummary, setPublicSummary] = useState("");
  const [severity, setSeverity] = useState<"minor" | "major" | "critical">("minor");
  const [affectedComponents, setAffectedComponents] = useState<string[]>([]);
  const [isScheduledMaintenance, setIsScheduledMaintenance] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [startsAt, setStartsAt] = useState("");
  const [initialStatus, setInitialStatus] = useState<IncidentRow["status"]>("investigating");
  const [initialMessage, setInitialMessage] = useState("");

  const [updateStatus, setUpdateStatus] = useState<IncidentRow["status"]>("investigating");
  const [updateMessage, setUpdateMessage] = useState("");

  async function load() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/incidents");
      const body = (await res.json()) as {
        ok: boolean;
        data?: IncidentRow[];
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

  function toggleComponent(key: string) {
    setAffectedComponents((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  async function create(reason: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          publicSummary,
          severity,
          affectedComponents,
          isScheduledMaintenance,
          isPublic,
          startsAt: startsAt || new Date().toISOString(),
          initialStatus,
          initialMessage,
          reason,
        }),
      });
      const responseBody = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!responseBody.ok) throw new Error(responseBody.error?.message ?? "Request failed");
      setBanner("Incident created.");
      setCreateOpen(false);
      setTitle("");
      setPublicSummary("");
      setAffectedComponents([]);
      setInitialMessage("");
      await load();
    } catch (err) {
      setBanner((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function postUpdate(reason: string) {
    if (!updateTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/incidents/${updateTarget}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: updateStatus, message: updateMessage, reason }),
      });
      const responseBody = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!responseBody.ok) throw new Error(responseBody.error?.message ?? "Request failed");
      setBanner("Update posted.");
      setUpdateTarget(null);
      setUpdateMessage("");
      await load();
    } catch (err) {
      setBanner((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const columns: DataTableColumn<IncidentRow>[] = [
    { key: "title", header: "Title", render: (r) => r.title },
    {
      key: "severity",
      header: "Severity",
      render: (r) =>
        r.isScheduledMaintenance ? (
          <StatusChip tone="info" label="Maintenance" />
        ) : (
          <StatusChip tone={SEVERITY_TONE[r.severity]} label={r.severity} />
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusChip tone={STATUS_TONE[r.status]} label={r.status} />,
    },
    {
      key: "components",
      header: "Affected",
      render: (r) => r.affectedComponents.map(statusComponentLabel).join(", "),
      hideBelow: "md",
    },
    {
      key: "visibility",
      header: "Visibility",
      render: (r) => (r.isPublic ? "Public" : "Draft"),
      hideBelow: "md",
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <button
          type="button"
          className="text-supporting font-medium text-brand-700 hover:underline"
          onClick={() => {
            setUpdateStatus(r.status);
            setUpdateTarget(r.id);
          }}
        >
          Post update
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {banner && <p className="text-supporting text-neutral-700">{banner}</p>}
      <Button className="self-start" onClick={() => setCreateOpen(true)}>
        Create incident
      </Button>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="No incidents recorded"
      />

      <AdminActionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create an incident"
        description="Shown on the public status page once marked public."
        confirmLabel="Create"
        busy={busy}
        onConfirm={create}
      >
        <div className="mb-4 flex flex-col gap-3">
          <FormField label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormField>
          <FormField label="Public summary">
            <Textarea
              value={publicSummary}
              onChange={(e) => setPublicSummary(e.target.value)}
              rows={2}
            />
          </FormField>
          <FormField label="Severity">
            <Select
              options={[
                { value: "minor", label: "Minor" },
                { value: "major", label: "Major" },
                { value: "critical", label: "Critical" },
              ]}
              value={severity}
              onValueChange={(v) => setSeverity(v as typeof severity)}
            />
          </FormField>
          <FormField label="Affected components">
            <div className="flex flex-col gap-2">
              {STATUS_COMPONENTS.map((c) => (
                <Checkbox
                  key={c.key}
                  label={c.label}
                  checked={affectedComponents.includes(c.key)}
                  onCheckedChange={() => toggleComponent(c.key)}
                />
              ))}
            </div>
          </FormField>
          <Switch
            label="Scheduled maintenance"
            description="Shown in the maintenance section instead of as an outage."
            checked={isScheduledMaintenance}
            onCheckedChange={setIsScheduledMaintenance}
          />
          <Switch
            label="Public"
            description="Off keeps this as an internal draft, invisible on /status."
            checked={isPublic}
            onCheckedChange={setIsPublic}
          />
          <FormField label="Start time">
            <Input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(new Date(e.target.value).toISOString())}
            />
          </FormField>
          <FormField label="Initial status">
            <Select
              options={STATUS_OPTIONS}
              value={initialStatus}
              onValueChange={(v) => setInitialStatus(v as typeof initialStatus)}
            />
          </FormField>
          <FormField label="Initial update message">
            <Textarea
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              rows={2}
            />
          </FormField>
        </div>
      </AdminActionDialog>

      <AdminActionDialog
        open={updateTarget !== null}
        onOpenChange={(open) => !open && setUpdateTarget(null)}
        title="Post an update"
        description="Appends to this incident's public timeline and changes its status."
        confirmLabel="Post update"
        busy={busy}
        onConfirm={postUpdate}
      >
        <div className="mb-4 flex flex-col gap-3">
          <FormField label="Status">
            <Select
              options={STATUS_OPTIONS}
              value={updateStatus}
              onValueChange={(v) => setUpdateStatus(v as typeof updateStatus)}
            />
          </FormField>
          <FormField label="Message">
            <Textarea
              value={updateMessage}
              onChange={(e) => setUpdateMessage(e.target.value)}
              rows={3}
            />
          </FormField>
        </div>
      </AdminActionDialog>
    </div>
  );
}
