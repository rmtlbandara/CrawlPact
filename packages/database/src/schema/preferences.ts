import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./identity";

// Mirrors packages/database/migrations/0008_preferences.sql.
export const userPreferences = sqliteTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  sidebarCollapsed: integer("sidebar_collapsed", { mode: "boolean" }).notNull().default(false),
  tableDensity: text("table_density").notNull().$type<"comfortable" | "compact">(),
  reducedMotion: integer("reduced_motion", { mode: "boolean" }).notNull().default(false),
  themePreference: text("theme_preference").notNull().$type<"light" | "dark">(),
  updatedAt: text("updated_at").notNull(),
});

export const savedFilters = sqliteTable("saved_filters", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  context: text("context").notNull(),
  name: text("name").notNull(),
  filterState: text("filter_state").notNull(),
  createdAt: text("created_at").notNull(),
});

export const tablePreferences = sqliteTable("table_preferences", {
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  tableKey: text("table_key").notNull(),
  visibleColumns: text("visible_columns").notNull(),
  sortState: text("sort_state"),
  updatedAt: text("updated_at").notNull(),
});
