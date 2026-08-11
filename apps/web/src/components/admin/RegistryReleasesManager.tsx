import { useEffect, useState } from "react";
import { Button, DataTable, FormField, Input, StatusChip } from "@crawlpact/ui";
import type { DataTableColumn } from "@crawlpact/ui";
import { AdminActionDialog } from "./AdminActionDialog";

type ReleaseRow = {
  id: string;
  versionLabel: string;
  changelog: string;
  isActive: boolean;
  publishedAt: string | null;
  createdAt: string;
};

type FieldChange = { field: string; changeClass: string };
type CrawlerDiffEntry = {
  crawlerId: string;
  fieldChanges: FieldChange[];
  isEvaluationSemantic: boolean;
};
type SemanticDiff = {
  added: { id: string }[];
  removed: { id: string }[];
  changed: CrawlerDiffEntry[];
  evaluationSemanticCrawlerIds: string[];
};
type ValidationResult = {
  errors: { code: string; message: string }[];
  warnings: { code: string; message: string }[];
  checksum: string;
};
type Comparison = {
  diff: SemanticDiff;
  validation: ValidationResult;
  affectedDomains: { domainId: string; canonicalOrigin: string }[];
};

/** SRS §28.11: registry release creation, comparison, publication, and
 * rollback. Published releases are never edited — only created, compared,
 * and pointed to. */
export function RegistryReleasesManager() {
  const [rows, setRows] = useState<ReleaseRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [createOpen, setCreateOpen] = useState(false);
  const [publishTarget, setPublishTarget] = useState<string | null>(null);
  const [rollbackTarget, setRollbackTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [versionLabel, setVersionLabel] = useState("");
  const [compareFrom, setCompareFrom] = useState("");
  const [compareTo, setCompareTo] = useState("");
  const [comparison, setComparison] = useState<Comparison | null>(null);

  async function load() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/registry/releases");
      const body = (await res.json()) as {
        ok: boolean;
        data?: ReleaseRow[];
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
      const res = await fetch("/api/admin/registry/releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionLabel, changelog: reason }),
      });
      const body = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setBanner("Release created (not yet published).");
      setCreateOpen(false);
      setVersionLabel("");
      await load();
    } catch (err) {
      setBanner((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runCompare() {
    if (!compareFrom || !compareTo) return;
    const res = await fetch(
      `/api/admin/registry/releases/compare?from=${compareFrom}&to=${compareTo}`,
    );
    const body = (await res.json()) as {
      ok: boolean;
      data?: Comparison;
      error?: { message: string };
    };
    if (!body.ok) {
      setBanner(body.error?.message ?? "Comparison failed");
      return;
    }
    setComparison(body.data ?? null);
  }

  async function publish(reason: string) {
    if (!publishTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/registry/releases/${publishTarget}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = (await res.json()) as {
        ok: boolean;
        data?: { domainsScheduledForReEvaluation: number };
        error?: { message: string };
      };
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setBanner(
        `Published. ${body.data?.domainsScheduledForReEvaluation ?? 0} domain(s) scheduled for re-evaluation.`,
      );
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
      const res = await fetch(`/api/admin/registry/releases/${rollbackTarget}/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setBanner("Rolled back — no release was deleted.");
      setRollbackTarget(null);
      await load();
    } catch (err) {
      setBanner((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const columns: DataTableColumn<ReleaseRow>[] = [
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
    { key: "changelog", header: "Notes", render: (r) => r.changelog, hideBelow: "md" },
    {
      key: "created",
      header: "Created",
      render: (r) => new Date(r.createdAt).toLocaleString(),
      hideBelow: "lg",
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className="flex gap-3">
          {!r.isActive && (
            <>
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
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {banner && <p className="text-supporting text-neutral-700">{banner}</p>}
      <Button className="self-start" onClick={() => setCreateOpen(true)}>
        Create release from current crawler set
      </Button>

      <section>
        <h2 className="text-h3 text-neutral-950">Releases</h2>
        <div className="mt-3">
          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(r) => r.id}
            isLoading={isLoading}
            error={error}
            emptyTitle="No releases yet"
          />
        </div>
      </section>

      <section>
        <h2 className="text-h3 text-neutral-950">Compare two releases</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <FormField label="From version ID">
            <Input value={compareFrom} onChange={(e) => setCompareFrom(e.target.value)} />
          </FormField>
          <FormField label="To version ID">
            <Input value={compareTo} onChange={(e) => setCompareTo(e.target.value)} />
          </FormField>
          <Button variant="secondary" onClick={runCompare}>
            Compare
          </Button>
        </div>
        {comparison && (
          <div className="mt-4 rounded-card border border-neutral-200 bg-white p-4">
            <p className="text-supporting text-neutral-700">
              Added: {comparison.diff.added.length} · Removed: {comparison.diff.removed.length} ·
              Changed: {comparison.diff.changed.length} (
              {comparison.diff.changed.filter((c) => c.isEvaluationSemantic).length}{" "}
              evaluation-semantic, remainder evidence/editorial-only)
            </p>
            <p className="mt-2 text-supporting text-neutral-700">
              {comparison.affectedDomains.length} saved domain(s) would see a different evaluation
              (computed only from evaluation-semantic changes — a source-URL refresh or wording edit
              never counts).
            </p>
            <p className="mt-2 break-all font-mono text-caption text-neutral-600">
              Candidate checksum (SHA-256): {comparison.validation.checksum}
            </p>
            {comparison.validation.errors.length > 0 && (
              <div className="mt-2 rounded-card border border-red-300 bg-red-50 p-2">
                <p className="text-supporting font-semibold text-red-800">
                  Blocking validation errors — this candidate cannot be published:
                </p>
                <ul className="mt-1 list-inside list-disc text-supporting text-red-800">
                  {comparison.validation.errors.map((e) => (
                    <li key={e.code}>{e.message}</li>
                  ))}
                </ul>
              </div>
            )}
            {comparison.validation.warnings.length > 0 && (
              <div className="mt-2 rounded-card border border-amber-300 bg-amber-50 p-2">
                <p className="text-supporting font-semibold text-amber-800">Warnings:</p>
                <ul className="mt-1 list-inside list-disc text-supporting text-amber-800">
                  {comparison.validation.warnings.map((w) => (
                    <li key={w.code}>{w.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <AdminActionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create a registry release"
        description="Snapshots every crawler's current state. Not published until you explicitly publish it. The reason below doubles as this release's mandatory notes."
        confirmLabel="Create release"
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
        title="Publish this release"
        description="Becomes the active registry for all future scans. Historical scans are unaffected. Affected domains are scheduled for re-evaluation."
        confirmLabel="Publish"
        busy={busy}
        onConfirm={publish}
      />

      <AdminActionDialog
        open={rollbackTarget !== null}
        onOpenChange={(open) => !open && setRollbackTarget(null)}
        title="Roll back to this release"
        description="Repoints the active registry. No release is deleted — the newer one remains in this list."
        confirmLabel="Roll back"
        destructive
        busy={busy}
        onConfirm={rollback}
      />
    </div>
  );
}
