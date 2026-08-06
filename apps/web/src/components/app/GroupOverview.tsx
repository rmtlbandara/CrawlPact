import { useEffect, useState } from "react";
import { EmptyState, MetricCard } from "@crawlpact/ui";

type GroupSummaryResponse = {
  groupId: string;
  name: string;
  description: string | null;
  summary: {
    domainCount: number;
    monitoringActive: number;
    requiringAttention: number;
    failedLatestScan: number;
    meaningfulChangesInPeriod: number;
  };
};

async function fetchJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url);
  const body = (await response.json()) as { ok: boolean; data?: T };
  return body.ok ? (body.data ?? null) : null;
}

export function GroupOverview({ groupId }: { groupId: string }) {
  const [data, setData] = useState<GroupSummaryResponse | null>(null);

  useEffect(() => {
    void fetchJson<GroupSummaryResponse>(`/api/groups/${groupId}/summary`).then(setData);
  }, [groupId]);

  if (data === null) {
    return <div className="h-48 animate-pulse rounded-card bg-neutral-100" aria-hidden="true" />;
  }

  return (
    <div className="flex flex-col gap-6">
      {data.description && <p className="text-supporting text-neutral-600">{data.description}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Domains" value={data.summary.domainCount} />
        <MetricCard label="Monitoring active" value={data.summary.monitoringActive} />
        <MetricCard label="Requiring attention" value={data.summary.requiringAttention} />
        <MetricCard label="Failed latest scan" value={data.summary.failedLatestScan} />
      </div>
      <div>
        <h2 className="text-h3 text-neutral-950">Domains in this group</h2>
        <div className="mt-3">
          {data.summary.domainCount === 0 ? (
            <EmptyState
              title="No domains in this group yet"
              description="Assign domains to this group from the Domains page."
            />
          ) : (
            <a
              href={`/app/workspace/domains?groupId=${encodeURIComponent(groupId)}`}
              className="inline-block rounded-control border border-neutral-300 bg-white px-4 py-2 text-body font-medium text-neutral-800 hover:bg-neutral-50"
            >
              View {data.summary.domainCount} domain{data.summary.domainCount === 1 ? "" : "s"} in
              this group
            </a>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={`/api/domains/export.csv?groupId=${encodeURIComponent(groupId)}`}
          className="inline-block rounded-control border border-neutral-300 bg-white px-4 py-2 text-body font-medium text-neutral-800 hover:bg-neutral-50"
        >
          Export this group
        </a>
        <a
          href={`/app/workspace/import?groupId=${encodeURIComponent(groupId)}`}
          className="inline-block rounded-control border border-neutral-300 bg-white px-4 py-2 text-body font-medium text-neutral-800 hover:bg-neutral-50"
        >
          Import into this group
        </a>
      </div>
    </div>
  );
}
