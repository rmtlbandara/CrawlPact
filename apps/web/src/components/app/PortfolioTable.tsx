import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  DataTable,
  EmptyState,
  FormField,
  Input,
  Pagination,
  Select,
  StatusChip,
} from "@crawlpact/ui";
import type { DataTableColumn } from "@crawlpact/ui";

type DomainRow = {
  domainId: string;
  displayName: string;
  canonicalOrigin: string;
  groupId: string | null;
  groupName: string | null;
  monitoringState: "active" | "paused";
  lastScanAt: string | null;
  nextScanAt: string | null;
  currentScore: number | null;
  lastScanStatus: string | null;
  changeOrigin: string | null;
  changeSummary: string | null;
  changeObservedAt: string | null;
  attentionReasons: string[];
};

type Group = { groupId: string; name: string };

const CHANGE_ORIGIN_LABEL: Record<string, string> = {
  website_policy: "Website-policy change",
  registry_driven: "Registry-driven change",
  mixed: "Mixed change",
  operational: "Operational change",
  uncertain: "Change (cause uncertain)",
  baseline: "New baseline",
};

const LIMIT = 25;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  const response = await fetch(url, init);
  const body = (await response.json()) as { ok: boolean; data?: T; error?: { message: string } };
  return body.ok ? (body.data ?? null) : null;
}

function readInitialFilters() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  return {
    groupId: params.get("groupId") ?? "all",
    attentionOnly: params.get("attentionOnly") === "1",
    monitoringState: params.get("monitoringState") ?? "all",
    changeOrigin: params.get("changeOrigin") ?? "all",
    scanState: params.get("scanState") ?? "all",
  };
}

