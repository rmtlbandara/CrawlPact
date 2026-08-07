import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./identity";
import { domains } from "./domains-scans";
import { scans } from "./domains-scans";

// Mirrors packages/database/migrations/0006_notifications_sharing.sql.
export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  domainId: text("domain_id").references(() => domains.id),
  type: text("type")
    .notNull()
    .$type<
      | "critical_policy_change"
      | "high_severity_policy_change"
      | "new_crawler"
      | "crawler_purpose_change"
      | "registry_drift"
      | "resource_failure"
      | "monitoring_paused"
      | "subscription_issue"
      | "shared_report_expiry"
      | "platform_notice"
    >(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  readAt: text("read_at"),
  createdAt: text("created_at").notNull(),
  // Phase 10: dedupe/source/grouping model. NULL on every row that predates
  // this phase — treated as legacy, never backfilled. See migration 0030 and
  // docs/architecture/NOTIFICATION_RELIABILITY_ARCHITECTURE.md.
  category: text("category").$type<
    | "policy_changes"
    | "crawler_registry"
    | "monitoring_health"
    | "billing_and_account"
    | "report_sharing"
    | "platform_notices"
  >(),
  priority: text("priority")
    .notNull()
    .default("normal")
    .$type<"critical" | "high" | "normal" | "informational">(),
  sourceType: text("source_type").$type<
    | "domain_change_event"
    | "scan_failure_episode"
    | "monitoring_state"
    | "subscription"
    | "shared_report"
    | "system_notice"
    | "registry_event"
  >(),
  sourceId: text("source_id"),
  // Idempotency key: unique per (user_id, dedupe_key) — see migration 0030's
  // idx_notifications_user_dedupe.
  dedupeKey: text("dedupe_key"),
  actionPath: text("action_path"),
  occurrenceCount: integer("occurrence_count").notNull().default(1),
  lastOccurredAt: text("last_occurred_at"),
  modelVersion: text("model_version"),
});

export const feedTokens = sqliteTable("feed_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull(),
  createdAt: text("created_at").notNull(),
  revokedAt: text("revoked_at"),
});

export const sharedReports = sqliteTable("shared_reports", {
  id: text("id").primaryKey(),
  scanId: text("scan_id")
    .notNull()
    .references(() => scans.id),
  ownerUserId: text("owner_user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull(),
  agencyBranding: text("agency_branding"),
  expiresAt: text("expires_at"),
  createdAt: text("created_at").notNull(),
  revokedAt: text("revoked_at"),
});

export const systemNotices = sqliteTable("system_notices", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  severity: text("severity").notNull().$type<"information" | "warning" | "critical">(),
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(false),
  publishedAt: text("published_at"),
  createdByUserId: text("created_by_user_id").references(() => users.id),
  createdAt: text("created_at").notNull(),
});
