/// <reference types="astro/client" />

/**
 * Cloudflare bindings and vars for this Worker (apps/web/wrangler.jsonc).
 * Astro v6+ / @astrojs/cloudflare no longer expose these via
 * `Astro.locals.runtime.env` (that getter now throws, on purpose, to force
 * migration) — read them via `import { env } from "cloudflare:workers"`
 * instead, typed through this `Cloudflare.Env` augmentation. See
 * apps/web/src/pages/api/audit/index.ts for the pattern.
 */
type CloudflareRuntimeEnv = {
  DB: D1Database;
  AGENCY_LOGOS: R2Bucket;
  PUBLIC_APP_ENV: "local" | "preview" | "production";
  PUBLIC_SITE_URL: string;
  SESSION_SIGNING_SECRET: string;
  WEBAUTHN_RP_ID: string;
  WEBAUTHN_RP_ORIGIN: string;
  PADDLE_API_KEY: string;
  PADDLE_ENVIRONMENT: "sandbox" | "production";
  PADDLE_WEBHOOK_SECRET: string;
  PADDLE_PRICE_ID_SOLO: string;
  PADDLE_PRICE_ID_PRO: string;
  PADDLE_PRICE_ID_AGENCY: string;
  PUBLIC_PADDLE_CLIENT_TOKEN: string;
  BILLING_ENABLED: string;
  AUDIT_ENGINE_ENABLED: string;
};

declare namespace Cloudflare {
  // An interface (not a type alias) is required here so this augments the
  // ambient `Cloudflare` namespace via declaration merging.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Env extends CloudflareRuntimeEnv {}
}

declare namespace App {
  interface Locals {
    requestId: string;
  }
}
