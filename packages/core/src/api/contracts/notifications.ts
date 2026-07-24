import { z } from "zod";

/** Typed contracts for the notification centre (SRS §26). Not implemented in Part 1. */
export const notificationTypeSchema = z.enum([
  "critical_policy_change",
  "high_severity_policy_change",
  "new_crawler",
  "crawler_purpose_change",
  "registry_drift",
  "resource_failure",
  "monitoring_paused",
  "subscription_issue",
  "shared_report_expiry",
  "platform_notice",
]);

export const notificationSchema = z.object({
  notificationId: z.string(),
  type: notificationTypeSchema,
  title: z.string(),
  body: z.string(),
  domainId: z.string().nullable(),
  isRead: z.boolean(),
  createdAt: z.string().datetime(),
  /** Set when this row represents several repeated notifications of the same type/domain, collapsed for display (SRS §10.41). */
  groupCount: z.number().int().min(1).optional(),
});
export type Notification = z.infer<typeof notificationSchema>;

export const markNotificationsReadRequestSchema = z.object({
  notificationIds: z.array(z.string()).min(1),
});

export const feedTokenIssueResponseSchema = z.object({
  token: z.string(),
  feedUrl: z.string(),
});
