import { env } from "cloudflare:workers";

/**
 * The only place in `apps/web` that imports `cloudflare:workers` directly.
 * Astro v6+ removed `Astro.locals.runtime.env` in favour of this module
 * import (see apps/web/src/env.d.ts for the `Cloudflare.Env` typing this
 * relies on). Routing all env access through this one function — instead
 * of importing `cloudflare:workers` from every route — means tests can
 * mock a single small module instead of needing a real Workers runtime.
 */
export function getEnv(): Cloudflare.Env {
  return env;
}
