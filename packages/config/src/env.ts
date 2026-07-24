import { z } from "zod";

/**
 * Canonical environment schema for CrawlPact. This is the single place that
 * defines which environment variables exist, their shape, and their
 * defaults. Route/worker code must read env through `parseEnv`, never
 * through raw `process.env`/`import.meta.env` access, so an invalid or
 * missing configuration fails fast and loudly instead of silently.
 */
export const envSchema = z.object({
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

  AUDIT_ENGINE_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export type Env = z.infer<typeof envSchema>;

export class InvalidEnvironmentError extends Error {
  constructor(readonly issues: z.ZodIssue[]) {
    super(
      `Invalid environment configuration:\n${issues
        .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
        .join("\n")}`,
    );
    this.name = "InvalidEnvironmentError";
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
