import { desc, eq } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";

/**
 * Phase 17 minimal pilot cohort/participant CRUD — mirrors admin/users.ts's
 * plain-Drizzle style. Pilot membership never grants or implies a product
 * entitlement (no plan/subscription/domain-count field exists anywhere in
 * this file or the underlying schema) — see
 * docs/pilot/PHASE_17_PILOT_DATA_MODEL_DECISION.md.
 */

export type PilotCohortRow = typeof schema.pilotCohorts.$inferSelect;
export type PilotParticipantRow = typeof schema.pilotParticipants.$inferSelect;
export type PilotFeedbackRow = typeof schema.pilotFeedback.$inferSelect;

export async function listPilotCohorts(db: Database): Promise<PilotCohortRow[]> {
  return db.select().from(schema.pilotCohorts).orderBy(desc(schema.pilotCohorts.createdAt));
}

export async function getPilotCohort(db: Database, id: string): Promise<PilotCohortRow | null> {
  const [row] = await db
    .select()
    .from(schema.pilotCohorts)
    .where(eq(schema.pilotCohorts.id, id))
    .limit(1);
  return row ?? null;
}

export async function createPilotCohort(
  db: Database,
  params: { name: string; description?: string | null; createdByUserId: string },
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.pilotCohorts).values({
    id,
    name: params.name,
    description: params.description ?? null,
    status: "draft",
    createdByUserId: params.createdByUserId,
    createdAt: now,
  });
  return id;
}

export async function updatePilotCohortStatus(
  db: Database,
  id: string,
  status: PilotCohortRow["status"],
): Promise<void> {
  const now = new Date().toISOString();
  const patch: Partial<PilotCohortRow> = { status };
  if (status === "active") patch.startedAt = patch.startedAt ?? now;
  if (status === "completed" || status === "cancelled") patch.endedAt = now;
  await db.update(schema.pilotCohorts).set(patch).where(eq(schema.pilotCohorts.id, id));
}

export async function listPilotParticipants(
  db: Database,
  cohortId: string,
): Promise<PilotParticipantRow[]> {
  return db
    .select()
    .from(schema.pilotParticipants)
    .where(eq(schema.pilotParticipants.pilotCohortId, cohortId))
    .orderBy(desc(schema.pilotParticipants.createdAt));
}

/**
 * Associates an *existing* CrawlPact user with a cohort — manual Super
 * Admin lookup via the existing `searchUsers`, never an invite token (§36).
 * Throws (unique index) on duplicate association, which the API route
 * surfaces as a normal 500→caught error; a friendlier check-then-insert is
 * unnecessary for an admin-only, low-volume action.
 */
export async function addPilotParticipant(
  db: Database,
  params: {
    pilotCohortId: string;
    userId: string;
    segment: PilotParticipantRow["segment"];
    acquisitionSource?: PilotParticipantRow["acquisitionSource"];
    addedByAdminUserId: string;
  },
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.pilotParticipants).values({
    id,
    pilotCohortId: params.pilotCohortId,
    userId: params.userId,
    segment: params.segment,
    participationStatus: "joined",
    acquisitionSource: params.acquisitionSource ?? null,
    humanHelpCount: 0,
    joinedAt: now,
    addedByAdminUserId: params.addedByAdminUserId,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updatePilotParticipantStatus(
  db: Database,
  id: string,
  status: PilotParticipantRow["participationStatus"],
): Promise<void> {
  const now = new Date().toISOString();
  const patch: Partial<PilotParticipantRow> = { participationStatus: status, updatedAt: now };
  if (status === "withdrew" || status === "completed" || status === "disqualified")
    patch.endedAt = now;
  await db.update(schema.pilotParticipants).set(patch).where(eq(schema.pilotParticipants.id, id));
}

export async function removePilotParticipant(db: Database, id: string): Promise<void> {
  await db.delete(schema.pilotParticipants).where(eq(schema.pilotParticipants.id, id));
}

/** Records one meaningful human-help intervention (§79) — the narrative
 * itself belongs in the existing internal_user_notes mechanism
 * (addInternalNote), not duplicated here. */
export async function recordPilotHumanHelp(db: Database, participantId: string): Promise<void> {
  const [row] = await db
    .select({ humanHelpCount: schema.pilotParticipants.humanHelpCount })
    .from(schema.pilotParticipants)
    .where(eq(schema.pilotParticipants.id, participantId))
    .limit(1);
  if (!row) throw new Error(`Pilot participant "${participantId}" not found.`);
  await db
    .update(schema.pilotParticipants)
    .set({ humanHelpCount: row.humanHelpCount + 1, updatedAt: new Date().toISOString() })
    .where(eq(schema.pilotParticipants.id, participantId));
}

export async function listPilotFeedback(
  db: Database,
  cohortId: string,
): Promise<(PilotFeedbackRow & { participantId: string })[]> {
  const rows = await db
    .select({ feedback: schema.pilotFeedback, participantId: schema.pilotParticipants.id })
    .from(schema.pilotFeedback)
    .innerJoin(
      schema.pilotParticipants,
      eq(schema.pilotFeedback.pilotParticipantId, schema.pilotParticipants.id),
    )
    .where(eq(schema.pilotParticipants.pilotCohortId, cohortId))
    .orderBy(desc(schema.pilotFeedback.createdAt));
  return rows.map((r) => ({ ...r.feedback, participantId: r.participantId }));
}

/** Resolves the caller's own active pilot participant row(s) — used by the
 * authenticated feedback-submission route, never exposes another user's
 * participation. */
export async function getActivePilotParticipationsForUser(
  db: Database,
  userId: string,
): Promise<PilotParticipantRow[]> {
  return db
    .select()
    .from(schema.pilotParticipants)
    .where(eq(schema.pilotParticipants.userId, userId));
}

export type SubmitPilotFeedbackParams = {
  pilotParticipantId: string;
  category: PilotFeedbackRow["category"];
  usefulness?: PilotFeedbackRow["usefulness"];
  clarity?: PilotFeedbackRow["clarity"];
  difficulty?: PilotFeedbackRow["difficulty"];
  primaryValue?: PilotFeedbackRow["primaryValue"];
  blockingIssue?: PilotFeedbackRow["blockingIssue"];
  purchaseReason?: PilotFeedbackRow["purchaseReason"];
  nonPurchaseReason?: PilotFeedbackRow["nonPurchaseReason"];
  comment?: string | null;
};

/** `comment` is stored as plain text and only ever rendered through
 * ordinary JSX/Astro text interpolation (never `dangerouslySetInnerHTML`/
 * `set:html`) — see docs/security/PHASE_17_PILOT_SECURITY_AND_PRIVACY_THREAT_REVIEW.md. */
export async function submitPilotFeedback(
  db: Database,
  params: SubmitPilotFeedbackParams,
): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(schema.pilotFeedback).values({
    id,
    pilotParticipantId: params.pilotParticipantId,
    category: params.category,
    usefulness: params.usefulness ?? null,
    clarity: params.clarity ?? null,
    difficulty: params.difficulty ?? null,
    primaryValue: params.primaryValue ?? null,
    blockingIssue: params.blockingIssue ?? null,
    purchaseReason: params.purchaseReason ?? null,
    nonPurchaseReason: params.nonPurchaseReason ?? null,
    comment: params.comment ?? null,
    createdAt: new Date().toISOString(),
  });
  return id;
}
