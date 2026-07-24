import { useEffect, useState } from "react";
import { Button, DataTable, FormField, Input, Select, StatusChip, Textarea } from "@crawlpact/ui";
import type { DataTableColumn } from "@crawlpact/ui";
import { AdminActionDialog } from "./AdminActionDialog";

type CrawlerRow = {
  crawler: {
    id: string;
    name: string;
    userAgentToken: string;
    purpose: string;
    lifecycleStatus: string;
    officialSourceUrl: string;
    lastVerifiedAt: string | null;
  };
  operator: { name: string };
};

type OperatorOption = { id: string; name: string };

const STATUS_TONE: Record<string, "success" | "warning" | "error" | "info"> = {
  active: "success",
  unverified: "warning",
  deprecated: "warning",
  replaced: "error",
  retired: "error",
};

/** SRS §28.11: crawler draft CRUD, source verification, lifecycle/deprecation/replacement. */
export function CrawlersManager({ operators }: { operators: OperatorOption[] }) {
  const [rows, setRows] = useState<CrawlerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [createOpen, setCreateOpen] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState<string | null>(null);
  const [deprecateTarget, setDeprecateTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const [operatorId, setOperatorId] = useState(operators[0]?.id ?? "");
  const [name, setName] = useState("");
  const [userAgentToken, setUserAgentToken] = useState("");
  const [purpose, setPurpose] = useState("search");
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [newStatus, setNewStatus] = useState("deprecated");
  const [replacementId, setReplacementId] = useState("");

  async function load() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/registry/crawlers");
      const body = (await res.json()) as {
        ok: boolean;
        data?: CrawlerRow[];
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

  async function createDraft(reason: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/registry/crawlers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operatorId,
          name,
          userAgentToken,
          purpose,
          description,
          officialSourceUrl: sourceUrl,
          reason,
        }),
      });
      const body = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setBanner("Draft crawler created (unverified).");
      setCreateOpen(false);
      setName("");
      setUserAgentToken("");
      setDescription("");
      setSourceUrl("");
      await load();
    } catch (err) {
      setBanner((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(reason: string) {
    if (!verifyTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/registry/crawlers/${verifyTarget}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ officialSourceUrl: sourceUrl, reason }),
      });
      const body = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setBanner("Crawler verified and marked active.");
      setVerifyTarget(null);
      setSourceUrl("");
      await load();
    } catch (err) {
      setBanner((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deprecate(reason: string) {
    if (!deprecateTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/registry/crawlers/${deprecateTarget}/deprecate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          replacementCrawlerId: replacementId || undefined,
          reason,
        }),
      });
      const body = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setBanner(`Lifecycle status changed to ${newStatus}.`);
      setDeprecateTarget(null);
      setReplacementId("");
      await load();
    } catch (err) {
      setBanner((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const columns: DataTableColumn<CrawlerRow>[] = [
    { key: "name", header: "Crawler", render: (r) => r.crawler.name },
    { key: "operator", header: "Operator", render: (r) => r.operator.name, hideBelow: "sm" },
    {
      key: "token",
      header: "User-agent token",
      render: (r) => <span className="font-mono text-supporting">{r.crawler.userAgentToken}</span>,
      hideBelow: "md",
    },
    { key: "purpose", header: "Purpose", render: (r) => r.crawler.purpose, hideBelow: "sm" },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <StatusChip
          tone={STATUS_TONE[r.crawler.lifecycleStatus] ?? "info"}
          label={r.crawler.lifecycleStatus}
        />
      ),
    },
    {
      key: "verified",
      header: "Last verified",
      render: (r) =>
        r.crawler.lastVerifiedAt
          ? new Date(r.crawler.lastVerifiedAt).toLocaleDateString()
          : "Never",
      hideBelow: "lg",
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className="flex gap-3">
          <button
            type="button"
            className="text-supporting font-medium text-brand-700 hover:underline"
            onClick={() => setVerifyTarget(r.crawler.id)}
          >
            Verify
          </button>
          <button
            type="button"
            className="text-supporting font-medium text-brand-700 hover:underline"
            onClick={() => setDeprecateTarget(r.crawler.id)}
          >
            Change status
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {banner && <p className="text-supporting text-neutral-700">{banner}</p>}
      <Button className="self-start" onClick={() => setCreateOpen(true)}>
        Create draft crawler
      </Button>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.crawler.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="No crawlers registered yet"
      />

      <AdminActionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create a draft crawler"
        description="Always starts unverified — verify separately against an official source before it's used in evaluation."
        confirmLabel="Create draft"
        busy={busy}
        onConfirm={createDraft}
      >
        <div className="mb-4 flex flex-col gap-3">
          <FormField label="Operator">
            <Select
              options={operators.map((o) => ({ value: o.id, label: o.name }))}
              value={operatorId}
              onValueChange={setOperatorId}
            />
          </FormField>
          <FormField label="Crawler name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label="User-agent token">
            <Input
              value={userAgentToken}
              onChange={(e) => setUserAgentToken(e.target.value)}
              placeholder="ExampleBot"
            />
          </FormField>
          <FormField label="Purpose">
            <Select
              options={[
                { value: "search", label: "Search" },
                { value: "training", label: "Training" },
                { value: "user_triggered", label: "User-triggered" },
                { value: "agent", label: "Agent" },
                { value: "advertising_validation", label: "Advertising/validation" },
                { value: "research", label: "Research" },
                { value: "mixed", label: "Mixed" },
                { value: "unknown", label: "Unknown" },
              ]}
              value={purpose}
              onValueChange={setPurpose}
            />
          </FormField>
          <FormField label="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </FormField>
          <FormField label="Official source URL">
            <Input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://..."
            />
          </FormField>
        </div>
      </AdminActionDialog>

      <AdminActionDialog
        open={verifyTarget !== null}
        onOpenChange={(open) => !open && setVerifyTarget(null)}
        title="Verify this crawler"
        description="Confirms the token/purpose against an official source and marks the crawler active."
        confirmLabel="Mark verified"
        busy={busy}
        onConfirm={verify}
      >
        <div className="mb-4">
          <FormField label="Official source URL">
            <Input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://..."
            />
          </FormField>
        </div>
      </AdminActionDialog>

      <AdminActionDialog
        open={deprecateTarget !== null}
        onOpenChange={(open) => !open && setDeprecateTarget(null)}
        title="Change lifecycle status"
        description="Deprecating or retiring a token affects how it's evaluated in future scans, not historical ones."
        confirmLabel="Apply"
        destructive
        busy={busy}
        onConfirm={deprecate}
      >
        <div className="mb-4 flex flex-col gap-3">
          <FormField label="New status">
            <Select
              options={[
                { value: "active", label: "Active" },
                { value: "deprecated", label: "Deprecated" },
                { value: "replaced", label: "Replaced" },
                { value: "retired", label: "Retired" },
              ]}
              value={newStatus}
              onValueChange={setNewStatus}
            />
          </FormField>
          <FormField label="Replacement crawler ID (optional)">
            <Input value={replacementId} onChange={(e) => setReplacementId(e.target.value)} />
          </FormField>
        </div>
      </AdminActionDialog>
    </div>
  );
}
