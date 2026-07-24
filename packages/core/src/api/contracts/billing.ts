import { z } from "zod";

/** Typed contracts for Paddle-backed billing (SRS §27). Not implemented in Part 1. */
export const planIdSchema = z.enum(["free", "solo", "pro", "agency"]);

export const subscriptionStatusSchema = z.enum([
  "active",
  "trialing",
  "past_due",
  "paused",
  "cancelled",
  "expired",
]);

export const billingSummarySchema = z.object({
  plan: planIdSchema,
  status: subscriptionStatusSchema.nullable(),
  renewalDate: z.string().datetime().nullable(),
  scheduledCancellation: z.boolean(),
  domainUsage: z.object({ used: z.number().int().min(0), limit: z.number().int().min(0) }),
});
export type BillingSummary = z.infer<typeof billingSummarySchema>;

export const createCheckoutRequestSchema = z.object({
  plan: z.enum(["solo", "pro", "agency"]),
});

export const createCheckoutResponseSchema = z.object({
  checkoutUrl: z.string().url(),
});

/**
 * Paddle webhook envelope shape as received by /api/billing/webhook. The
 * signature (`Paddle-Signature` header) is verified before this body is
 * parsed — see docs/security/BILLING_SECURITY.md.
 */
export const paddleWebhookEventSchema = z.object({
  event_id: z.string(),
  event_type: z.string(),
  occurred_at: z.string(),
  data: z.record(z.unknown()),
});
