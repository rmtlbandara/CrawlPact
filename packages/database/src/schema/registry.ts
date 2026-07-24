import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { users } from "./identity";

// Mirrors packages/database/migrations/0004_registry.sql.
export const crawlerOperators = sqliteTable("crawler_operators", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  websiteUrl: text("website_url"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const crawlers = sqliteTable(
  "crawlers",
  {
    id: text("id").primaryKey(),
    operatorId: text("operator_id")
      .notNull()
      .references(() => crawlerOperators.id),
    name: text("name").notNull(),
    userAgentToken: text("user_agent_token").notNull(),
    alternativeTokens: text("alternative_tokens"),
    purpose: text("purpose")
      .notNull()
      .$type<
        | "search"
        | "training"
        | "user_triggered"
        | "agent"
        | "advertising_validation"
        | "research"
        | "mixed"
        | "unknown"
      >(),
    description: text("description").notNull(),
    officialSourceUrl: text("official_source_url").notNull(),
    lifecycleStatus: text("lifecycle_status")
      .notNull()
      .$type<"active" | "deprecated" | "replaced" | "unverified" | "retired">(),
    replacementCrawlerId: text("replacement_crawler_id"),
    publishedIpInfo: text("published_ip_info"),
    notes: text("notes"),
    firstVerifiedAt: text("first_verified_at"),
    lastVerifiedAt: text("last_verified_at"),
    approvedByUserId: text("approved_by_user_id").references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("idx_crawlers_user_agent_token_drizzle").on(table.userAgentToken)],
);

export const registryVersions = sqliteTable("registry_versions", {
  id: text("id").primaryKey(),
  versionLabel: text("version_label").notNull(),
  changelog: text("changelog").notNull(),
  publishedByUserId: text("published_by_user_id").references(() => users.id),
  publishedAt: text("published_at"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const registryVersionEntries = sqliteTable("registry_version_entries", {
  id: text("id").primaryKey(),
  registryVersionId: text("registry_version_id")
    .notNull()
    .references(() => registryVersions.id),
  crawlerId: text("crawler_id")
    .notNull()
    .references(() => crawlers.id),
  snapshot: text("snapshot").notNull(),
});

export const rulesetVersions = sqliteTable("ruleset_versions", {
  id: text("id").primaryKey(),
  versionLabel: text("version_label").notNull(),
  description: text("description").notNull(),
  publishedByUserId: text("published_by_user_id").references(() => users.id),
  publishedAt: text("published_at"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});
