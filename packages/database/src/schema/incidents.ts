import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./identity";

// Mirrors packages/database/migrations/0018_incidents.sql. See
// docs/architecture/INCIDENT_TRACKING_SYSTEM_DESIGN.md for the full design.
export const incidents = sqliteTable("incidents", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  publicSummary: text("public_summary").notNull(),
  severity: text("severity").notNull().$type<"minor" | "major" | "critical">(),
  status: text("status")
    .notNull()
    .$type<"investigating" | "identified" | "monitoring" | "resolved">()
    .default("investigating"),
  // JSON array of canonical component keys — see lib/status/components.ts.
  affectedComponents: text("affected_components").notNull(),
  isScheduledMaintenance: integer("is_scheduled_maintenance", { mode: "boolean" })
    .notNull()
    .default(false),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
  startsAt: text("starts_at").notNull(),
  resolvedAt: text("resolved_at"),
  // Nullable, ON DELETE SET NULL from the start — see admin_audit_logs /
  // system_notices for the same reasoning (migrations 0013-0015).
  createdByUserId: text("created_by_user_id").references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const incidentUpdates = sqliteTable("incident_updates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  incidentId: text("incident_id")
    .notNull()
    .references(() => incidents.id),
  status: text("status")
    .notNull()
    .$type<"investigating" | "identified" | "monitoring" | "resolved">(),
  message: text("message").notNull(),
  createdByUserId: text("created_by_user_id").references(() => users.id),
  createdAt: text("created_at").notNull(),
});
