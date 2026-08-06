import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { domainGroups, domains } from "./domains-scans";
import { users } from "./identity";

// Phase 9 (Agency Workspace and Portfolio Workflows). Mirrors
// packages/database/migrations/0029_agency_workspace_portfolio.sql.
// See docs/product/AGENCY_BRANDING_MODEL.md.
export const agencyBrandProfiles = sqliteTable("agency_brand_profiles", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id")
    .notNull()
    .unique()
    .references(() => users.id),
  agencyName: text("agency_name"),
  logoUrl: text("logo_url"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// See docs/product/CSV_IMPORT_WORKFLOW.md — a job/row summary record, not a queue.
export const portfolioImportJobs = sqliteTable(
  "portfolio_import_jobs",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id),
    groupId: text("group_id").references(() => domainGroups.id),
    status: text("status").notNull().$type<"completed" | "completed_with_errors" | "failed">(),
    totalRows: integer("total_rows").notNull().default(0),
    validRows: integer("valid_rows").notNull().default(0),
    invalidRows: integer("invalid_rows").notNull().default(0),
    createdDomains: integer("created_domains").notNull().default(0),
    failedDomains: integer("failed_domains").notNull().default(0),
    monitoringRequested: integer("monitoring_requested", { mode: "boolean" })
      .notNull()
      .default(false),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: text("created_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [
    uniqueIndex("idx_portfolio_import_jobs_owner_idempotency").on(
      table.ownerUserId,
      table.idempotencyKey,
    ),
  ],
);

export const portfolioImportRows = sqliteTable("portfolio_import_rows", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => portfolioImportJobs.id),
  rowNumber: integer("row_number").notNull(),
  normalisedOrigin: text("normalised_origin"),
  result: text("result")
    .notNull()
    .$type<
      | "created"
      | "duplicate_in_file"
      | "already_saved"
      | "invalid_domain"
      | "private_target"
      | "group_not_found"
      | "monitoring_unavailable"
      | "limit_exceeded"
      | "batch_limit_exceeded"
      | "field_too_long"
      | "unsupported_field"
    >(),
  errorCode: text("error_code"),
  domainId: text("domain_id").references(() => domains.id),
});

// See docs/product/BULK_ACTION_MODEL.md.
export const bulkActionJobs = sqliteTable(
  "bulk_action_jobs",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id),
    action: text("action")
      .notNull()
      .$type<
        | "assign_group"
        | "move_group"
        | "remove_from_group"
        | "enable_monitoring"
        | "disable_monitoring"
        | "pause_monitoring"
        | "resume_monitoring"
      >(),
    status: text("status").notNull().$type<"completed" | "completed_with_errors" | "failed">(),
    requestedCount: integer("requested_count").notNull().default(0),
    succeededCount: integer("succeeded_count").notNull().default(0),
    skippedCount: integer("skipped_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: text("created_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [
    uniqueIndex("idx_bulk_action_jobs_owner_idempotency").on(
      table.ownerUserId,
      table.idempotencyKey,
    ),
  ],
);
