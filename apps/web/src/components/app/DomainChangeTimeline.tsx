import { useEffect, useState } from "react";
import { Button, StatusChip } from "@crawlpact/ui";
import type { StatusTone } from "@crawlpact/ui";

type TimelineEvent = {
  id: string;
  eventType: string;
  changeOrigin: string;
  attentionLevel: "informational" | "review_recommended" | "high_attention";
  observedAt: string;
  previousScanId: string | null;
  currentScanId: string | null;
  affectedPurposes: string[];
  findingCounts: Record<string, number>;
  summary: string;
  completeness: "complete" | "partial";
};

type RetentionBoundary = {
  retentionDays: number;
  retentionMonths: number;
  oldestRetainedScanAt: string | null;
  hasExpiredHistory: boolean;
};

const ORIGIN_LABEL: Record<string, string> = {
  website_policy: "Website-policy change",
  registry_driven: "Registry-driven change",
  mixed: "Mixed change",
  operational: "Operational change",
  uncertain: "Uncertain cause",
  baseline: "Baseline established",
};

const ATTENTION_TONE: Record<TimelineEvent["attentionLevel"], StatusTone> = {
  informational: "info",
  review_recommended: "warning",
  high_attention: "error",
};

const ATTENTION_LABEL: Record<TimelineEvent["attentionLevel"], string> = {
  informational: "Informational",
  review_recommended: "Review recommended",
  high_attention: "High attention",
};

async function fetchJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url);
  const body = (await response.json()) as { ok: boolean; data?: T };
  return body.ok ? (body.data ?? null) : null;
}

export function DomainChangeTimeline({ domainId }: { domainId: string }) {
  const [events, setEvents] = useState<TimelineEvent[] | null>(null);
  const [retentionBoundary, setRetentionBoundary] = useState<RetentionBoundary | null>(null);
  const [cursor, setCursor] = useState<{ observedAt: string; id: string } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  async function load(after?: { observedAt: string; id: string } | null) {
    const params = new URLSearchParams();
    if (after) {
      params.set("cursorObservedAt", after.observedAt);
      params.set("cursorId", after.id);
    }
    const data = await fetchJson<{
      events: TimelineEvent[];
      nextCursor: { observedAt: string; id: string } | null;
      retentionBoundary: RetentionBoundary;
    }>(`/api/domains/${domainId}/timeline?${params.toString()}`);
    if (!data) return;
    setRetentionBoundary(data.retentionBoundary);
    setEvents((prev) => (after ? [...(prev ?? []), ...data.events] : data.events));
    setCursor(data.nextCursor);
  }

  useEffect(() => {
    void load(null);
  }, [domainId]);

  async function handleLoadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      await load(cursor);
    } finally {
      setLoadingMore(false);
    }
  }

  if (events === null) {
    return (
      <div aria-live="polite" aria-busy="true">
        <span className="sr-only">Loading change timeline…</span>
        <div className="h-24 animate-pulse rounded-card bg-neutral-100" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {events.length === 0 ? (
        <p className="text-body text-neutral-600">
          No material policy change was detected within the available retained history.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {events.map((event) => (
            <li key={event.id} className="rounded-card border border-neutral-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip
                  tone={ATTENTION_TONE[event.attentionLevel]}
                  label={ATTENTION_LABEL[event.attentionLevel]}
                />
                <span className="text-supporting font-medium text-neutral-800">
                  {ORIGIN_LABEL[event.changeOrigin] ?? event.changeOrigin}
                </span>
                <time
                  dateTime={event.observedAt}
                  className="ml-auto text-supporting text-neutral-500"
                >
                  {new Date(event.observedAt).toLocaleString()}
                </time>
              </div>
              <p className="mt-2 text-body text-neutral-800">{event.summary}</p>
              {event.completeness === "partial" && (
                <p className="mt-1 text-supporting text-neutral-500">
                  This comparison used an incomplete scan — treat it as limited.
                </p>
              )}
              {event.affectedPurposes.length > 0 && (
                <p className="mt-1 text-supporting text-neutral-600">
                  Affected: {event.affectedPurposes.join(", ")}
                </p>
              )}
              {event.previousScanId && event.currentScanId && (
                <a
                  href={`/app/domains/${domainId}/compare/${event.previousScanId}/${event.currentScanId}`}
                  className="mt-2 inline-block text-supporting font-medium text-brand-700 underline"
                >
                  View comparison
                </a>
              )}
            </li>
          ))}
        </ol>
      )}

      {retentionBoundary && (
        <p className="text-supporting text-neutral-500">
          This account retains domain audit history for {retentionBoundary.retentionMonths} month
          {retentionBoundary.retentionMonths === 1 ? "" : "s"}.
          {retentionBoundary.hasExpiredHistory &&
            " Earlier scan details are outside the retained history for this account."}
        </p>
      )}

      {cursor && (
        <Button variant="secondary" isLoading={loadingMore} onClick={() => void handleLoadMore()}>
          Load earlier changes
        </Button>
      )}
    </div>
  );
}
