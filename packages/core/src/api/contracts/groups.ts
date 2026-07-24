import { z } from "zod";

/** Typed contracts for domain groups (SRS §10.16, §29). Not implemented in Part 1. */
export const domainGroupSchema = z.object({
  groupId: z.string(),
  name: z.string(),
  domainCount: z.number().int().min(0),
  createdAt: z.string().datetime(),
});
export type DomainGroup = z.infer<typeof domainGroupSchema>;

export const createGroupRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const updateGroupRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
});
