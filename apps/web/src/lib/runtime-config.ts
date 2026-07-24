import { eq } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";

/** Operator-tunable limits (SRS §28, `runtime_configuration` — Super Admin can edit these in Part 3; Part 2 only reads them). */
export async function getIntConfig(db: Database, key: string, fallback: number): Promise<number> {
  const [row] = await db
    .select({ value: schema.runtimeConfiguration.value })
    .from(schema.runtimeConfiguration)
    .where(eq(schema.runtimeConfiguration.key, key))
    .limit(1);
  if (!row) return fallback;
  const parsed = Number(row.value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function getBoolConfig(
  db: Database,
  key: string,
  fallback: boolean,
): Promise<boolean> {
  const [row] = await db
    .select({ value: schema.runtimeConfiguration.value })
    .from(schema.runtimeConfiguration)
    .where(eq(schema.runtimeConfiguration.key, key))
    .limit(1);
  if (!row) return fallback;
  return row.value === "true";
}

export async function getStringConfig(
  db: Database,
  key: string,
  fallback: string,
): Promise<string> {
  const [row] = await db
    .select({ value: schema.runtimeConfiguration.value })
    .from(schema.runtimeConfiguration)
    .where(eq(schema.runtimeConfiguration.key, key))
    .limit(1);
  return row ? row.value : fallback;
}
