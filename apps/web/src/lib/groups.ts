import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import type { DomainGroup } from "@crawlpact/core";

type GroupRow = typeof schema.domainGroups.$inferSelect;

export async function listGroups(db: Database, userId: string): Promise<DomainGroup[]> {
  const rows = await db
    .select()
    .from(schema.domainGroups)
    .where(and(eq(schema.domainGroups.ownerUserId, userId), isNull(schema.domainGroups.deletedAt)));
  if (rows.length === 0) return [];

  // One batched count query, not one per group (no N+1).
  const counts = await db
    .select({ groupId: schema.domains.groupId, value: count() })
    .from(schema.domains)
    .where(
      and(
        eq(schema.domains.ownerUserId, userId),
        isNull(schema.domains.deletedAt),
        inArray(
          schema.domains.groupId,
          rows.map((r) => r.id),
        ),
      ),
    )
    .groupBy(schema.domains.groupId);
  const countByGroupId = new Map(counts.map((c) => [c.groupId, c.value]));

  return rows.map((row) => ({
    groupId: row.id,
    name: row.name,
    description: row.description,
    domainCount: countByGroupId.get(row.id) ?? 0,
    createdAt: row.createdAt,
  }));
}

export async function getOwnedGroup(
  db: Database,
  userId: string,
  groupId: string,
): Promise<GroupRow | null> {
  const [row] = await db
    .select()
    .from(schema.domainGroups)
    .where(
      and(
        eq(schema.domainGroups.id, groupId),
        eq(schema.domainGroups.ownerUserId, userId),
        isNull(schema.domainGroups.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function createGroup(
  db: Database,
  userId: string,
  name: string,
  description: string | null = null,
): Promise<GroupRow> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db
    .insert(schema.domainGroups)
    .values({ id, ownerUserId: userId, name, description, createdAt: now, updatedAt: now });
  const [row] = await db
    .select()
    .from(schema.domainGroups)
    .where(eq(schema.domainGroups.id, id))
    .limit(1);
  return row!;
}

export async function renameGroup(
  db: Database,
  userId: string,
  groupId: string,
  name: string,
  description?: string | null,
): Promise<boolean> {
  const patch: Partial<typeof schema.domainGroups.$inferInsert> = {
    name,
    updatedAt: new Date().toISOString(),
  };
  if (description !== undefined) patch.description = description;

  const result = await db
    .update(schema.domainGroups)
    .set(patch)
    .where(
      and(
        eq(schema.domainGroups.id, groupId),
        eq(schema.domainGroups.ownerUserId, userId),
        isNull(schema.domainGroups.deletedAt),
      ),
    )
    .returning({ id: schema.domainGroups.id });
  return result.length > 0;
}

export async function deleteGroupIfEmpty(
  db: Database,
  userId: string,
  groupId: string,
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "not_empty" }> {
  const group = await getOwnedGroup(db, userId, groupId);
  if (!group) return { ok: false, reason: "not_found" };

  const [domainCount] = await db
    .select({ value: count() })
    .from(schema.domains)
    .where(and(eq(schema.domains.groupId, groupId), isNull(schema.domains.deletedAt)));
  if ((domainCount?.value ?? 0) > 0) return { ok: false, reason: "not_empty" };

  await db
    .update(schema.domainGroups)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(schema.domainGroups.id, groupId));
  return { ok: true };
}

/**
 * Phase 9 (docs/product/DOMAIN_GROUP_MODEL.md §2): deletes a group whether
 * or not it has domains in it, moving any member domains to
 * `destinationGroupId` (or Ungrouped, when null/omitted) first. Domain
 * history, monitoring state, scans, and change events are never touched —
 * only `group_id` moves.
 */
export async function deleteGroupWithReassignment(
  db: Database,
  userId: string,
  groupId: string,
  destinationGroupId: string | null,
): Promise<
  { ok: true; movedCount: number } | { ok: false; reason: "not_found" | "invalid_destination" }
> {
  const group = await getOwnedGroup(db, userId, groupId);
  if (!group) return { ok: false, reason: "not_found" };

  if (destinationGroupId) {
    if (destinationGroupId === groupId) return { ok: false, reason: "invalid_destination" };
    const destination = await getOwnedGroup(db, userId, destinationGroupId);
    if (!destination) return { ok: false, reason: "invalid_destination" };
  }

  const now = new Date().toISOString();
  const moved = await db
    .update(schema.domains)
    .set({ groupId: destinationGroupId, updatedAt: now })
    .where(
      and(
        eq(schema.domains.groupId, groupId),
        eq(schema.domains.ownerUserId, userId),
        isNull(schema.domains.deletedAt),
      ),
    )
    .returning({ id: schema.domains.id });

  await db
    .update(schema.domainGroups)
    .set({ deletedAt: now })
    .where(eq(schema.domainGroups.id, groupId));

  return { ok: true, movedCount: moved.length };
}
