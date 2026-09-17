import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// Mirrors packages/database/migrations/0039_growth_snapshots.sql. Ingestion
// (the scheduled collection job) writes these via raw D1 `prepare`/`bind`
// upserts, matching how every other cron job in worker.ts writes its own
// run-tracking rows — these Drizzle definitions exist for the admin growth
// dashboard's typed reads, the same split already used for
// `scheduledJobRuns` (raw writes in worker.ts, `db.select()` reads in
// lib/admin/scheduler.ts).

export const gscDailyMetrics = sqliteTable(
  "gsc_daily_metrics",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    dataDate: text("data_date").notNull(),
    dimensionType: text("dimension_type")
      .notNull()
      .$type<"site" | "query" | "page" | "device" | "country">(),
    dimensionValue: text("dimension_value").notNull(),
    clicks: integer("clicks").notNull().default(0),
    impressions: integer("impressions").notNull().default(0),
    ctr: real("ctr").notNull().default(0),
    position: real("position").notNull().default(0),
    collectedAt: text("collected_at").notNull(),
  },
  (table) => [
    uniqueIndex("gsc_daily_metrics_date_type_value").on(
      table.dataDate,
      table.dimensionType,
      table.dimensionValue,
    ),
  ],
);

export const ga4DailyMetrics = sqliteTable(
  "ga4_daily_metrics",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    dataDate: text("data_date").notNull(),
    dimensionType: text("dimension_type")
      .notNull()
      .$type<"site" | "channel_group" | "landing_page" | "device">(),
    dimensionValue: text("dimension_value").notNull(),
    activeUsers: integer("active_users").notNull().default(0),
    newUsers: integer("new_users").notNull().default(0),
    sessions: integer("sessions").notNull().default(0),
    engagedSessions: integer("engaged_sessions").notNull().default(0),
    keyEvents: integer("key_events").notNull().default(0),
    collectedAt: text("collected_at").notNull(),
  },
  (table) => [
    uniqueIndex("ga4_daily_metrics_date_type_value").on(
      table.dataDate,
      table.dimensionType,
      table.dimensionValue,
    ),
  ],
);

export const cruxSnapshots = sqliteTable(
  "crux_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    dataDate: text("data_date").notNull(),
    origin: text("origin").notNull(),
    formFactor: text("form_factor").notNull().$type<"PHONE" | "DESKTOP" | "TABLET" | "ALL">(),
    lcpP75Ms: integer("lcp_p75_ms"),
    inpP75Ms: integer("inp_p75_ms"),
    clsP75: real("cls_p75"),
    collectedAt: text("collected_at").notNull(),
  },
  (table) => [
    uniqueIndex("crux_snapshots_date_origin_form_factor").on(
      table.dataDate,
      table.origin,
      table.formFactor,
    ),
  ],
);

export const rumVitals = sqliteTable(
  "rum_vitals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    metricName: text("metric_name").notNull().$type<"LCP" | "INP" | "CLS" | "FCP" | "TTFB">(),
    metricValue: real("metric_value").notNull(),
    rating: text("rating").$type<"good" | "needs-improvement" | "poor" | null>(),
    route: text("route").notNull(),
    surface: text("surface").notNull().$type<"public" | "app">(),
    deviceCategory: text("device_category").notNull().$type<"mobile" | "desktop">(),
    recordedAt: text("recorded_at").notNull(),
  },
  (table) => [
    index("idx_rum_vitals_metric_recorded").on(table.metricName, table.recordedAt),
    index("idx_rum_vitals_recorded_at").on(table.recordedAt),
  ],
);
