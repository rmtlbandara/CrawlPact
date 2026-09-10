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
    // App-subdomain origin-separation migration (ADR-0010). Introduced
    // optional/unconsumed in Phase 1 (2026-09-09); Phase 2 (2026-09-09) is
    // the first code to read it — `lib/origin.ts`'s trusted-origin registry,
    // consumed by CSRF (`auth/same-origin.ts`) and WebAuthn ceremony pinning
    // (`auth/webauthn.ts`). Phase 3 (2026-09-10) attached the real
    // `app.crawlpact.com` Custom Domain and production has genuinely
    // consumed a real value here ever since — the field itself stays
    // `.optional()` at the type level (only `local` single-origin
    // development is exempt from actually needing it; see the `superRefine`
    // below for `preview`/`production`), so this comment no longer describes
    // current reality and is corrected here rather than left stale
    // (Phase 1–3 closure review, 2026-09-10).
    PUBLIC_APP_URL: z.string().url().optional(),

    SESSION_SIGNING_SECRET: z.string().min(16),
    // Phase 12 (RISK-022): dedicated key for target-frequency abuse-detection
    // HMACs, deliberately separate from SESSION_SIGNING_SECRET -- see
    // docs/security/TARGET_ABUSE_MONITORING_DESIGN.md.
    ABUSE_MONITORING_SECRET: z.string().min(16),
    WEBAUTHN_RP_ID: z.string().min(1),
    // Phase 2 of the app-subdomain migration (ADR-0010) replaced the single
    // fixed expected-origin model with per-ceremony origin pinning
    // (`auth/webauthn.ts` signs the *validated request origin* into each
    // challenge token instead) — `webauthn.ts` no longer reads this value.
    // Left in the schema, still required, so every existing deployment/test
    // config stays valid without a mechanical edit; safe to remove in a
    // later cleanup once the dual-origin migration window closes (Phase 4).
    WEBAUTHN_RP_ORIGIN: z.string().url(),

    GOOGLE_CLIENT_ID: z
      .string()
      .min(1)
      .refine((value) => value.endsWith(".apps.googleusercontent.com"), {
        message: "GOOGLE_CLIENT_ID must be a valid Google OAuth Web Client ID.",
      }),

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

    // Phase 1–3 closure review (2026-09-10, ADR-0010): a deployed environment
    // (preview or production) that lacks a valid, HTTPS, distinct app origin
    // silently degrades — `lib/origin.ts` treats every request as either
    // "public" or "unknown", so the app-subdomain boundary this migration
    // built simply never engages, with no error anywhere. `local` stays
    // exempt on purpose: single-origin local development legitimately sets
    // `PUBLIC_APP_URL` equal to `PUBLIC_SITE_URL` (both `http://localhost:...`,
    // see `.env.example`), which is correct there and would be a real bug
    // everywhere else.
    if (value.PUBLIC_APP_ENV !== "local") {
      if (!value.PUBLIC_SITE_URL.startsWith("https://")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["PUBLIC_SITE_URL"],
          message: `PUBLIC_SITE_URL must be an HTTPS URL when PUBLIC_APP_ENV is "${value.PUBLIC_APP_ENV}".`,
        });
      }

      if (!value.PUBLIC_APP_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["PUBLIC_APP_URL"],
          message: `PUBLIC_APP_URL is required when PUBLIC_APP_ENV is "${value.PUBLIC_APP_ENV}" — only local single-origin development may omit it.`,
        });
      } else {
        if (!value.PUBLIC_APP_URL.startsWith("https://")) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["PUBLIC_APP_URL"],
            message: `PUBLIC_APP_URL must be an HTTPS URL when PUBLIC_APP_ENV is "${value.PUBLIC_APP_ENV}".`,
          });
        }
        if (value.PUBLIC_APP_URL === value.PUBLIC_SITE_URL) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["PUBLIC_APP_URL"],
            message: `PUBLIC_APP_URL must differ from PUBLIC_SITE_URL when PUBLIC_APP_ENV is "${value.PUBLIC_APP_ENV}" — they may only be equal in local single-origin development.`,
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
