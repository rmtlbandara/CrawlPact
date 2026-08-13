import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { users } from "./identity";

// Mirrors packages/database/migrations/0036_customer_pilot.sql.
export const pilotCohorts = sqliteTable("pilot_cohorts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status")
    .notNull()
    .$type<"draft" | "recruiting" | "active" | "analysis" | "completed" | "cancelled">()
    .default("draft"),
  startedAt: text("started_at"),
  endedAt: text("ended_at"),
  createdByUserId: text("created_by_user_id").references(() => users.id),
  createdAt: text("created_at").notNull(),
});

export const pilotParticipants = sqliteTable(
  "pilot_participants",
  {
    id: text("id").primaryKey(),
    pilotCohortId: text("pilot_cohort_id")
      .notNull()
      .references(() => pilotCohorts.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    segment: text("segment")
      .notNull()
      .$type<"individual" | "professional" | "agency" | "multi_site" | "other">(),
    participationStatus: text("participation_status")
      .notNull()
      .$type<
        "invited" | "joined" | "active" | "completed" | "withdrew" | "inactive" | "disqualified"
      >()
      .default("invited"),
    acquisitionSource: text("acquisition_source").$type<
      "direct_owner_outreach" | "existing_contact" | "referral" | "organic_interest" | "other"
    >(),
    humanHelpCount: integer("human_help_count").notNull().default(0),
    joinedAt: text("joined_at"),
    activatedAt: text("activated_at"),
    endedAt: text("ended_at"),
    addedByAdminUserId: text("added_by_admin_user_id").references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_pilot_participants_cohort_user").on(table.pilotCohortId, table.userId),
  ],
);

export const pilotFeedback = sqliteTable("pilot_feedback", {
  id: text("id").primaryKey(),
  pilotParticipantId: text("pilot_participant_id")
    .notNull()
    .references(() => pilotParticipants.id),
  category: text("category")
    .notNull()
    .$type<
      | "onboarding"
      | "audit_clarity"
      | "evidence"
      | "recommendation"
      | "saved_domain"
      | "timeline"
      | "monitoring"
      | "notification"
      | "report_sharing"
      | "agency_workspace"
      | "pricing"
      | "billing"
      | "reliability"
      | "support"
      | "feature_request"
      | "other"
    >(),
  usefulness: text("usefulness").$type<"low" | "medium" | "high">(),
  clarity: text("clarity").$type<"clear" | "unclear">(),
  difficulty: text("difficulty").$type<"easy" | "moderate" | "hard">(),
  primaryValue: text("primary_value").$type<
    | "crawler_matrix"
    | "evidence_findings"
    | "recommended_configuration"
    | "saved_history"
    | "monitoring"
    | "timeline_attribution"
    | "reports_sharing"
    | "agency_workflows"
  >(),
  blockingIssue: text("blocking_issue").$type<"none" | "partial" | "blocked">(),
  purchaseReason: text("purchase_reason").$type<
    | "monitoring"
    | "portfolio"
    | "evidence"
    | "time_saving"
    | "client_reporting"
    | "change_detection"
    | "governance"
    | "other"
  >(),
  nonPurchaseReason: text("non_purchase_reason").$type<
    | "no_current_need"
    | "free_is_sufficient"
    | "price"
    | "missing_capability"
    | "trust"
    | "unclear_value"
    | "too_few_domains"
    | "existing_solution"
    | "billing_friction"
    | "not_decision_maker"
    | "other"
  >(),
  comment: text("comment"),
  createdAt: text("created_at").notNull(),
});
