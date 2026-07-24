import { useEffect, useState } from "react";
import { StatusChip } from "@crawlpact/ui";

type ComponentHealth = {
  name: string;
  status: "operational" | "degraded" | "maintenance";
  detail: string;
};

const TONE = { operational: "success", degraded: "error", maintenance: "warning" } as const;

/** SRS §28.10: internal health overview for API/D1/scheduler/registry/webhooks/auth. */
export function HealthOverview() {
  const [components, setComponents] = useState<ComponentHealth[] | null>(null);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    fetch("/api/admin/health")
      .then(
        (res) =>
          res.json() as Promise<{
            ok: boolean;
            data?: { components: ComponentHealth[] };
            error?: { message: string };
          }>,
      )
      .then((body) => {
        if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
        setComponents(body.data!.components);
      })
      .catch((err) => setError((err as Error).message));
  }, []);

  if (error) return <p className="text-supporting text-error">{error}</p>;
  if (!components) return <p className="text-supporting text-neutral-600">Loading…</p>;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {components.map((c) => (
        <div key={c.name} className="rounded-card border border-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-neutral-900">{c.name}</p>
            <StatusChip tone={TONE[c.status]} label={c.status} />
          </div>
          <p className="mt-2 text-supporting text-neutral-600">{c.detail}</p>
        </div>
      ))}
    </div>
  );
}
