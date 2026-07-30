import { z } from "zod";

/**
 * Matches only a path this codebase's own `GET
 * /api/agency-branding/logo/[userId]/[filename]` serving route
 * (apps/web/src/pages/api/agency-branding/logo) could have produced —
 * never an arbitrary external URL. `apps/web/src/lib/agency-logo.ts`'s
 * `buildLogoObjectKey` is the only thing that generates the `userId`/`uuid`
 * segments this matches against. Shared here (not duplicated in apps/web)
 * so the upload route, `share.ts`'s ownership check, and this schema can't
 * drift apart.
 */
export const AGENCY_LOGO_PATH_PATTERN =
  /^\/api\/agency-branding\/logo\/([A-Za-z0-9-]+)\/[A-Za-z0-9-]+\.(?:png|jpe?g|webp|gif)$/;

/**
 * SRS §29 agency branding on shared reports: only these fields may be
 * customised — CrawlPact methodology, limitations, evidence, and the
 * registry/ruleset version are rendered unconditionally by
 * `AuditReportView` regardless of branding, so there is no field here that
 * could remove them. `logoUrl` was originally an arbitrary customer-typed
 * http(s) URL; per `docs/data/D1_R2_DATA_PLACEMENT_POLICY.md`'s 2026-07-30
 * entry it's now a path into CrawlPact's own R2-backed upload, so this
 * schema restricts it to that exact shape rather than any URL at all — an
 * uploaded file's real content is sniffed and validated server-side
 * (`agency-logo.ts`), not trusted from a client-supplied URL/MIME type.
 */
export const agencyBrandingSchema = z.object({
  agencyName: z.string().trim().min(1).max(120).optional(),
  logoUrl: z
    .string()
    .trim()
    .max(300)
    .regex(AGENCY_LOGO_PATH_PATTERN, "Logo must be uploaded via the agency branding logo endpoint.")
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
