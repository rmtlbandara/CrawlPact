import { eq } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";

export async function listRuntimeConfiguration(db: Database) {
  return db.select().from(schema.runtimeConfiguration).orderBy(schema.runtimeConfiguration.key);
}

export type UpdateConfigResult = { ok: true } | { ok: false; reason: string };

/**
 * SRS §28.16: "approved settings only," "safe min/max validation," "no
 * secret editing," "no arbitrary code/config injection." All three are
 * satisfied by construction, not by extra checks:
 *  - Only keys that already exist as a row in `runtime_configuration` can
 *    be updated — there is no "create a new key" path, so an admin can
 *    never inject an arbitrary, unreviewed setting.
 *  - Secrets (Paddle keys, session signing secret, WebAuthn config) live in
 *    Worker environment bindings, not this table, so they are structurally
 *    unreachable from here.
 *  - Every row's `min_value`/`max_value` (for integers) is enforced here;
 *    booleans only accept "true"/"false".
 */
export async function updateRuntimeConfig(
  db: Database,
  params: { key: string; value: string; updatedByUserId: string },
): Promise<UpdateConfigResult> {
  const [existing] = await db
    .select()
    .from(schema.runtimeConfiguration)
    .where(eq(schema.runtimeConfiguration.key, params.key))
    .limit(1);
  if (!existing)
    return {
      ok: false,
      reason: "Unknown configuration key — only existing, reviewed settings can be changed.",
    };

  if (existing.valueType === "boolean") {
    if (params.value !== "true" && params.value !== "false") {
      return {
        ok: false,
        reason: "This setting is boolean — the value must be 'true' or 'false'.",
      };
    }
  } else if (existing.valueType === "integer") {
    const parsed = Number(params.value);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      return { ok: false, reason: "This setting is an integer." };
    }
    if (existing.minValue !== null && parsed < existing.minValue) {
      return { ok: false, reason: `Value must be at least ${existing.minValue}.` };
    }
    if (existing.maxValue !== null && parsed > existing.maxValue) {
      return { ok: false, reason: `Value must be at most ${existing.maxValue}.` };
    }
  }

  await db
    .update(schema.runtimeConfiguration)
    .set({
      value: params.value,
      updatedByUserId: params.updatedByUserId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.runtimeConfiguration.key, params.key));

  return { ok: true };
}

/** SRS §28.16: settings considered "high-impact" require the standard
 * admin-action reason/recent-auth/audit-log path either way, but these
 * specifically get a stronger confirmation copy in the UI (maintenance
 * mode and the scheduler pause affect every customer immediately). */
export const HIGH_IMPACT_KEYS = new Set(["maintenance_mode", "scheduler_paused"]);
