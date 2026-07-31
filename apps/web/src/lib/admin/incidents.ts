import { desc, eq } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import type { StatusComponentKey } from "../status/components";

export type IncidentStatus = "investigating" | "identified" | "monitoring" | "resolved";
export type IncidentSeverity = "minor" | "major" | "critical";

/** Super Admin incident management — see docs/architecture/INCIDENT_TRACKING_SYSTEM_DESIGN.md. */
export async function listIncidents(db: Database) {
  const rows = await db.select().from(schema.incidents).orderBy(desc(schema.incidents.createdAt));
  return rows.map((row) => ({
    ...row,
    affectedComponents: JSON.parse(row.affectedComponents) as StatusComponentKey[],
  }));
}

export async function listIncidentUpdates(db: Database, incidentId: string) {
  return db
    .select()
    .from(schema.incidentUpdates)
    .where(eq(schema.incidentUpdates.incidentId, incidentId))
    .orderBy(schema.incidentUpdates.createdAt);
}

export async function createIncident(
  db: Database,
  params: {
    title: string;
    publicSummary: string;
    severity: IncidentSeverity;
    affectedComponents: StatusComponentKey[];
    isScheduledMaintenance: boolean;
    isPublic: boolean;
    startsAt: string;
    initialStatus: IncidentStatus;
    initialMessage: string;
    createdByUserId: string;
  },
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.incidents).values({
    id,
    title: params.title,
    publicSummary: params.publicSummary,
    severity: params.severity,
    status: params.initialStatus,
    affectedComponents: JSON.stringify(params.affectedComponents),
    isScheduledMaintenance: params.isScheduledMaintenance,
    isPublic: params.isPublic,
    startsAt: params.startsAt,
    resolvedAt: params.initialStatus === "resolved" ? now : null,
    createdByUserId: params.createdByUserId,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.incidentUpdates).values({
    incidentId: id,
    status: params.initialStatus,
    message: params.initialMessage,
    createdByUserId: params.createdByUserId,
    createdAt: now,
  });
  return id;
}

export async function addIncidentUpdate(
  db: Database,
  params: {
    incidentId: string;
    status: IncidentStatus;
    message: string;
    createdByUserId: string;
  },
): Promise<void> {
  const now = new Date().toISOString();
  await db.insert(schema.incidentUpdates).values({
    incidentId: params.incidentId,
    status: params.status,
    message: params.message,
    createdByUserId: params.createdByUserId,
    createdAt: now,
  });
  await db
    .update(schema.incidents)
    .set({
      status: params.status,
      updatedAt: now,
      resolvedAt: params.status === "resolved" ? now : null,
    })
    .where(eq(schema.incidents.id, params.incidentId));
}
