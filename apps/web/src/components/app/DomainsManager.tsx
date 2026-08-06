import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  Alert,
  Button,
  DataTable,
  EmptyState,
  FormField,
  Input,
  Modal,
  Select,
  StatusChip,
  Textarea,
} from "@crawlpact/ui";
import type { DataTableColumn } from "@crawlpact/ui";
import type { BatchImportResult } from "@crawlpact/core";

type SavedDomain = {
  domainId: string;
  displayName: string;
  canonicalOrigin: string;
  groupId: string | null;
  preset: string;
  monitoringState: "active" | "paused";
  lastScanAt: string | null;
  nextScanAt: string | null;
  currentScore: number | null;
  openFindingsCount: number;
  recentChangeOrigin: string | null;
  recentChangeSummary: string | null;
};

const RECENT_CHANGE_LABEL: Record<string, string> = {
  website_policy: "Website-policy change",
  registry_driven: "Registry-driven change",
  mixed: "Mixed change",
  operational: "Operational change",
  uncertain: "Change (cause uncertain)",
  baseline: "New baseline",
};

type SortKey = "none" | "last_scan" | "recent_change";

type Group = { groupId: string; name: string; domainCount: number };

const PRESET_LABELS: Record<string, string> = {
  maximum_ai_visibility: "Maximum AI visibility",
  allow_search_block_training: "Allow search, block training",
  publisher_protection: "Publisher protection",
  block_known_ai_crawlers: "Block known AI crawlers",
};

type ScoreBand = "all" | "not_scored" | "critical" | "weak" | "needs_attention" | "good" | "strong";

const SCORE_BAND_OPTIONS: { value: ScoreBand; label: string }[] = [
  { value: "all", label: "All scores" },
  { value: "not_scored", label: "Not yet scored" },
  { value: "critical", label: "Critical (0–24)" },
  { value: "weak", label: "Weak (25–49)" },
  { value: "needs_attention", label: "Needs attention (50–74)" },
  { value: "good", label: "Good (75–89)" },
  { value: "strong", label: "Strong (90–100)" },
];

function matchesScoreBand(score: number | null, band: ScoreBand): boolean {
  if (band === "all") return true;
  if (band === "not_scored") return score === null;
  if (score === null) return false;
  if (band === "critical") return score < 25;
  if (band === "weak") return score < 50;
  if (band === "needs_attention") return score < 75;
  if (band === "good") return score < 90;
  return score >= 90;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url);
  const body = (await response.json()) as { ok: boolean; data?: T };
  return body.ok ? (body.data ?? null) : null;
}

