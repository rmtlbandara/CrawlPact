import { useEffect, useState } from "react";
import { StatusChip, type StatusTone } from "@crawlpact/ui";

type ComponentHealth = {
  name: string;
  status: "operational" | "degraded" | "maintenance";
  detail: string;
};

type PublicStatusLevel =
  | "operational"
  | "degraded_performance"
  | "partial_outage"
  | "major_outage"
  | "maintenance"
  | "status_unavailable";

type InternalStatus = "operational" | "degraded" | "maintenance";

type ComponentStatusOverview = {
  key: string;
  label: string;
  publicStatus: PublicStatusLevel;
  activeIncident: { id: string; title: string } | null;
  internalStatus: InternalStatus | null;
  internalReason: string | null;
  publicImpact: boolean | null;
  verificationSource: string | null;
};

type StatusOverview = {
  checkedAt: string;
  publicOverall: PublicStatusLevel;
  internalOverall: InternalStatus;
  hasPublicImpact: boolean;
  activePublicIncidentCount: number;
  internalWarningCount: number;
  components: ComponentStatusOverview[];
};

const INTERNAL_TONE: Record<InternalStatus, StatusTone> = {
  operational: "success",
  degraded: "error",
  maintenance: "warning",
};

const PUBLIC_TONE: Record<PublicStatusLevel, StatusTone> = {
  operational: "success",
  degraded_performance: "warning",
  partial_outage: "warning",
  major_outage: "critical",
  maintenance: "warning",
  status_unavailable: "unknown",
};

const PUBLIC_LABEL: Record<PublicStatusLevel, string> = {
  operational: "Operational",
  degraded_performance: "Degraded performance",
  partial_outage: "Partial outage",
  major_outage: "Major outage",
  maintenance: "Maintenance",
  status_unavailable: "Status unavailable",
};

function formatTimestamp(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, " UTC");
}

/**
 * SRS §28.10: internal health overview for API/D1/scheduler/registry/
 * webhooks/auth, extended by the public-status-and-changelog trust
 * correction to also show — clearly labelled side by side, never as two
 * unlabelled badges — what the public `/status` page shows for the same
 * component, and whether an internal concern is currently judged to have
 * real public impact. Internal reasons/verification sources are only ever
 * rendered here, an authenticated Super Admin surface — never on the
 * public page.
 */
export function HealthOverview() {
  const [components, setComponents] = useState<ComponentHealth[] | null>(null);
  const [overview, setOverview] = useState<StatusOverview | null>(null);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    fetch("/api/admin/health")
      .then(
        (res) =>
          res.json() as Promise<{
            ok: boolean;
            data?: { components: ComponentHealth[]; statusOverview: StatusOverview };
            error?: { message: string };
          }>,
      )
      .then((body) => {
        if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
        setComponents(body.data!.components);
        setOverview(body.data!.statusOverview);
      })
      .catch((err) => setError((err as Error).message));
  }, []);

  if (error) return <p className="text-supporting text-error">{error}</p>;
  if (!components || !overview) return <p className="text-supporting text-neutral-600">Loading…</p>;

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="status-overview-heading">
        <h2 id="status-overview-heading" className="text-card-heading text-neutral-950">
          Overall status
        </h2>
        <p className="mt-1 text-supporting text-neutral-600">
          The public value is exactly what visitors see on <code>/status</code> right now; the
          internal value additionally reflects administrative/background-job concerns with no
          current effect on visitors.
        </p>
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-card border border-neutral-200 bg-white p-4">
            <dt className="text-supporting text-neutral-500">Public overall status</dt>
            <dd className="mt-2">
              <StatusChip
                tone={PUBLIC_TONE[overview.publicOverall]}
                label={PUBLIC_LABEL[overview.publicOverall]}
              />
            </dd>
          </div>
          <div className="rounded-card border border-neutral-200 bg-white p-4">
            <dt className="text-supporting text-neutral-500">Internal overall state</dt>
            <dd className="mt-2">
              <StatusChip
                tone={INTERNAL_TONE[overview.internalOverall]}
                label={overview.internalOverall}
              />
            </dd>
          </div>
          <div className="rounded-card border border-neutral-200 bg-white p-4">
            <dt className="text-supporting text-neutral-500">Public impact right now</dt>
            <dd className="mt-2 font-medium text-neutral-900">
              {overview.hasPublicImpact ? "Yes" : "No"}
            </dd>
          </div>
          <div className="rounded-card border border-neutral-200 bg-white p-4">
            <dt className="text-supporting text-neutral-500">Active public incidents</dt>
            <dd className="mt-2 font-medium text-neutral-900">
              {overview.activePublicIncidentCount}
            </dd>
          </div>
          <div className="rounded-card border border-neutral-200 bg-white p-4">
            <dt className="text-supporting text-neutral-500">
              Internal warnings (no public impact)
            </dt>
            <dd className="mt-2 font-medium text-neutral-900">{overview.internalWarningCount}</dd>
          </div>
          <div className="rounded-card border border-neutral-200 bg-white p-4">
            <dt className="text-supporting text-neutral-500">Last evaluated</dt>
            <dd className="mt-2 font-medium text-neutral-900">
              {formatTimestamp(overview.checkedAt)}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="status-components-heading">
        <h2 id="status-components-heading" className="text-card-heading text-neutral-950">
          Public status components
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {overview.components.map((c) => (
            <div key={c.key} className="rounded-card border border-neutral-200 bg-white p-4">
              <p className="font-medium text-neutral-900">{c.label}</p>
              <dl className="mt-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-supporting text-neutral-500">Public:</dt>
                  <dd>
                    <StatusChip
                      tone={PUBLIC_TONE[c.publicStatus]}
                      label={PUBLIC_LABEL[c.publicStatus]}
                    />
                  </dd>
                </div>
                {c.internalStatus && (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-supporting text-neutral-500">Internal:</dt>
                    <dd>
                      <StatusChip tone={INTERNAL_TONE[c.internalStatus]} label={c.internalStatus} />
                    </dd>
                  </div>
                )}
                {c.internalStatus && (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-supporting text-neutral-500">Public impact:</dt>
                    <dd className="text-supporting font-medium text-neutral-800">
                      {c.publicImpact ? "Yes" : "No"}
                    </dd>
                  </div>
                )}
              </dl>
              {c.internalReason && (
                <p className="mt-2 text-supporting text-neutral-600">{c.internalReason}</p>
              )}
              {c.verificationSource && (
                <p className="mt-1 text-metadata text-neutral-400">
                  Source: {c.verificationSource}
                </p>
              )}
              {c.activeIncident && (
                <p className="mt-2 text-supporting font-medium text-warning">
                  Active incident: {c.activeIncident.title}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="internal-health-heading">
        <h2 id="internal-health-heading" className="text-card-heading text-neutral-950">
          Internal system checks
        </h2>
        <p className="mt-1 text-supporting text-neutral-600">
          Every internal health check this page evaluates, including ones with no public-facing
          component at all (D1, the retention job).
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {components.map((c) => (
            <div key={c.name} className="rounded-card border border-neutral-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-neutral-900">{c.name}</p>
                <StatusChip tone={INTERNAL_TONE[c.status]} label={c.status} />
              </div>
              <p className="mt-2 text-supporting text-neutral-600">{c.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
