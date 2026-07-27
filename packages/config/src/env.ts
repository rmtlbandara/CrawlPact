import { z } from "zod";

/**
 * `.env.example` placeholder values. A Paddle var can satisfy the schema's
 * `.min(1)` check (or even the URL/enum shape) while still being one of
 * these — that's "present" but not "configured with a real credential".
 * Shared with `apps/web/src/lib/admin/environment.ts` so there's exactly
 * one list, not two that can drift apart.
 */
export const KNOWN_PADDLE_PLACEHOLDER_VALUES = new Set([
  "paddle_sandbox_placeholder",
  "replace-with-paddle-sandbox-webhook-secret",
  "pri_sandbox_placeholder",
  "paddle_sandbox_client_token_placeholder",
  "ci-placeholder",
  "pri_ci_placeholder",
]);

/**
 * Canonical environment schema for CrawlPact. This is the single place that
 * defines which environment variables exist, their shape, and their
 * defaults. Route/worker code must read env through `parseEnv`, never
 * through raw `process.env`/`import.meta.env` access, so an invalid or
 * missing configuration fails fast and loudly instead of silently.
 */
export const envSchema = z
  .object({
    PUBLIC_APP_ENV: z.enum(["local", "preview", "production"]).default("local"),
    PUBLIC_SITE_URL: z.string().url(),

    SESSION_SIGNING_SECRET: z.string().min(16),
    WEBAUTHN_RP_ID: z.string().min(1),
    WEBAUTHN_RP_ORIGIN: z.string().url(),

    PADDLE_API_KEY: z.string().min(1),
    PADDLE_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
    PADDLE_WEBHOOK_SECRET: z.string().min(1),
    PADDLE_PRICE_ID_SOLO: z.string().min(1),
    PADDLE_PRICE_ID_PRO: z.string().min(1),
    PADDLE_PRICE_ID_AGENCY: z.string().min(1),
    PUBLIC_PADDLE_CLIENT_TOKEN: z.string().min(1),

    // Deployment-intent flag: "should this environment actually accept real
    // money/serve real checkouts", independent of whether the Paddle fields
    // above happen to be present. Kept separate from AUDIT_ENGINE_ENABLED's
    // boolean-coercion pattern for consistency.
    BILLING_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),

    AUDIT_ENGINE_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
  })
  .superRefine((value, ctx) => {
    // Non-negotiable environment isolation: local/preview must never hold a
    // live Paddle credential, regardless of what BILLING_ENABLED says.
    if (value.PUBLIC_APP_ENV !== "production" && value.PADDLE_ENVIRONMENT === "production") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["PADDLE_ENVIRONMENT"],
        message: `PADDLE_ENVIRONMENT must not be "production" when PUBLIC_APP_ENV is "${value.PUBLIC_APP_ENV}" — local and preview must never use Paddle Live credentials.`,
      });
    }

    // When an environment declares itself billing-enabled, every Paddle
    // field must be a real credential, not a leftover .env.example/CI
    // placeholder — this is what makes a misconfigured production deploy
    // fail loudly instead of silently serving a broken checkout.
    if (value.BILLING_ENABLED) {
      const paddleFields = [
        "PADDLE_API_KEY",
        "PADDLE_WEBHOOK_SECRET",
        "PADDLE_PRICE_ID_SOLO",
        "PADDLE_PRICE_ID_PRO",
        "PADDLE_PRICE_ID_AGENCY",
        "PUBLIC_PADDLE_CLIENT_TOKEN",
      ] as const;
      for (const field of paddleFields) {
        if (KNOWN_PADDLE_PLACEHOLDER_VALUES.has(value[field])) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: `${field} must be a real Paddle credential, not a placeholder value, when BILLING_ENABLED=true.`,
          });
        }
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export class InvalidEnvironmentError extends Error {
  issues: z.ZodIssue[];

  constructor(issues: z.ZodIssue[]) {
    super(
      `Invalid environment configuration:\n${issues
        .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
        .join("\n")}`,
    );
    this.name = "InvalidEnvironmentError";
    this.issues = issues;
  }
}

/**
 * Parses and validates a raw environment record (e.g. Cloudflare's `env`
 * binding object, or `process.env` in Node-based tooling/tests).
 * Throws InvalidEnvironmentError with every failing field rather than the
 * first, so misconfiguration can be fixed in one pass.
 */
export function parseEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new InvalidEnvironmentError(result.error.issues);
  }
  return result.data;
}