export function DomainsManager({
  batchImportLimit = 0,
  savedDomainLimit,
}: {
  batchImportLimit?: number;
  savedDomainLimit?: number;
}) {
  const [domains, setDomains] = useState<SavedDomain[] | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [batchOpen, setBatchOpen] = useState(false);
  const [batchText, setBatchText] = useState("");
  const [batchGroupId, setBatchGroupId] = useState<string>("");
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<BatchImportResult | null>(null);

  const [filterGroupId, setFilterGroupId] = useState<string>("all");
  const [filterMonitoring, setFilterMonitoring] = useState<string>("all");
  const [filterScoreBand, setFilterScoreBand] = useState<ScoreBand>("all");
  const [filterHasFindings, setFilterHasFindings] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("none");

  async function refresh() {
    const [domainList, groupList] = await Promise.all([
      fetchJson<SavedDomain[]>("/api/domains"),
      fetchJson<Group[]>("/api/groups"),
    ]);
    setDomains(domainList ?? []);
    setGroups(groupList ?? []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFormError(null);
    try {
      const response = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      const body = (await response.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) {
        setFormError(body.error?.message ?? "Could not save this domain.");
        return;
      }
      setTarget("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleBatchImport() {
    if (batchBusy) return;
    const targets = batchText
      .split(/[\n,]+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (targets.length === 0) {
      setBatchError("Paste at least one domain, one per line (or comma-separated).");
      return;
    }
    setBatchBusy(true);
    setBatchError(null);
    try {
      const response = await fetch("/api/domains/batch-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets, groupId: batchGroupId || undefined }),
      });
      const body = (await response.json()) as {
        ok: boolean;
        data?: BatchImportResult;
        error?: { message: string };
      };
      if (!body.ok || !body.data) {
        setBatchError(body.error?.message ?? "Could not import these domains.");
        return;
      }
      setBatchResult(body.data);
      await refresh();
    } finally {
      setBatchBusy(false);
    }
  }

  function closeBatchDialog() {
    setBatchOpen(false);
    setBatchText("");
    setBatchGroupId("");
    setBatchError(null);
    setBatchResult(null);
  }

  async function handleDelete(domainId: string) {
    await fetch(`/api/domains/${domainId}`, { method: "DELETE" });
    await refresh();
  }

  async function handleToggleMonitoring(domain: SavedDomain) {
    await fetch(`/api/domains/${domain.domainId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        monitoringState: domain.monitoringState === "active" ? "paused" : "active",
      }),
    });
    await refresh();
  }

  const columns: DataTableColumn<SavedDomain>[] = [
    {
      key: "domain",
      header: "Domain",
      render: (row) => (
        <a href={`/app/domains/${row.domainId}`} className="font-medium text-brand-700">
          {row.displayName}
        </a>
      ),
    },
    ...(groups.length > 0
      ? [
          {
            key: "group",
            header: "Client group",
            hideBelow: "sm",
            render: (row: SavedDomain) =>
              groups.find((g) => g.groupId === row.groupId)?.name ?? "—",
          } satisfies DataTableColumn<SavedDomain>,
        ]
      : []),
    {
      key: "preset",
      header: "Preset",
      hideBelow: "md",
      render: (row) => PRESET_LABELS[row.preset] ?? row.preset,
    },
    {
      key: "score",
      header: "Score",
      render: (row) => (row.currentScore === null ? "—" : row.currentScore),
    },
    {
      key: "findings",
      header: "Findings",
      hideBelow: "sm",
      render: (row) =>
        row.openFindingsCount > 0 ? (
          <StatusChip tone="warning" label={String(row.openFindingsCount)} />
        ) : (
          <StatusChip tone="success" label="0" />
        ),
    },
    {
      key: "monitoring",
      header: "Monitoring",
      hideBelow: "md",
      render: (row) => (
        <button
          type="button"
          className="rounded-control focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
          onClick={() => void handleToggleMonitoring(row)}
          aria-label={`Monitoring is ${row.monitoringState === "active" ? "active" : "paused"} — click to ${row.monitoringState === "active" ? "pause" : "resume"}`}
        >
          <StatusChip
            tone={row.monitoringState === "active" ? "success" : "unknown"}
            label={row.monitoringState === "active" ? "Active" : "Paused"}
          />
        </button>
      ),
    },
    {
      key: "recent_change",
      header: "Recent change",
      hideBelow: "lg",
      render: (row) =>
        row.recentChangeOrigin ? (
          <span className="text-supporting text-neutral-700">
            {RECENT_CHANGE_LABEL[row.recentChangeOrigin] ?? row.recentChangeOrigin}
          </span>
        ) : (
          <span className="text-supporting text-neutral-500">No material change detected</span>
        ),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <button
          type="button"
          className="text-supporting font-medium text-error underline"
          onClick={() => void handleDelete(row.domainId)}
        >
          Remove
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleAdd}
        className="flex flex-col gap-3 rounded-card border border-neutral-200 bg-white p-5 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <FormField label="Domain" description="Enter a domain, such as example.com">
            <Input value={target} onChange={(e) => setTarget(e.target.value)} required />
          </FormField>
        </div>
        <Button type="submit" isLoading={busy} disabled={target.trim().length === 0}>
          Save domain
        </Button>
        {batchImportLimit > 0 && (
          <Button type="button" variant="secondary" onClick={() => setBatchOpen(true)}>
            Batch import
          </Button>
        )}
      </form>

      <Modal
        open={batchOpen}
        onOpenChange={(next) => (next ? setBatchOpen(true) : closeBatchDialog())}
        title="Batch import domains"
        description={`Paste up to ${batchImportLimit} domains, one per line. Duplicates and domains over your plan's saved-domain limit are reported individually.`}
        footer={
          batchResult ? (
            <Button onClick={closeBatchDialog}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={closeBatchDialog} disabled={batchBusy}>
                Cancel
              </Button>
              <Button isLoading={batchBusy} onClick={() => void handleBatchImport()}>
                Import
              </Button>
            </>
          )
        }
      >
        {batchError && (
          <Alert tone="error" title="Could not import these domains">
            {batchError}
          </Alert>
        )}
        {batchResult ? (
          <div className="flex flex-col gap-3">
            <Alert
              tone={batchResult.errorCount === 0 ? "success" : "warning"}
              title={`Saved ${batchResult.savedCount} of ${batchResult.results.length} domains`}
            >
              {batchResult.errorCount > 0 && "Review the errors below and re-import if needed."}
            </Alert>
            <div className="max-h-64 overflow-y-auto rounded-card border border-neutral-200">
              <table className="w-full text-left text-supporting">
                <tbody className="divide-y divide-neutral-200">
                  {batchResult.results.map((row) => (
                    <tr key={row.target}>
                      <td className="px-3 py-2 font-mono text-neutral-800">{row.target}</td>
                      <td className="px-3 py-2">
                        {row.ok ? (
                          <StatusChip tone="success" label="Saved" />
                        ) : (
                          <span className="text-error">{row.error}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <FormField
              label="Domains"
              description="One domain or URL per line, or comma-separated."
            >
              <Textarea
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                rows={8}
                placeholder={"example.com\nclient-two.com"}
              />
            </FormField>
            {groups.length > 0 && (
              <FormField
                label="Group"
                description="Optional — add every imported domain to a group."
              >
                <Select
                  value={batchGroupId}
                  onValueChange={setBatchGroupId}
                  placeholder="No group"
                  options={groups.map((g) => ({ value: g.groupId, label: g.name }))}
                />
              </FormField>
            )}
          </div>
        )}
      </Modal>
      {formError && (
        <Alert tone="error" title="Could not save this domain">
          {formError}
        </Alert>
      )}

      {domains === null ? (
        <div className="flex flex-col gap-2" aria-live="polite" aria-busy="true">
          <span className="sr-only">Loading saved domains…</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-card bg-neutral-100" />
          ))}
        </div>
      ) : domains.length === 0 ? (
        <EmptyState
          title="No saved domains yet"
          description="Save a domain above to start tracking its AI crawler policy and scheduling scans."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-card border border-neutral-200 bg-white p-4">
              <p className="text-supporting text-neutral-600">
                {savedDomainLimit ? `Domains (of ${savedDomainLimit} on your plan)` : "Domains"}
              </p>
              <p className="text-h3 text-neutral-950">{domains.length}</p>
            </div>
            <div className="rounded-card border border-neutral-200 bg-white p-4">
              <p className="text-supporting text-neutral-600">With open findings</p>
              <p className="text-h3 text-neutral-950">
                {domains.filter((d) => d.openFindingsCount > 0).length}
              </p>
            </div>
            <div className="rounded-card border border-neutral-200 bg-white p-4">
              <p className="text-supporting text-neutral-600">Monitoring paused</p>
              <p className="text-h3 text-neutral-950">
                {domains.filter((d) => d.monitoringState === "paused").length}
              </p>
            </div>
            <div className="rounded-card border border-neutral-200 bg-white p-4">
              <p className="text-supporting text-neutral-600">Not yet scored</p>
              <p className="text-h3 text-neutral-950">
                {domains.filter((d) => d.currentScore === null).length}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 rounded-card border border-neutral-200 bg-white p-4">
            <div className="w-52">
              <FormField label="Search">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by domain"
                  aria-label="Search saved domains by name"
                />
              </FormField>
            </div>
            <div className="w-44">
              <FormField label="Sort by">
                <Select
                  value={sortKey}
                  onValueChange={(value) => setSortKey(value as SortKey)}
                  options={[
                    { value: "none", label: "Default order" },
                    { value: "last_scan", label: "Last scan" },
                    { value: "recent_change", label: "Recent change" },
                  ]}
                />
              </FormField>
            </div>
            {groups.length > 0 && (
              <div className="w-44">
                <FormField label="Client group">
                  <Select
                    value={filterGroupId}
                    onValueChange={setFilterGroupId}
                    options={[
                      { value: "all", label: "All groups" },
                      { value: "none", label: "No group" },
                      ...groups.map((g) => ({ value: g.groupId, label: g.name })),
                    ]}
                  />
                </FormField>
              </div>
            )}
            <div className="w-40">
              <FormField label="Monitoring">
                <Select
                  value={filterMonitoring}
                  onValueChange={setFilterMonitoring}
                  options={[
                    { value: "all", label: "All" },
                    { value: "active", label: "Active" },
                    { value: "paused", label: "Paused" },
                  ]}
                />
              </FormField>
            </div>
            <div className="w-52">
              <FormField label="Score">
                <Select
                  value={filterScoreBand}
                  onValueChange={(value) => setFilterScoreBand(value as ScoreBand)}
                  options={SCORE_BAND_OPTIONS}
                />
              </FormField>
            </div>
            <label className="flex items-center gap-2 pb-2.5 text-supporting text-neutral-700">
              <input
                type="checkbox"
                checked={filterHasFindings}
                onChange={(e) => setFilterHasFindings(e.target.checked)}
                className="size-4"
              />
              Only domains with open findings
            </label>
          </div>

          {(() => {
            const query = search.trim().toLowerCase();
            const filtered = domains.filter((d) => {
              if (
                query &&
                !d.displayName.toLowerCase().includes(query) &&
                !d.canonicalOrigin.toLowerCase().includes(query)
              )
                return false;
              if (filterGroupId === "none" && d.groupId !== null) return false;
              if (
                filterGroupId !== "all" &&
                filterGroupId !== "none" &&
                d.groupId !== filterGroupId
              )
                return false;
              if (filterMonitoring !== "all" && d.monitoringState !== filterMonitoring)
                return false;
              if (!matchesScoreBand(d.currentScore, filterScoreBand)) return false;
              if (filterHasFindings && d.openFindingsCount === 0) return false;
              return true;
            });
            const sorted = [...filtered].sort((a, b) => {
              if (sortKey === "last_scan") {
                return (b.lastScanAt ?? "").localeCompare(a.lastScanAt ?? "");
              }
              if (sortKey === "recent_change") {
                return (a.recentChangeOrigin ? 0 : 1) - (b.recentChangeOrigin ? 0 : 1);
              }
              return 0;
            });
            return sorted.length === 0 ? (
              <EmptyState
                title="No domains match these filters"
                description="Try widening your group, monitoring, or score filters."
              />
            ) : (
              <DataTable columns={columns} rows={sorted} getRowKey={(row) => row.domainId} />
            );
          })()}
        </>
      )}

      {groups.length > 0 && (
        <p className="text-supporting text-neutral-600">
          Manage domain groups from the{" "}
          <a href="/app/groups" className="text-brand-700 underline">
            Groups
          </a>{" "}
          page.
        </p>
      )}
    </div>
  );
}
