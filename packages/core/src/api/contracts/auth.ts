import { z } from "zod";

/**
 * Typed contract for the future passkey authentication endpoints (SRS §24,
 * ADR-0004). Not wired to a functional implementation in Part 1 — the
 * /sign-in page explains this explicitly rather than presenting a broken or
 * fake flow.
 */
export const beginRegistrationRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
});

export const beginRegistrationResponseSchema = z.object({
  challengeId: z.string(),
  publicKeyCredentialCreationOptions: z.record(z.string(), z.unknown()),
});

export const finishRegistrationRequestSchema = z.object({
  challengeId: z.string(),
  credential: z.record(z.string(), z.unknown()),
});

export const beginAssertionResponseSchema = z.object({
  challengeId: z.string(),
  publicKeyCredentialRequestOptions: z.record(z.string(), z.unknown()),
});

export const finishAssertionRequestSchema = z.object({
  challengeId: z.string(),
  credential: z.record(z.string(), z.unknown()),
});

export const sessionSummarySchema = z.object({
  sessionId: z.string(),
  createdAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  userAgent: z.string().nullable(),
  isCurrent: z.boolean(),
});
export type SessionSummary = z.infer<typeof sessionSummarySchema>;

export const recoveryCodeIssueResponseSchema = z.object({
  codes: z.array(z.string()),
  issuedAt: z.string().datetime(),
});
