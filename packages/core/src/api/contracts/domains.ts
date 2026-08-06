import { z } from "zod";

/** Typed contracts for saved-domain management (SRS §25). Not implemented in Part 1. */
export const domainMonitoringStateSchema = z.enum(["active", "paused"]);

export const savedDomainSchema = z.object({
  domainId: z.string(),
  displayName: z.string(),
  canonicalOrigin: z.string(),
  groupId: z.string().nullable(),
  preset: z.string(),
  monitoringState: domainMonitoringStateSchema,
  lastScanAt: z.string().datetime().nullable(),
  nextScanAt: z.string().datetime().nullable(),
  currentScore: z.number().min(0).max(100).nullable(),
  openFindingsCount: z.number().int().min(0),
  // Phase 8 (Saved-Domain Experience and Change Timeline): the most recent
  // policy-change-timeline event for this domain, if any — powers the
  // saved-domain list's "Recent change" column without a per-row detail
  // fetch. `null` means no timeline event exists yet (a fresh baseline or a
  // domain that has never had a comparable second scan).
  recentChangeOrigin: z.string().nullable(),
  recentChangeSummary: z.string().nullable(),
});
export type SavedDomain = z.infer<typeof savedDomainSchema>;

export const createDomainRequestSchema = z.object({
  target: z.string().trim().min(1).max(253),
  displayName: z.string().trim().min(1).max(120).optional(),
  groupId: z.string().optional(),
  preset: z.string().optional(),
});

export const updateDomainRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  groupId: z.string().nullable().optional(),
  preset: z.string().optional(),
  monitoringState: domainMonitoringStateSchema.optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

/** SRS §29: agency batch domain import. `targets` are raw, unvalidated
 * strings as pasted/uploaded — validation happens per-row server-side so
 * one bad row never blocks the rest of the batch. */
export const batchImportRequestSchema = z.object({
  targets: z.array(z.string().trim().min(1).max(253)).min(1).max(200),
  groupId: z.string().optional(),
});

export const batchImportRowResultSchema = z.object({
  target: z.string(),
  ok: z.boolean(),
  domainId: z.string().optional(),
  error: z.string().optional(),
});

export const batchImportResultSchema = z.object({
  results: z.array(batchImportRowResultSchema),
  savedCount: z.number().int().min(0),
  errorCount: z.number().int().min(0),
});
export type BatchImportResult = z.infer<typeof batchImportResultSchema>;
