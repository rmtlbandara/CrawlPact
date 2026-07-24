import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Mirrors packages/database/migrations/0001_plans.sql — keep in sync
// (see ADR-0002 and the db:validate script).
export const plans = sqliteTable("plans", {
  id: text("id").primaryKey().$type<"free" | "solo" | "pro" | "agency">(),
  name: text("name").notNull(),
  annualPriceUsdCents: integer("annual_price_usd_cents").notNull(),
  savedDomainLimit: integer("saved_domain_limit").notNull(),
  monitoringFrequency: text("monitoring_frequency")
    .notNull()
    .$type<"none" | "monthly" | "weekly">(),
  historyRetentionDays: integer("history_retention_days").notNull(),
  manualRescansPerDomainPerMonth: integer("manual_rescans_per_domain_per_month").notNull(),
  domainGroupsEnabled: integer("domain_groups_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  csvExportEnabled: integer("csv_export_enabled", { mode: "boolean" }).notNull().default(false),
  printReadyReportTier: text("print_ready_report_tier").notNull().$type<"basic" | "full">(),
  privateAtomFeedEnabled: integer("private_atom_feed_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  batchImportLimit: integer("batch_import_limit").notNull().default(0),
  agencyBrandingEnabled: integer("agency_branding_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
