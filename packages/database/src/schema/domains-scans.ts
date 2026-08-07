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
  // Phase 9: optional internal note, never shown to anyone but the owner and
  // never included in CSV export by default. See migration 0029 and
  // docs/product/DOMAIN_GROUP_MODEL.md.
  description: text("description"),
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
    // Phase 8: short-lived claim preventing a manual rescan and a scheduled
    // sweep (or two concurrent manual rescans) from both scanning this
    // domain at once. See migration 0028 and lib/scan-lock.ts.
    scanLockUntil: text("scan_lock_until"),
    // Phase 10: stable id for the domain's current consecutive target-failure
    // streak, letting repeated resource_failure notifications collapse onto
    // one row instead of creating a new one per failure. NULL when the
    // domain is not currently mid-streak. See migration 0030 and
    // apps/web/src/lib/domains.ts's recordScheduledScanOutcome.
    failureEpisodeId: text("failure_episode_id"),
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
  // Phase 11: how many findings were left off this scan's persisted evidence
  // because the real count exceeded MAX_PERSISTED_FINDINGS
  // (packages/policy/src/findings.ts). 0 means "not capped" — the honest
  // value for every scan that predates this column.
  findingsOmittedCount: integer("findings_omitted_count").notNull().default(0),
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
  // Phase 8: first-class copy of the fingerprint already computed at persist
  // time (packages/policy/src/findings.ts) and already stored inside the
  // `evidence` JSON blob above — this column makes it queryable/comparable
  // across scans for the finding-lifecycle feature without JSON-parsing
  // every row. See migration 0027 and FINDING_LIFECYCLE_MODEL.md.
  fingerprint: text("fingerprint"),
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
  previousScanId: text("previous_scan_id").references(() => scans.id),
  currentScanId: text("current_scan_id").references(() => scans.id),
  diffType: text("diff_type")
    .notNull()
    .$type<"website_drift" | "registry_drift" | "preset_change">(),
  summary: text("summary").notNull(),
  details: text("details").notNull(),
  createdAt: text("created_at").notNull(),
});

// Phase 8 (Saved-Domain Experience and Change Timeline). See
// docs/product/DOMAIN_TIMELINE_EVENT_MODEL.md for the full column rationale.
export const domainChangeEvents = sqliteTable("domain_change_events", {
  id: text("id").primaryKey(),
  domainId: text("domain_id")
    .notNull()
    .references(() => domains.id),
  eventType: text("event_type")
    .notNull()
    .$type<
      | "baseline"
      | "website_policy_change"
      | "registry_driven_change"
      | "mixed_change"
      | "operational_change"
    >(),
  changeOrigin: text("change_origin")
    .notNull()
    .$type<
      "website_policy" | "registry_driven" | "mixed" | "operational" | "uncertain" | "baseline"
    >(),
  attentionLevel: text("attention_level")
    .notNull()
    .$type<"informational" | "review_recommended" | "high_attention">(),
  observedAt: text("observed_at").notNull(),
  previousScanId: text("previous_scan_id").references(() => scans.id),
  currentScanId: text("current_scan_id").references(() => scans.id),
  previousRegistryVersionId: text("previous_registry_version_id").references(
    () => registryVersions.id,
  ),
  currentRegistryVersionId: text("current_registry_version_id").references(
    () => registryVersions.id,
  ),
  affectedPurposesJson: text("affected_purposes_json").notNull(),
  findingCountsJson: text("finding_counts_json").notNull(),
  summary: text("summary").notNull(),
  detailsJson: text("details_json").notNull(),
  completeness: text("completeness").notNull().$type<"complete" | "partial">(),
  fingerprint: text("fingerprint").notNull(),
  modelVersion: text("model_version").notNull(),
  createdAt: text("created_at").notNull(),
});
