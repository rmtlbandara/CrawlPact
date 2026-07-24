import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/**
 * Typed Drizzle client over the `DB` D1 binding declared in
 * apps/web/wrangler.jsonc. Call once per request with
 * `context.locals.runtime.env.DB`.
 */
export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type Database = ReturnType<typeof createDb>;
