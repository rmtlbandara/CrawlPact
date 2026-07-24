import { useEffect, useState } from "react";
import { Alert, StatusChip } from "@crawlpact/ui";

type Analytics = {
  mostFrequent: { code: string; count: number }[];
  bySeverity: { severity: string; count: number }[];
  byCrawler: { crawlerId: string | null; crawlerName: string | null; count: number }[];
  byPreset: { preset: string; count: number }[];
  byPlan: { planId: string; count: number }[];
  newlyIntroduced: { code: string; firstSeenAt: string }[];
  dismissalTrackingAvailable: boolean;
  dismissalTrackingNote: string;
};

const SEVERITY_TONE: Record<string, "error" | "warning" | "info"> = {
  critical: "error",
  high: "error",
  medium: "warning",
  low: "info",
  information: "info",
};

/** SRS §28.12: finding/ruleset analytics (30-day window), never fabricating
 * the one metric — dismissal/dispute rate — the product can't yet compute. */
export function FindingAnalyticsDashboard() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    fetch("/api/admin/findings?range=30d")
      .then(
        (res) =>
          res.json() as Promise<{ ok: boolean; data?: Analytics; error?: { message: string } }>,
      )
      .then((body) => {
        if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
        setData(body.data ?? null);
      })
      .catch((err) => setError((err as Error).message));
  }, []);

  if (error) return <p className="text-supporting text-error">{error}</p>;
  if (!data) return <p className="text-supporting text-neutral-600">Loading…</p>;

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="text-h3 text-neutral-950">Most frequent findings (30d)</h2>
        <ul className="mt-3 divide-y divide-neutral-200 rounded-card border border-neutral-200 bg-white">
          {data.mostFrequent.length === 0 && (
            <li className="p-4 text-supporting text-neutral-600">None in this range.</li>
          )}
          {data.mostFrequent.map((f) => (
            <li key={f.code} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="font-mono text-body text-neutral-800">{f.code}</span>
              <span className="text-supporting text-neutral-600">{f.count}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-h3 text-neutral-950">By severity</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {data.bySeverity.map((s) => (
            <StatusChip
              key={s.severity}
              tone={SEVERITY_TONE[s.severity] ?? "info"}
              label={`${s.severity}: ${s.count}`}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-h3 text-neutral-950">By crawler</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {data.byCrawler.map((c) => (
            <StatusChip
              key={c.crawlerId ?? "none"}
              tone="info"
              label={`${c.crawlerName ?? "Unattributed"}: ${c.count}`}
            />
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <section>
          <h2 className="text-h3 text-neutral-950">By preset</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {data.byPreset.map((p) => (
              <li key={p.preset} className="flex justify-between text-supporting text-neutral-700">
                <span>{p.preset}</span>
                <span>{p.count}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-h3 text-neutral-950">By plan</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {data.byPlan.map((p) => (
              <li key={p.planId} className="flex justify-between text-supporting text-neutral-700">
                <span>{p.planId}</span>
                <span>{p.count}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section>
        <h2 className="text-h3 text-neutral-950">Newly introduced findings (30d)</h2>
        <p className="mt-1 text-supporting text-neutral-600">
          Finding codes first seen in this window.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {data.newlyIntroduced.length === 0 && (
            <p className="text-supporting text-neutral-600">None.</p>
          )}
          {data.newlyIntroduced.map((n) => (
            <StatusChip key={n.code} tone="success" label={n.code} />
          ))}
        </ul>
      </section>

      {!data.dismissalTrackingAvailable && (
        <Alert tone="info" title="Dismissal/dispute rate not available">
          {data.dismissalTrackingNote}
        </Alert>
      )}
    </div>
  );
}
