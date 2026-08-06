import { useEffect, useState } from "react";
import { Card, EmptyState, MetricCard, StatusChip } from "@crawlpact/ui";

type Summary = {
  asOf: string;
  totalDomains: number;
  monitoringActive: number;
  monitoringDisabled: number;
  monitoringPaused: number;
  requiringAttention: number;
  incompleteEvidence: number;
  failedLatestScan: number;
  meaningfulChangesInPeriod: number;
  websitePolicyChangesInPeriod: number;
  registryDrivenChangesInPeriod: number;
  baselinePending: number;
};

type AttentionItem = {
  domainId: string;
  displayName: string;
  groupName: string | null;
  changeOrigin: string | null;
  changeObservedAt: string | null;
  monitoringState: string;
  attentionReasons: string[];
};

type ChangeFeedItem = {
  id: string;
  domainId: string;
  displayName: string;
  groupName: string | null;
  changeOrigin: string;
  attentionLevel: string;
  observedAt: string;
  summary: string;
};

type Group = { groupId: string; name: string; domainCount: number };

const ATTENTION_REASON_LABEL: Record<string, string> = {
  high_attention_finding: "High-attention finding",
  registry_driven_review: "Registry-driven change to review",
  website_policy_review: "Website-policy change to review",
  mixed_conflict: "Mixed policy conflict",
  monitoring_paused_after_failures: "Monitoring paused after failures",
  latest_scan_incomplete: "Latest scan incomplete",
  latest_scan_failed: "Latest scan failed",
  baseline_pending: "Baseline pending",
};

const CHANGE_ORIGIN_LABEL: Record<string, string> = {
  website_policy: "Website-policy change",
  registry_driven: "Registry-driven change",
  mixed: "Mixed change",
  operational: "Operational change",
  uncertain: "Change (cause uncertain)",
  baseline: "New baseline",
};

async function fetchJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url);
  const body = (await response.json()) as { ok: boolean; data?: T };
  return body.ok ? (body.data ?? null) : null;
}

