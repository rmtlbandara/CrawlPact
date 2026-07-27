import { z } from "zod";

/**
 * Typed contracts for Super Admin operations (SRS §28). Not implemented in
 * Part 1. Every mutating admin action requires a `reason`, matching
 * ADR-0004 and SRS §28.19's audit-log requirements.
 */
export const adminActionRequestSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const adminUserSearchQuerySchema = z.object({
  query: z.string().trim().min(1).max(200),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const adminAuditLogEntrySchema = z.object({
  logId: z.string(),
  administratorId: z.string(),
  action: z.string(),
  target: z.string(),
  reason: z.string(),
  previousState: z.record(z.string(), z.unknown()).nullable(),
  newState: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string().datetime(),
  requestId: z.string(),
});
export type AdminAuditLogEntry = z.infer<typeof adminAuditLogEntrySchema>;
