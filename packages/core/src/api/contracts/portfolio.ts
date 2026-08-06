import { z } from "zod";
import { AGENCY_LOGO_PATH_PATTERN } from "./sharing";

/**
 * Phase 9 (Agency Workspace and Portfolio Workflows) contracts. See
 * docs/product/CSV_IMPORT_WORKFLOW.md, BULK_ACTION_MODEL.md,
 * PORTFOLIO_SUMMARY_MODEL.md, PORTFOLIO_ATTENTION_MODEL.md.
 */

// --- CSV import -------------------------------------------------------

export const importRowResultSchema = z.enum([
  "created",
  "duplicate_in_file",
  "already_saved",
  "invalid_domain",
  "private_target",
  "group_not_found",
  "monitoring_unavailable",
  "limit_exceeded",
  "batch_limit_exceeded",
  "field_too_long",
  "unsupported_field",
]);

export const importPreviewRowSchema = z.object({
  rowNumber: z.number().int().min(1),
  domain: z.string(),
  displayName: z.string().nullable(),
  groupName: z.string().nullable(),
  notes: z.string().nullable(),
  monitoringRequested: z.boolean(),
  result: importRowResultSchema,
});

export const importPreviewResponseSchema = z.object({
  totalRows: z.number().int().min(0),
  validRows: z.number().int().min(0),
  invalidRows: z.number().int().min(0),
  unsupportedColumns: z.array(z.string()),
  rows: z.array(importPreviewRowSchema),
  batchImportLimit: z.number().int().min(0),
  remainingCapacity: z.number().int().min(0),
});
export type ImportPreviewResponse = z.infer<typeof importPreviewResponseSchema>;

export const importConfirmRequestSchema = z.object({
  csvContent: z.string().min(1).max(300_000),
  groupId: z.string().optional(),
  applyMonitoring: z.boolean().default(false),
  idempotencyKey: z.string().uuid(),
});

export const importRowOutcomeSchema = z.object({
  rowNumber: z.number().int().min(1),
  domain: z.string(),
  result: importRowResultSchema,
  domainId: z.string().optional(),
});

export const importConfirmResponseSchema = z.object({
  jobId: z.string(),
  status: z.enum(["completed", "completed_with_errors", "failed"]),
  totalRows: z.number().int().min(0),
  createdDomains: z.number().int().min(0),
  failedDomains: z.number().int().min(0),
  rows: z.array(importRowOutcomeSchema),
});
export type ImportConfirmResponse = z.infer<typeof importConfirmResponseSchema>;

// --- Bulk actions -------------------------------------------------------

export const bulkActionTypeSchema = z.enum([
  "assign_group",
  "move_group",
  "remove_from_group",
  "enable_monitoring",
  "disable_monitoring",
  "pause_monitoring",
  "resume_monitoring",
]);

export const bulkActionRequestSchema = z.object({
  action: bulkActionTypeSchema,
  domainIds: z.array(z.string()).min(1).max(100),
  groupId: z.string().optional(),
  idempotencyKey: z.string().uuid(),
});

export const bulkActionRowResultSchema = z.object({
  domainId: z.string(),
  outcome: z.enum(["succeeded", "skipped", "failed"]),
  reason: z.string().optional(),
});

export const bulkActionResponseSchema = z.object({
  jobId: z.string(),
  status: z.enum(["completed", "completed_with_errors", "failed"]),
  requestedCount: z.number().int().min(0),
  succeededCount: z.number().int().min(0),
  skippedCount: z.number().int().min(0),
  failedCount: z.number().int().min(0),
  results: z.array(bulkActionRowResultSchema),
});
export type BulkActionResponse = z.infer<typeof bulkActionResponseSchema>;

// --- Agency brand profile -------------------------------------------------------

export const agencyBrandProfileSchema = z.object({
  agencyName: z.string().nullable(),
  logoUrl: z.string().nullable(),
});
export type AgencyBrandProfile = z.infer<typeof agencyBrandProfileSchema>;

// --- Saved views -------------------------------------------------------

export const savedViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  filterState: z.string(),
  createdAt: z.string().datetime(),
});
export type SavedViewDto = z.infer<typeof savedViewSchema>;

export const createSavedViewRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  filterState: z.string().max(2000),
});

// --- Agency brand profile -------------------------------------------------------

export const updateAgencyBrandProfileRequestSchema = z.object({
  agencyName: z.string().trim().max(120).nullable().optional(),
  logoUrl: z
    .string()
    .trim()
    .max(300)
    .regex(AGENCY_LOGO_PATH_PATTERN, "Logo must be uploaded via the agency branding logo endpoint.")
    .nullable()
    .optional(),
});
