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

// Mirrors packages/database/migrations/0021_plan_prices.sql — the Phase 6
// DB-backed replacement for the old flat annual-price-per-plan model. See
// docs/billing/APPROVED_PRICING_AND_ENTITLEMENT_MATRIX.md.
export const planPrices = sqliteTable("plan_prices", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .$type<"free" | "solo" | "pro" | "agency">()
    .references(() => plans.id),
  environment: text("environment").notNull().$type<"sandbox" | "production">(),
  interval: text("interval").notNull().$type<"month" | "year">(),
  amountUsdCents: integer("amount_usd_cents").notNull(),
  paddleProductId: text("paddle_product_id").notNull(),
  paddlePriceId: text("paddle_price_id").notNull(),
  activeForNewCheckout: integer("active_for_new_checkout", { mode: "boolean" })
    .notNull()
    .default(true),
  legacy: integer("legacy", { mode: "boolean" }).notNull().default(false),
  effectiveDate: text("effective_date").notNull(),
  archivedAt: text("archived_at"),
  lastVerifiedAt: text("last_verified_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
