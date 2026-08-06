import { and, count, eq } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";

/**
 * Saved views over the portfolio table (docs/product/DOMAIN_GROUP_MODEL.md,
 * prompt §20) — wires up the existing, previously-unconsumed `saved_filters`
 * table (migration 0008). Private to the owning user; bounded per user;
 * server-side validated; no arbitrary query execution (the stored
 * `filterState` is opaque JSON echoed back to the same portfolio-table
 * query builder that already validates every field, never interpolated
 * into SQL).
 */

const MAX_SAVED_VIEWS_PER_USER = 20;
export const SAVED_VIEW_CONTEXT = "workspace_portfolio_table";

export type SavedView = {
  id: string;
  name: string;
  filterState: string;
  createdAt: string;
};

export async function listSavedViews(db: Database, userId: string): Promise<SavedView[]> {
  const rows = await db
    .select()
    .from(schema.savedFilters)
    .where(
      and(
        eq(schema.savedFilters.userId, userId),
        eq(schema.savedFilters.context, SAVED_VIEW_CONTEXT),
      ),
    );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    filterState: r.filterState,
    createdAt: r.createdAt,
  }));
}

export async function createSavedView(
  db: Database,
  userId: string,
  name: string,
  filterState: string,
): Promise<{ ok: true; id: string } | { ok: false; reason: "limit_reached" }> {
  const [existingCount] = await db
    .select({ value: count() })
    .from(schema.savedFilters)
    .where(
      and(
        eq(schema.savedFilters.userId, userId),
        eq(schema.savedFilters.context, SAVED_VIEW_CONTEXT),
      ),
    );
  if ((existingCount?.value ?? 0) >= MAX_SAVED_VIEWS_PER_USER) {
    return { ok: false, reason: "limit_reached" };
  }

  const id = crypto.randomUUID();
  await db.insert(schema.savedFilters).values({
    id,
    userId,
    context: SAVED_VIEW_CONTEXT,
    name,
    filterState,
    createdAt: new Date().toISOString(),
  });
  return { ok: true, id };
}

export async function deleteSavedView(db: Database, userId: string, id: string): Promise<boolean> {
  const result = await db
    .delete(schema.savedFilters)
    .where(and(eq(schema.savedFilters.id, id), eq(schema.savedFilters.userId, userId)))
    .returning({ id: schema.savedFilters.id });
  return result.length > 0;
}
