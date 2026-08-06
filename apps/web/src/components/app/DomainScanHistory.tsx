import { useEffect, useState } from "react";
import { Button, FormField, Select, StatusChip } from "@crawlpact/ui";
import { STATUS_LABEL, STATUS_TONE } from "../../lib/scan-status-labels";
import type { AuditStatus } from "@crawlpact/core";

type ScanRow = {
  scanId: string;
  status: string;
  score: number | null;
  triggeredBy: string;
  startedAt: string;
  changeDetected: boolean;
};

type Filter =
  | "all"
  | "manual"
  | "scheduled"
  | "successful"
  | "partial"
  | "failed"
  | "change_detected"
  | "no_material_change";

const FILTER_OPTIONS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "manual", label: "Manual" },
  { value: "scheduled", label: "Scheduled" },
  { value: "successful", label: "Successful" },
  { value: "partial", label: "Partial" },
  { value: "failed", label: "Failed" },
  { value: "change_detected", label: "Change detected" },
  { value: "no_material_change", label: "No material change" },
];

async function fetchJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url);
  const body = (await response.json()) as { ok: boolean; data?: T };
  return body.ok ? (body.data ?? null) : null;
}

export function DomainScanHistory({ domainId }: { domainId: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [scans, setScans] = useState<ScanRow[] | null>(null);
  const [cursor, setCursor] = useState<{ startedAt: string; scanId: string } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  async function load(nextFilter: Filter, after?: { startedAt: string; scanId: string } | null) {
    const params = new URLSearchParams({ filter: nextFilter });
    if (after) {
      params.set("cursorStartedAt", after.startedAt);
      params.set("cursorScanId", after.scanId);
    }
    const data = await fetchJson<{
      scans: ScanRow[];
      nextCursor: { startedAt: string; scanId: string } | null;
    }>(`/api/domains/${domainId}/scans?${params.toString()}`);
    if (!data) return;
    setScans((prev) => (after ? [...(prev ?? []), ...data.scans] : data.scans));
    setCursor(data.nextCursor);
  }

  useEffect(() => {
    setScans(null);
    void load(filter, null);
  }, [domainId, filter]);

  async function handleLoadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      await load(filter, cursor);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="w-48">
        <FormField label="Filter">
          <Select
            value={filter}
            onValueChange={(v) => setFilter(v as Filter)}
            options={FILTER_OPTIONS}
          />
        </FormField>
      </div>

      {scans === null ? (
        <div aria-live="polite" aria-busy="true">
          <span className="sr-only">Loading scan history…</span>
          <div className="h-24 animate-pulse rounded-card bg-neutral-100" />
        </div>
      ) : scans.length === 0 ? (
        <p className="text-body text-neutral-600">
          No completed saved-domain scans are available yet.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-card border border-neutral-200 bg-white">
          {scans.map((scan) => (
            <li
              key={scan.scanId}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <a href={`/audit/${scan.scanId}`} className="text-body text-brand-700">
                {new Date(scan.startedAt).toLocaleString()}
              </a>
              <div className="flex items-center gap-2">
                <span className="text-supporting text-neutral-600">{scan.triggeredBy}</span>
                {scan.changeDetected && <StatusChip tone="info" label="Change" />}
                <StatusChip
                  tone={STATUS_TONE[scan.status as AuditStatus] ?? "unknown"}
                  label={STATUS_LABEL[scan.status as AuditStatus] ?? scan.status}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {cursor && (
        <Button variant="secondary" isLoading={loadingMore} onClick={() => void handleLoadMore()}>
          Load more scans
        </Button>
      )}
    </div>
  );
}
