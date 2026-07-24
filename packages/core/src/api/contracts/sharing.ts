import { z } from "zod";

/**
 * SRS §29 agency branding on shared reports: only these fields may be
 * customised — CrawlPact methodology, limitations, evidence, and the
 * registry/ruleset version are rendered unconditionally by
 * `AuditReportView` regardless of branding, so there is no field here that
 * could remove them. `logoUrl` is restricted to http(s) to rule out
 * `javascript:`/`data:` URI injection into an `<img src>`.
 */
export const agencyBrandingSchema = z.object({
  agencyName: z.string().trim().min(1).max(120).optional(),
  logoUrl: z
    .string()
    .trim()
    .url()
    .max(500)
    .refine((url) => url.startsWith("https://") || url.startsWith("http://"), {
      message: "Logo URL must use http or https.",
    })
    .optional(),
  clientName: z.string().trim().min(1).max(120).optional(),
  introText: z.string().trim().min(1).max(1000).optional(),
});
export type AgencyBranding = z.infer<typeof agencyBrandingSchema>;

/** Typed contracts for private report sharing (SRS §23). */
export const createShareRequestSchema = z.object({
  auditId: z.string(),
  expiresInDays: z.number().int().min(1).max(90).optional(),
  agencyBranding: agencyBrandingSchema.optional(),
});

export const shareSummarySchema = z.object({
  shareId: z.string(),
  url: z.string().url(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
  revoked: z.boolean(),
});
export type ShareSummary = z.infer<typeof shareSummarySchema>;
