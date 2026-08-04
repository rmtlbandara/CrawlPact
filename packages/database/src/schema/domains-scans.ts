import { isNull } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { users } from "./identity";
import { crawlers, registryVersions, rulesetVersions } from "./registry";

// Mirrors packages/database/migrations/0005_domains_scans.sql.
export const domainGroups = sqliteTable("domain_groups", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at"),
});

export const domains = sqliteTable(
  "domains",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id),
    groupId: text("group_id").references(() => domainGroups.id),
    displayName: text("display_name").notNull(),
    canonicalOrigin: text("canonical_origin").notNull(),
    originalInput: text("original_input").notNull(),
    preset: text("preset")
      .notNull()
      .$type<
        | "maximum_ai_visibility"
        | "allow_search_block_training"
        | "publisher_protection"
        | "block_known_ai_crawlers"
      >(),
    monitoringState: text("monitoring_state").notNull().$type<"active" | "paused">(),
    monitoringFrequency: text("monitoring_frequency")
      .notNull()
      .$type<"none" | "monthly" | "weekly">(),
    lastScanId: text("last_scan_id"),
    lastScanAt: text("last_scan_at"),
    nextScanAt: text("next_scan_at"),
    currentScore: integer("current_score"),
    consecutiveFailureCount: integer("consecutive_failure_count").notNull().default(0),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    // Partial: only applies to live rows, so a soft-deleted domain doesn't
    // block re-saving the same origin later (migration 0017).
    uniqueIndex("idx_domains_owner_origin_live")
      .on(table.ownerUserId, table.canonicalOrigin)
      .where(isNull(table.deletedAt)),
  ],
);

export const scans = sqliteTable("scans", {
  id: text("id").primaryKey(),
  domainId: text("domain_id").references(() => domains.id),
  triggeredBy: text("triggered_by")
    .notNull()
    .$type<"anonymous" | "manual" | "scheduled" | "admin">(),
  triggeredByUserId: text("triggered_by_user_id").references(() => users.id),
  targetInput: text("target_input").notNull(),
  canonicalOrigin: text("canonical_origin").notNull(),
  status: text("status")
    .notNull()
    .$type<
      | "queued"
      | "running"
      | "completed"
      | "completed_with_warnings"
      | "incomplete"
      | "target_unavailable"
      | "blocked_for_safety"
      | "rate_limited"
      | "internal_failure"
    >(),
  preset: text("preset"),
  registryVersionId: text("registry_version_id").references(() => registryVersions.id),
  rulesetVersionId: text("ruleset_version_id").references(() => rulesetVersions.id),
  score: integer("score"),
  scoreState: text("score_state").notNull().$type<"scored" | "incomplete">(),
  scoreBreakdown: text("score_breakdown"),
  externalRequestCount: integer("external_request_count").notNull().default(0),
  errorCategory: text("error_category"),
  recommendedAdditions: text("recommended_additions"),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
});

export const scanResources = sqliteTable("scan_resources", {
  id: text("id").primaryKey(),
  scanId: text("scan_id")
    .notNull()
    .references(() => scans.id),
  resourceType: text("resource_type")
    .notNull()
    .$type<
      | "robots_txt"
      | "llms_txt"
      | "llms_full_txt"
      | "rsl"
      | "content_signals"
      | "html_meta"
      | "http_headers"
      | "sitemap"
    >(),
  requestedUrl: text("requested_url").notNull(),
  finalUrl: text("final_url"),
  statusCode: integer("status_code"),
  contentType: text("content_type"),
  contentSizeBytes: integer("content_size_bytes"),
  redirectCount: integer("redirect_count").notNull().default(0),
  durationMs: integer("duration_ms"),
  resourceHash: text("resource_hash"),
  truncated: integer("truncated", { mode: "boolean" }).notNull().default(false),
  errorCategory: text("error_category"),
  snapshotText: text("snapshot_text"),
  fetchedAt: text("fetched_at").notNull(),
});

export const scanCrawlerResults = sqliteTable("scan_crawler_results", {
  id: text("id").primaryKey(),
  scanId: text("scan_id")
    .notNull()
    .references(() => scans.id),
  crawlerId: text("crawler_id")
    .notNull()
    .references(() => crawlers.id),
  result: text("result")
    .notNull()
    .$type<
      | "allowed"
      | "blocked"
      | "no_explicit_rule"
      | "mixed"
      | "unknown"
      | "resource_unavailable"
      | "not_evaluated"
    >(),
  matchedRule: text("matched_rule"),
  matchedLineNumber: integer("matched_line_number"),
  evaluationExplanation: text("evaluation_explanation"),
  sourceResourceId: text("source_resource_id").references(() => scanResources.id),
});

export const findings = sqliteTable("findings", {
  id: text("id").primaryKey(),
  scanId: text("scan_id")
    .notNull()
    .references(() => scans.id),
  findingCode: text("finding_code").notNull(),
  severity: text("severity")
    .notNull()
    .$type<"critical" | "high" | "medium" | "low" | "information">(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  evidence: text("evidence").notNull(),
  affectedCrawlerId: text("affected_crawler_id").references(() => crawlers.id),
  businessImpact: text("business_impact").notNull(),
  recommendedAction: text("recommended_action").notNull(),
  confidence: text("confidence").notNull().$type<"high" | "medium" | "low">(),
  sourceUrl: text("source_url"),
  rulesetVersionId: text("ruleset_version_id")
    .notNull()
    .references(() => rulesetVersions.id),
  createdAt: text("created_at").notNull(),
});

// Phase 5 (Anonymous Audit Result and Account-Conversion Flow). See migration 0020 and
// docs/security/PHASE_05_AUDIT_CONVERSION_THREAT_REVIEW.md for the full rationale.
export const auditContinuations = sqliteTable("audit_continuations", {
  id: text("id").primaryKey(),
  scanId: text("scan_id")
    .notNull()
    .references(() => scans.id),
  canonicalOrigin: text("canonical_origin").notNull(),
  intendedAction: text("intended_action").notNull().$type<"save_and_monitor" | "save_only">(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  consumedAt: text("consumed_at"),
});

export const scanDiffs = sqliteTable("scan_diffs", {
  id: text("id").primaryKey(),
  domainId: text("domain_id")
    .notNull()
    .references(() => domains.id),
  previousScanId: text("previous_scan_id")
    .notNull()
    .references(() => scans.id),
  currentScanId: text("current_scan_id")
    .notNull()
    .references(() => scans.id),
  diffType: text("diff_type")
    .notNull()
    .$type<"website_drift" | "registry_drift" | "preset_change">(),
  summary: text("summary").notNull(),
  details: text("details").notNull(),
  createdAt: text("created_at").notNull(),
});
