import { z } from "zod";

/** Typed contracts for domain groups (SRS §10.16, §29). */
export const domainGroupSchema = z.object({
  groupId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  domainCount: z.number().int().min(0),
  createdAt: z.string().datetime(),
});
export type DomainGroup = z.infer<typeof domainGroupSchema>;

// Phase 9: optional internal note (docs/product/DOMAIN_GROUP_MODEL.md), length-bounded.
const groupDescriptionSchema = z.string().trim().max(500).optional();

export const createGroupRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: groupDescriptionSchema,
});

export const updateGroupRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: groupDescriptionSchema,
});

// Phase 9: safe non-empty-group deletion (docs/product/DOMAIN_GROUP_MODEL.md) — domains move to
// the given destination group, or to Ungrouped when omitted/null.
export const deleteGroupRequestSchema = z.object({
  destinationGroupId: z.string().nullable().optional(),
});
