import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { createD1TestHarness } from "./d1-harness";
import {
  addPilotParticipant,
  createPilotCohort,
  getActivePilotParticipationsForUser,
  listPilotFeedback,
  listPilotParticipants,
  recordPilotHumanHelp,
  removePilotParticipant,
  submitPilotFeedback,
  updatePilotParticipantStatus,
} from "../../src/lib/admin/pilots";
import { getPilotCohortMetrics } from "../../src/lib/admin/pilot-analytics";

/**
 * Phase 17 §180 required test set: cohort creation, participant
 * association, duplicate association, participant deletion/account
 * deletion, cohort/segment metrics, paid-conversion derivation, feedback
 * validation/XSS-safety, and no-entitlement-effect — all against real D1.
 */
describe("customer pilot cohort/participant/feedback (real D1)", () => {
  let db: Database;
  let dispose: () => Promise<void>;

  beforeEach(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    db = createDb(harness.db);

    const now = new Date().toISOString();
    await db.insert(schema.users).values([
      {
        id: "usr_pilot_admin",
        displayName: "Pilot Test Admin",
        status: "active",
        planId: "free",
        isAdmin: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "usr_pilot_participant_a",
        displayName: "Participant A",
        status: "active",
        planId: "free",
        isAdmin: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "usr_pilot_participant_b",
        displayName: "Participant B",
        status: "active",
        planId: "free",
        isAdmin: false,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  });

  afterEach(async () => {
    await dispose();
  });

  it("creates a cohort and associates a participant", async () => {
    const cohortId = await createPilotCohort(db, {
      name: "Pilot wave 1",
      createdByUserId: "usr_pilot_admin",
    });

    const participantId = await addPilotParticipant(db, {
      pilotCohortId: cohortId,
      userId: "usr_pilot_participant_a",
      segment: "agency",
      addedByAdminUserId: "usr_pilot_admin",
    });

    const participants = await listPilotParticipants(db, cohortId);
    expect(participants).toHaveLength(1);
    expect(participants[0]?.id).toBe(participantId);
    expect(participants[0]?.segment).toBe("agency");
    expect(participants[0]?.participationStatus).toBe("joined");
  });

  it("rejects a duplicate association of the same user to the same cohort", async () => {
    const cohortId = await createPilotCohort(db, {
      name: "Duplicate test cohort",
      createdByUserId: "usr_pilot_admin",
    });

    await addPilotParticipant(db, {
      pilotCohortId: cohortId,
      userId: "usr_pilot_participant_a",
      segment: "individual",
      addedByAdminUserId: "usr_pilot_admin",
    });

    await expect(
      addPilotParticipant(db, {
        pilotCohortId: cohortId,
        userId: "usr_pilot_participant_a",
        segment: "individual",
        addedByAdminUserId: "usr_pilot_admin",
      }),
    ).rejects.toThrow();
  });

  it("adding a participant never changes their plan (no entitlement coupling)", async () => {
    const cohortId = await createPilotCohort(db, {
      name: "Entitlement test cohort",
      createdByUserId: "usr_pilot_admin",
    });

    const [before] = await db
      .select({ planId: schema.users.planId })
      .from(schema.users)
      .where(eq(schema.users.id, "usr_pilot_participant_a"));

    await addPilotParticipant(db, {
      pilotCohortId: cohortId,
      userId: "usr_pilot_participant_a",
      segment: "agency",
      addedByAdminUserId: "usr_pilot_admin",
    });

    const [after] = await db
      .select({ planId: schema.users.planId })
      .from(schema.users)
      .where(eq(schema.users.id, "usr_pilot_participant_a"));

    expect(after?.planId).toBe(before?.planId);
    expect(after?.planId).toBe("free");
  });

  it("updates participant status and removes a participant", async () => {
    const cohortId = await createPilotCohort(db, {
      name: "Status test cohort",
      createdByUserId: "usr_pilot_admin",
    });
    const participantId = await addPilotParticipant(db, {
      pilotCohortId: cohortId,
      userId: "usr_pilot_participant_a",
      segment: "individual",
      addedByAdminUserId: "usr_pilot_admin",
    });

    await updatePilotParticipantStatus(db, participantId, "withdrew");
    let [row] = await db
      .select()
      .from(schema.pilotParticipants)
      .where(eq(schema.pilotParticipants.id, participantId));
    expect(row?.participationStatus).toBe("withdrew");
    expect(row?.endedAt).not.toBeNull();

    await removePilotParticipant(db, participantId);
    const remaining = await listPilotParticipants(db, cohortId);
    expect(remaining).toHaveLength(0);
  });

  it("records human-help interventions as a running count", async () => {
    const cohortId = await createPilotCohort(db, {
      name: "Support test cohort",
      createdByUserId: "usr_pilot_admin",
    });
    const participantId = await addPilotParticipant(db, {
      pilotCohortId: cohortId,
      userId: "usr_pilot_participant_a",
      segment: "individual",
      addedByAdminUserId: "usr_pilot_admin",
    });

    await recordPilotHumanHelp(db, participantId);
    await recordPilotHumanHelp(db, participantId);

    const [row] = await db
      .select({ humanHelpCount: schema.pilotParticipants.humanHelpCount })
      .from(schema.pilotParticipants)
      .where(eq(schema.pilotParticipants.id, participantId));
    expect(row?.humanHelpCount).toBe(2);
  });

  it("stores feedback verbatim (including HTML-shaped text) — safety is enforced at render time via JSX/Astro text escaping, never at storage time", async () => {
    const cohortId = await createPilotCohort(db, {
      name: "Feedback test cohort",
      createdByUserId: "usr_pilot_admin",
    });
    const participantId = await addPilotParticipant(db, {
      pilotCohortId: cohortId,
      userId: "usr_pilot_participant_a",
      segment: "individual",
      addedByAdminUserId: "usr_pilot_admin",
    });

    const hostileComment = '<script>alert("xss")</script>';
    await submitPilotFeedback(db, {
      pilotParticipantId: participantId,
      category: "onboarding",
      usefulness: "high",
      comment: hostileComment,
    });

    const feedback = await listPilotFeedback(db, cohortId);
    expect(feedback).toHaveLength(1);
    // Stored verbatim (a DB is not an XSS sanitizer) — the actual safety
    // guarantee is that no render path in this codebase uses
    // dangerouslySetInnerHTML/set:html (see the Phase 17 security review).
    expect(feedback[0]?.comment).toBe(hostileComment);
    expect(feedback[0]?.category).toBe("onboarding");
  });

  it("scopes getActivePilotParticipationsForUser to exactly the requested user — never another participant's rows", async () => {
    const cohortId = await createPilotCohort(db, {
      name: "Scoping test cohort",
      createdByUserId: "usr_pilot_admin",
    });
    await addPilotParticipant(db, {
      pilotCohortId: cohortId,
      userId: "usr_pilot_participant_a",
      segment: "individual",
      addedByAdminUserId: "usr_pilot_admin",
    });
    await addPilotParticipant(db, {
      pilotCohortId: cohortId,
      userId: "usr_pilot_participant_b",
      segment: "professional",
      addedByAdminUserId: "usr_pilot_admin",
    });

    const aParticipations = await getActivePilotParticipationsForUser(
      db,
      "usr_pilot_participant_a",
    );
    expect(aParticipations).toHaveLength(1);
    expect(aParticipations[0]?.userId).toBe("usr_pilot_participant_a");

    const bParticipations = await getActivePilotParticipationsForUser(
      db,
      "usr_pilot_participant_b",
    );
    expect(bParticipations).toHaveLength(1);
    expect(bParticipations[0]?.userId).toBe("usr_pilot_participant_b");
  });

  it("cascades pilot_participants and pilot_feedback away when the owning account is hard-deleted, without throwing", async () => {
    const cohortId = await createPilotCohort(db, {
      name: "Deletion test cohort",
      createdByUserId: "usr_pilot_admin",
    });
    const participantId = await addPilotParticipant(db, {
      pilotCohortId: cohortId,
      userId: "usr_pilot_participant_a",
      segment: "individual",
      addedByAdminUserId: "usr_pilot_admin",
    });
    await submitPilotFeedback(db, { pilotParticipantId: participantId, category: "onboarding" });

    await db.delete(schema.users).where(eq(schema.users.id, "usr_pilot_participant_a"));

    const remainingParticipants = await listPilotParticipants(db, cohortId);
    expect(remainingParticipants).toHaveLength(0);
    const remainingFeedback = await listPilotFeedback(db, cohortId);
    expect(remainingFeedback).toHaveLength(0);

    // The cohort itself and the admin's own reference both survive —
    // created_by_user_id is a SET NULL actor reference, not the participant.
    const [cohort] = await db
      .select()
      .from(schema.pilotCohorts)
      .where(eq(schema.pilotCohorts.id, cohortId));
    expect(cohort).toBeDefined();
  });

  describe("cohort metrics derivation (authoritative sources only)", () => {
    it("computes activated/monitoring/paid-conversion ratios from domains and subscriptions, never from a duplicated pilot field", async () => {
      const cohortId = await createPilotCohort(db, {
        name: "Metrics test cohort",
        createdByUserId: "usr_pilot_admin",
      });
      await addPilotParticipant(db, {
        pilotCohortId: cohortId,
        userId: "usr_pilot_participant_a",
        segment: "individual",
        addedByAdminUserId: "usr_pilot_admin",
      });
      await addPilotParticipant(db, {
        pilotCohortId: cohortId,
        userId: "usr_pilot_participant_b",
        segment: "agency",
        addedByAdminUserId: "usr_pilot_admin",
      });

      const now = new Date().toISOString();
      // Participant A: activated (has a scanned domain) and monitoring enabled.
      await db.insert(schema.domains).values({
        id: "dom_a",
        ownerUserId: "usr_pilot_participant_a",
        displayName: "example.com",
        canonicalOrigin: "https://example.com",
        originalInput: "example.com",
        preset: "maximum_ai_visibility",
        monitoringState: "active",
        monitoringFrequency: "weekly",
        lastScanId: "scan_a",
        createdAt: now,
        updatedAt: now,
      });

      // Participant A: also a real paid subscription.
      await db.insert(schema.billingCustomers).values({
        id: "bc_a",
        userId: "usr_pilot_participant_a",
        paddleCustomerId: "ctm_test_a",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(schema.subscriptions).values({
        id: "sub_a",
        billingCustomerId: "bc_a",
        paddleSubscriptionId: "sub_paddle_a",
        planId: "solo",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      // Participant B: no domain, no subscription — neither activated nor paid.
      const metrics = await getPilotCohortMetrics(db, cohortId);
      expect(metrics.totalParticipants).toBe(2);
      expect(metrics.activated).toEqual({ numerator: 1, denominator: 2, percent: 50 });
      expect(metrics.monitoringEnabled).toEqual({ numerator: 1, denominator: 2, percent: 50 });
      expect(metrics.paidConversion).toEqual({ numerator: 1, denominator: 2, percent: 50 });
      expect(metrics.segmentCounts.individual).toBe(1);
      expect(metrics.segmentCounts.agency).toBe(1);
    });

    it("returns zero-denominator ratios for an empty cohort rather than throwing", async () => {
      const cohortId = await createPilotCohort(db, {
        name: "Empty cohort",
        createdByUserId: "usr_pilot_admin",
      });
      const metrics = await getPilotCohortMetrics(db, cohortId);
      expect(metrics.totalParticipants).toBe(0);
      expect(metrics.activated).toEqual({ numerator: 0, denominator: 0, percent: null });
    });
  });
});
