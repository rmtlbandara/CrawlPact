import { and, count, eq, isNull } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import type { DomainGroup } from "@crawlpact/core";

type GroupRow = typeof schema.domainGroups.$inferSelect;

export async function listGroups(db: Database, userId: string): Promise<DomainGroup[]> {
  const rows = await db
    .select()
    .from(schema.domainGroups)
    .where(and(eq(schema.domainGroups.ownerUserId, userId), isNull(schema.domainGroups.deletedAt)));

  return Promise.all(
    rows.map(async (row) => {
      const [domainCount] = await db
        .select({ value: count() })
        .from(schema.domains)
        .where(and(eq(schema.domains.groupId, row.id), isNull(schema.domains.deletedAt)));
      return {
        groupId: row.id,
        name: row.name,
        domainCount: domainCount?.value ?? 0,
        createdAt: row.createdAt,
      };
    }),
  );
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

export async function createGroup(db: Database, userId: string, name: string): Promise<GroupRow> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db
    .insert(schema.domainGroups)
    .values({ id, ownerUserId: userId, name, createdAt: now, updatedAt: now });
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
): Promise<boolean> {
  const result = await db
    .update(schema.domainGroups)
    .set({ name, updatedAt: new Date().toISOString() })
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