export function AgencyWorkspace() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [attention, setAttention] = useState<AttentionItem[] | null>(null);
  const [changes, setChanges] = useState<ChangeFeedItem[] | null>(null);
  const [groups, setGroups] = useState<Group[] | null>(null);

  useEffect(() => {
    void fetchJson<Summary>("/api/workspace/summary?period=30d").then(setSummary);
    void fetchJson<{ items: AttentionItem[] }>("/api/workspace/attention?limit=5").then((r) =>
      setAttention(r?.items ?? []),
    );
    void fetchJson<{ items: ChangeFeedItem[] }>("/api/workspace/changes?limit=5").then((r) =>
      setChanges(r?.items ?? []),
    );
    void fetchJson<Group[]>("/api/groups").then((r) => setGroups(r ?? []));
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="portfolio-summary-heading">
        <div className="flex items-center justify-between">
          <h2 id="portfolio-summary-heading" className="text-h2 text-neutral-950">
            Portfolio summary
          </h2>
          {summary && (
            <p className="text-supporting text-neutral-500">
              Data as of {new Date(summary.asOf).toLocaleString()}
            </p>
          )}
        </div>
        {summary ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <a
              href="/app/workspace/domains"
              aria-label={`${summary.totalDomains} total saved domains`}
            >
              <MetricCard label="Saved domains" value={summary.totalDomains} />
            </a>
            <a
              href="/app/workspace/domains?monitoringState=active"
              aria-label={`${summary.monitoringActive} domains with monitoring active`}
            >
              <MetricCard label="Monitoring active" value={summary.monitoringActive} />
            </a>
            <a
              href="/app/workspace/domains?attentionOnly=1"
              aria-label={`${summary.requiringAttention} domains requiring attention`}
            >
              <MetricCard label="Requiring attention" value={summary.requiringAttention} />
            </a>
            <a
              href="/app/workspace/domains?scanState=failed"
              aria-label={`${summary.failedLatestScan} domains with a failed latest scan`}
            >
              <MetricCard label="Failed latest scan" value={summary.failedLatestScan} />
            </a>
            <a
              href="/app/workspace/domains?changeOrigin=website_policy"
              aria-label={`${summary.websitePolicyChangesInPeriod} domains with website-policy changes in the last 30 days`}
            >
              <MetricCard
                label="Website-policy changes (30d)"
                value={summary.websitePolicyChangesInPeriod}
              />
            </a>
          </div>
        ) : (
          <div className="mt-4 h-24 animate-pulse rounded-card bg-neutral-100" aria-hidden="true" />
        )}
      </section>

      <section aria-labelledby="attention-queue-heading">
        <h2 id="attention-queue-heading" className="text-h2 text-neutral-950">
          Attention queue
        </h2>
        <p className="mt-1 text-supporting text-neutral-600">
          Domains where a change, failure, or pending baseline may need review.
        </p>
        <div className="mt-4">
          {attention === null ? (
            <div className="h-32 animate-pulse rounded-card bg-neutral-100" aria-hidden="true" />
          ) : attention.length === 0 ? (
            <EmptyState
              title="Nothing needs attention right now"
              description="Every saved domain is up to date."
            />
          ) : (
            <ul className="divide-y divide-neutral-200 rounded-card border border-neutral-200 bg-white">
              {attention.map((item) => (
                <li key={item.domainId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <a
                    href={`/app/domains/${item.domainId}`}
                    className="font-medium text-brand-700 underline"
                  >
                    {item.displayName}
                  </a>
                  {item.groupName && (
                    <span className="text-supporting text-neutral-500">{item.groupName}</span>
                  )}
                  <span className="flex flex-wrap gap-1">
                    {item.attentionReasons.map((reason) => (
                      <StatusChip
                        key={reason}
                        tone="warning"
                        label={ATTENTION_REASON_LABEL[reason] ?? reason}
                      />
                    ))}
                  </span>
                  <a
                    href={`/app/domains/${item.domainId}#timeline`}
                    className="ml-auto text-supporting text-brand-700 underline"
                  >
                    View change
                  </a>
                </li>
              ))}
            </ul>
          )}
          <a
            href="/app/workspace/domains?attentionOnly=1"
            className="mt-3 inline-block text-supporting text-brand-700 underline"
          >
            View all in the attention queue
          </a>
        </div>
      </section>

      <section aria-labelledby="recent-changes-heading">
        <h2 id="recent-changes-heading" className="text-h2 text-neutral-950">
          Recent portfolio changes
        </h2>
        <div className="mt-4">
          {changes === null ? (
            <div className="h-32 animate-pulse rounded-card bg-neutral-100" aria-hidden="true" />
          ) : changes.length === 0 ? (
            <EmptyState
              title="No recent changes"
              description="Meaningful policy or registry changes will appear here."
            />
          ) : (
            <ul className="divide-y divide-neutral-200 rounded-card border border-neutral-200 bg-white">
              {changes.map((item) => (
                <li key={item.id} className="flex flex-col gap-1 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`/app/domains/${item.domainId}`}
                      className="font-medium text-brand-700 underline"
                    >
                      {item.displayName}
                    </a>
                    {item.groupName && (
                      <span className="text-supporting text-neutral-500">{item.groupName}</span>
                    )}
                    <span className="text-supporting text-neutral-500">
                      {new Date(item.observedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-supporting text-neutral-700">
                    {CHANGE_ORIGIN_LABEL[item.changeOrigin] ?? item.changeOrigin}: {item.summary}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="groups-heading">
        <h2 id="groups-heading" className="text-h2 text-neutral-950">
          Domain groups
        </h2>
        <div className="mt-4">
          {groups === null ? (
            <div className="h-16 animate-pulse rounded-card bg-neutral-100" aria-hidden="true" />
          ) : groups.length === 0 ? (
            <EmptyState
              title="No groups yet"
              description="Create a group to organise domains by client or brand."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((g) => (
                <a key={g.groupId} href={`/app/groups/${g.groupId}`}>
                  <Card>
                    <p className="font-medium text-neutral-950">{g.name}</p>
                    <p className="text-supporting text-neutral-600">
                      {g.domainCount} domain{g.domainCount === 1 ? "" : "s"}
                    </p>
                  </Card>
                </a>
              ))}
            </div>
          )}
          <a
            href="/app/groups"
            className="mt-3 inline-block text-supporting text-brand-700 underline"
          >
            Manage groups
          </a>
        </div>
      </section>
    </div>
  );
}