export function PortfolioTable({ domainGroupsEnabled }: { domainGroupsEnabled: boolean }) {
  const initial = readInitialFilters();
  const [rows, setRows] = useState<DomainRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [groups, setGroups] = useState<Group[]>([]);
  const [search, setSearch] = useState("");
  const [groupId, setGroupId] = useState(initial.groupId ?? "all");
  const [attentionOnly, setAttentionOnly] = useState(initial.attentionOnly ?? false);
  const [monitoringState, setMonitoringState] = useState(initial.monitoringState ?? "all");
  const [changeOrigin, setChangeOrigin] = useState(initial.changeOrigin ?? "all");
  const [scanState, setScanState] = useState(initial.scanState ?? "all");
  const [sort, setSort] = useState("domain");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [bulkTargetGroupId, setBulkTargetGroupId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkResultSummary, setBulkResultSummary] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (groupId !== "all") params.set("groupId", groupId);
    if (attentionOnly) params.set("attentionOnly", "1");
    if (monitoringState !== "all") params.set("monitoringState", monitoringState);
    if (changeOrigin !== "all") params.set("changeOrigin", changeOrigin);
    if (scanState !== "all") params.set("scanState", scanState);
    if (search.trim()) params.set("search", search.trim());
    params.set("sort", sort);
    params.set("limit", String(LIMIT));
    params.set("cursor", String((page - 1) * LIMIT));

    const result = await fetchJson<{ items: DomainRow[]; total: number }>(
      `/api/workspace/domains?${params.toString()}`,
    );
    setRows(result?.items ?? []);
    setTotal(result?.total ?? 0);
  }, [groupId, attentionOnly, monitoringState, changeOrigin, scanState, search, sort, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void fetchJson<Group[]>("/api/groups").then((g) => setGroups(g ?? []));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [groupId, attentionOnly, monitoringState, changeOrigin, scanState, search, sort]);

  function toggleSelected(domainId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(domainId)) next.delete(domainId);
      else next.add(domainId);
      return next;
    });
  }

  async function runBulkAction() {
    if (!bulkAction || selected.size === 0 || bulkBusy) return;
    setBulkBusy(true);
    setBulkError(null);
    setBulkResultSummary(null);
    try {
      const response = await fetch("/api/workspace/bulk-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: bulkAction,
          domainIds: [...selected],
          groupId:
            bulkAction === "assign_group" || bulkAction === "move_group"
              ? bulkTargetGroupId || undefined
              : undefined,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const body = (await response.json()) as {
        ok: boolean;
        data?: { succeededCount: number; skippedCount: number; failedCount: number };
        error?: { message: string };
      };
      if (!body.ok || !body.data) {
        setBulkError(body.error?.message ?? "Could not complete this bulk action.");
        return;
      }
      setBulkResultSummary(
        `${body.data.succeededCount} succeeded, ${body.data.skippedCount} skipped, ${body.data.failedCount} failed.`,
      );
      setSelected(new Set());
      await load();
    } finally {
      setBulkBusy(false);
    }
  }

  const columns: DataTableColumn<DomainRow>[] = [
    {
      key: "select",
      header: "",
      render: (row) => (
        <input
          type="checkbox"
          aria-label={`Select ${row.displayName}`}
          checked={selected.has(row.domainId)}
          onChange={() => toggleSelected(row.domainId)}
          className="size-4"
        />
      ),
    },
    {
      key: "domain",
      header: "Domain",
      render: (row) => (
        <a href={`/app/domains/${row.domainId}`} className="font-medium text-brand-700 underline">
          {row.displayName}
        </a>
      ),
    },
    ...(domainGroupsEnabled
      ? [
          {
            key: "group",
            header: "Group",
            hideBelow: "sm",
            render: (row: DomainRow) => row.groupName ?? "—",
          } satisfies DataTableColumn<DomainRow>,
        ]
      : []),
    {
      key: "score",
      header: "Score",
      render: (row) => (row.currentScore === null ? "—" : row.currentScore),
    },
    {
      key: "monitoring",
      header: "Monitoring",
      hideBelow: "md",
      render: (row) => (
        <StatusChip
          tone={row.monitoringState === "active" ? "success" : "unknown"}
          label={row.monitoringState === "active" ? "Active" : "Paused"}
        />
      ),
    },
    {
      key: "last_scan",
      header: "Last scan",
      hideBelow: "md",
      render: (row) => (row.lastScanAt ? new Date(row.lastScanAt).toLocaleDateString() : "Never"),
    },
    {
      key: "attention",
      header: "Attention",
      render: (row) =>
        row.attentionReasons.length > 0 ? (
          <StatusChip tone="warning" label={String(row.attentionReasons.length)} />
        ) : (
          <StatusChip tone="success" label="None" />
        ),
    },
    {
      key: "recent_change",
      header: "Recent change",
      hideBelow: "lg",
      render: (row) =>
        row.changeOrigin ? (
          <span className="text-supporting text-neutral-700">
            {CHANGE_ORIGIN_LABEL[row.changeOrigin] ?? row.changeOrigin}
          </span>
        ) : (
          <span className="text-supporting text-neutral-500">No material change detected</span>
        ),
    },
  ];

  const pageCount = Math.max(Math.ceil(total / LIMIT), 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-card border border-neutral-200 bg-white p-4">
        <div className="w-52">
          <FormField label="Search">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by domain or group"
              aria-label="Search portfolio domains by name or group"
            />
          </FormField>
        </div>
        {domainGroupsEnabled && (
          <div className="w-44">
            <FormField label="Group">
              <Select
                value={groupId}
                onValueChange={setGroupId}
                options={[
                  { value: "all", label: "All groups" },
                  { value: "none", label: "Ungrouped" },
                  ...groups.map((g) => ({ value: g.groupId, label: g.name })),
                ]}
              />
            </FormField>
          </div>
        )}
        <div className="w-40">
          <FormField label="Monitoring">
            <Select
              value={monitoringState}
              onValueChange={setMonitoringState}
              options={[
                { value: "all", label: "All" },
                { value: "active", label: "Active" },
                { value: "paused", label: "Paused" },
              ]}
            />
          </FormField>
        </div>
        <div className="w-48">
          <FormField label="Change origin">
            <Select
              value={changeOrigin}
              onValueChange={setChangeOrigin}
              options={[
                { value: "all", label: "Any" },
                { value: "website_policy", label: "Website-policy" },
                { value: "registry_driven", label: "Registry-driven" },
                { value: "mixed", label: "Mixed" },
              ]}
            />
          </FormField>
        </div>
        <div className="w-40">
          <FormField label="Scan state">
            <Select
              value={scanState}
              onValueChange={setScanState}
              options={[
                { value: "all", label: "Any" },
                { value: "failed", label: "Failed" },
                { value: "incomplete", label: "Incomplete" },
              ]}
            />
          </FormField>
        </div>
        <div className="w-44">
          <FormField label="Sort by">
            <Select
              value={sort}
              onValueChange={setSort}
              options={[
                { value: "domain", label: "Domain" },
                { value: "last_scan", label: "Last scan" },
                { value: "next_scan", label: "Next scan" },
                { value: "recent_change", label: "Recent change" },
                { value: "attention", label: "Attention state" },
              ]}
            />
          </FormField>
        </div>
        <label className="flex items-center gap-2 pb-2.5 text-supporting text-neutral-700">
          <input
            type="checkbox"
            checked={attentionOnly}
            onChange={(e) => setAttentionOnly(e.target.checked)}
            className="size-4"
          />
          Requiring attention only
        </label>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-end gap-3 rounded-card border border-brand-200 bg-brand-50 p-4">
          <p className="text-supporting text-neutral-800">{selected.size} selected</p>
          <div className="w-56">
            <FormField label="Bulk action">
              <Select
                value={bulkAction}
                onValueChange={setBulkAction}
                placeholder="Choose an action"
                options={[
                  ...(domainGroupsEnabled
                    ? [
                        { value: "assign_group", label: "Assign to group" },
                        { value: "move_group", label: "Move to group" },
                        { value: "remove_from_group", label: "Remove from group" },
                      ]
                    : []),
                  { value: "enable_monitoring", label: "Enable monitoring" },
                  { value: "disable_monitoring", label: "Disable monitoring" },
                  { value: "pause_monitoring", label: "Pause monitoring" },
                  { value: "resume_monitoring", label: "Resume monitoring" },
                ]}
              />
            </FormField>
          </div>
          {(bulkAction === "assign_group" || bulkAction === "move_group") && (
            <div className="w-52">
              <FormField label="Target group">
                <Select
                  value={bulkTargetGroupId}
                  onValueChange={setBulkTargetGroupId}
                  options={groups.map((g) => ({ value: g.groupId, label: g.name }))}
                />
              </FormField>
            </div>
          )}
          <Button isLoading={bulkBusy} disabled={!bulkAction} onClick={() => void runBulkAction()}>
            Apply to {selected.size} domain{selected.size === 1 ? "" : "s"}
          </Button>
          <Button variant="secondary" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
        </div>
      )}
      {bulkError && (
        <Alert tone="error" title="Bulk action could not complete">
          {bulkError}
        </Alert>
      )}
      {bulkResultSummary && (
        <Alert tone="success" title="Bulk action complete">
          {bulkResultSummary}
        </Alert>
      )}

      {rows === null ? (
        <div className="h-48 animate-pulse rounded-card bg-neutral-100" aria-hidden="true" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No domains match these filters"
          description="Try widening your filters."
        />
      ) : (
        <>
          <DataTable columns={columns} rows={rows} getRowKey={(row) => row.domainId} />
          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
