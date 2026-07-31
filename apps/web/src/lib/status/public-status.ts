import { desc, eq } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { getComponentHealth, getSystemStatusSummary } from "../admin/health";
import { STATUS_COMPONENTS, type StatusComponentKey } from "./components";

/**
 * The public status adapter (docs/architecture/INCIDENT_TRACKING_SYSTEM_DESIGN.md §6-7). Combines
 * the existing internal health signals (unchanged) with admin-curated incidents into the richer
 * six-state public vocabulary. Deliberately separate from `lib/admin/incidents.ts` / `lib/admin/health.ts`
 * — this module only ever reads `is_public = 1` rows and never returns anything the internal-only
 * modules expose (exact event counts, job names, etc.), so there is one place responsible for the
 * "never leak internal detail to the public page" boundary rather than relying on every caller to
 * remember it.
 */

export type PublicStatusLevel =
  | "operational"
  | "degraded_performance"
  | "partial_outage"
  | "major_outage"
  | "maintenance"
  | "status_unavailable";

export type PublicIncident = {
  id: string;
  title: string;
  publicSummary: string;
  severity: "minor" | "major" | "critical";
  status: "investigating" | "identified" | "monitoring" | "resolved";
  affectedComponents: StatusComponentKey[];
  isScheduledMaintenance: boolean;
  startsAt: string;
  resolvedAt: string | null;
  updates: { status: string; message: string; createdAt: string }[];
};

export type PublicComponentStatus = {
  key: StatusComponentKey;
  label: string;
  status: PublicStatusLevel;
  detail: string | null;
};

export type PublicStatusReport = {
  overall: PublicStatusLevel;
  checkedAt: string;
  components: PublicComponentStatus[];
  currentIncidents: PublicIncident[];
  scheduledMaintenance: PublicIncident[];
  recentlyResolved: PublicIncident[];
};

const SEVERITY_LEVEL: Record<"minor" | "major" | "critical", PublicStatusLevel> = {
  minor: "degraded_performance",
  major: "partial_outage",
  critical: "major_outage",
};

// An incident can only make a component's displayed status worse than the
// internal baseline, never better — see design doc §6.
const LEVEL_SEVERITY_RANK: Record<PublicStatusLevel, number> = {
  operational: 0,
  maintenance: 1,
  degraded_performance: 2,
  partial_outage: 3,
  major_outage: 4,
  status_unavailable: 5,
};

function worse(a: PublicStatusLevel, b: PublicStatusLevel): PublicStatusLevel {
  return LEVEL_SEVERITY_RANK[a] >= LEVEL_SEVERITY_RANK[b] ? a : b;
}

async function loadPublicIncidents(db: Database, statusFilter: "active" | "resolved") {
  const rows = await db
    .select()
    .from(schema.incidents)
    .where(eq(schema.incidents.isPublic, true))
    .orderBy(desc(schema.incidents.createdAt));

  const filtered = rows.filter((row) =>
    statusFilter === "active" ? row.status !== "resolved" : row.status === "resolved",
  );

  const withUpdates: PublicIncident[] = [];
  for (const row of filtered) {
    const updates = await db
      .select()
      .from(schema.incidentUpdates)
      .where(eq(schema.incidentUpdates.incidentId, row.id))
      .orderBy(schema.incidentUpdates.createdAt);
    withUpdates.push({
      id: row.id,
      title: row.title,
      publicSummary: row.publicSummary,
      severity: row.severity as "minor" | "major" | "critical",
      status: row.status as PublicIncident["status"],
      affectedComponents: JSON.parse(row.affectedComponents) as StatusComponentKey[],
      isScheduledMaintenance: row.isScheduledMaintenance,
      startsAt: row.startsAt,
      resolvedAt: row.resolvedAt,
      updates: updates.map((u) => ({
        status: u.status,
        message: u.message,
        createdAt: u.createdAt,
      })),
    });
  }
  return withUpdates;
}

// Internal health checks that map cleanly onto a specific public component.
// Anything not listed here (e.g. the data-retention job) has no direct
// public-component owner and only feeds the overall internal baseline.
const INTERNAL_COMPONENT_MAP: Partial<Record<StatusComponentKey, string>> = {
  scheduled_monitoring: "Scheduler / monitoring sweep",
  billing_checkout: "Paddle webhook processing",
  accounts_passkeys: "Authentication",
};

export async function getPublicStatus(db: Database): Promise<PublicStatusReport> {
  const checkedAt = new Date().toISOString();

  let baselineByComponent = new Map<StatusComponentKey, PublicStatusLevel>();
  let foundationalUnavailable = false;

  try {
    const [summary, componentHealth] = await Promise.all([
      getSystemStatusSummary(db),
      getComponentHealth(db),
    ]);

    const foundationalLevel: PublicStatusLevel =
      summary.status === "maintenance" ? "maintenance" : "operational";

    for (const component of STATUS_COMPONENTS) {
      const internalName = INTERNAL_COMPONENT_MAP[component.key];
      const match = internalName ? componentHealth.find((c) => c.name === internalName) : null;
      const level: PublicStatusLevel = match
        ? match.status === "maintenance"
          ? "maintenance"
          : match.status === "degraded"
            ? "degraded_performance"
            : "operational"
        : foundationalLevel;
      baselineByComponent.set(component.key, level);
    }
  } catch {
    // A failed health check must never read as "operational" — see design
    // doc §6. Every component is unavailable until this can be evaluated.
    foundationalUnavailable = true;
    baselineByComponent = new Map(
      STATUS_COMPONENTS.map((c) => [c.key, "status_unavailable" as PublicStatusLevel]),
    );
  }

  let currentIncidents: PublicIncident[] = [];
  let scheduledMaintenance: PublicIncident[] = [];
  let recentlyResolved: PublicIncident[] = [];
  try {
    const active = await loadPublicIncidents(db, "active");
    currentIncidents = active.filter((i) => !i.isScheduledMaintenance);
    scheduledMaintenance = active.filter((i) => i.isScheduledMaintenance);
    recentlyResolved = (await loadPublicIncidents(db, "resolved")).slice(0, 10);
  } catch {
    // Incidents failing to load is itself a status-unavailable condition,
    // not silently "no incidents" (which would read as falsely reassuring).
    foundationalUnavailable = true;
  }

  const componentLevels = new Map<StatusComponentKey, PublicStatusLevel>(baselineByComponent);
  for (const incident of [...currentIncidents, ...scheduledMaintenance]) {
    const incidentLevel = incident.isScheduledMaintenance
      ? "maintenance"
      : SEVERITY_LEVEL[incident.severity];
    for (const key of incident.affectedComponents) {
      const current = componentLevels.get(key) ?? "operational";
      componentLevels.set(key, worse(current, incidentLevel));
    }
  }

  const components: PublicComponentStatus[] = STATUS_COMPONENTS.map((c) => ({
    key: c.key,
    label: c.label,
    status: componentLevels.get(c.key) ?? "status_unavailable",
    detail: null,
  }));

  const overall = foundationalUnavailable
    ? "status_unavailable"
    : components.reduce((acc, c) => worse(acc, c.status), "operational" as PublicStatusLevel);

  return {
    overall,
    checkedAt,
    components,
    currentIncidents,
    scheduledMaintenance,
    recentlyResolved,
  };
}
