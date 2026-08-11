import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./identity";

// Mirrors packages/database/migrations/0007_admin_security.sql.
export const adminAuditLogs = sqliteTable("admin_audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // Nullable since migration 0015: survives the administrator's own
  // account being deleted — the audit log entry itself must be retained
  // (SRS §34: "administrative logs, at least 24 months") independent of
  // whether the acting admin's account still exists.
  administratorUserId: text("administrator_user_id").references(() => users.id),
  action: text("action").notNull(),
  target: text("target").notNull(),
  previousState: text("previous_state"),
  newState: text("new_state"),
  reason: text("reason").notNull(),
  requestId: text("request_id").notNull(),
  createdAt: text("created_at").notNull(),
});

export const blockedTargets = sqliteTable("blocked_targets", {
  id: text("id").primaryKey(),
  targetPattern: text("target_pattern").notNull(),
  reason: text("reason").notNull(),
  // Nullable since migration 0015 — see adminAuditLogs above for the same
  // reasoning.
  blockedByUserId: text("blocked_by_user_id").references(() => users.id),
  createdAt: text("created_at").notNull(),
  removedAt: text("removed_at"),
});

export const securityEvents = sqliteTable("security_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventType: text("event_type")
    .notNull()
    .$type<
      | "unsafe_scan_attempt"
      | "rate_limit"
      | "auth_failure"
      | "recovery_code_failure"
      | "suspicious_session"
      | "invalid_paddle_signature"
      | "replayed_webhook"
      | "admin_security_action"
    >(),
  userId: text("user_id").references(() => users.id),
  ipHash: text("ip_hash"),
  target: text("target"),
  details: text("details"),
  createdAt: text("created_at").notNull(),
  resolvedAt: text("resolved_at"),
  resolvedByUserId: text("resolved_by_user_id").references(() => users.id),
  resolutionNote: text("resolution_note"),
});

export const scheduledJobRuns = sqliteTable("scheduled_job_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobName: text("job_name").notNull(),
  cronExpression: text("cron_expression"),
  status: text("status")
    .notNull()
    .$type<"running" | "completed" | "completed_with_errors" | "failed">(),
  domainsSelected: integer("domains_selected").notNull().default(0),
  scansCreated: integer("scans_created").notNull().default(0),
  scansCompleted: integer("scans_completed").notNull().default(0),
  scansFailed: integer("scans_failed").notNull().default(0),
  errorSummary: text("error_summary"),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
});

export const runtimeConfiguration = sqliteTable("runtime_configuration", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  valueType: text("value_type").notNull().$type<"integer" | "boolean" | "string">(),
  description: text("description").notNull(),
  minValue: integer("min_value"),
  maxValue: integer("max_value"),
  updatedByUserId: text("updated_by_user_id").references(() => users.id),
  updatedAt: text("updated_at").notNull(),
});

export const internalUserNotes = sqliteTable("internal_user_notes", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  // Nullable since migration 0015: survives the *author* admin's own
  // account being deleted (the *subject* user_id above still cascades away
  // when the note's subject is deleted, unchanged — that's customer PII).
  authorUserId: text("author_user_id").references(() => users.id),
  note: text("note").notNull(),
  createdAt: text("created_at").notNull(),
});

export const productEvents = sqliteTable("product_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventName: text("event_name").notNull(),
  userId: text("user_id").references(() => users.id),
  anonymousId: text("anonymous_id"),
  properties: text("properties"),
  createdAt: text("created_at").notNull(),
});

// Phase 12: cross-request target-frequency abuse detection (RISK-022).
// Mirrors packages/database/migrations/0031_target_abuse_observations.sql.
// Detection-only -- nothing reads this table to auto-block. Both columns
// are opaque HMAC digests, never a raw IP or raw target domain.
export const targetAbuseObservations = sqliteTable("target_abuse_observations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  targetKey: text("target_key").notNull(),
  callerKey: text("caller_key").notNull(),
  observedAt: text("observed_at").notNull(),
});

// Phase 14: first-party, deduplicated internal operational alerting.
// Mirrors packages/database/migrations/0032_operational_alerts.sql. Never
// publicly readable -- see docs/operations/OPERATIONAL_ALERT_MODEL.md.
export const operationalAlerts = sqliteTable("operational_alerts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  alertKey: text("alert_key").notNull(),
  severity: text("severity").notNull().$type<"info" | "warning" | "critical">(),
  source: text("source").notNull(),
  detail: text("detail").notNull(),
  firstSeenAt: text("first_seen_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
  occurrenceCount: integer("occurrence_count").notNull().default(1),
  resolvedAt: text("resolved_at"),
  acknowledgedAt: text("acknowledged_at"),
  acknowledgedByUserId: text("acknowledged_by_user_id").references(() => users.id),
});
