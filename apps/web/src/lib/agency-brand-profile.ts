import { eq } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";

/** Persistent agency-branding defaults (docs/product/AGENCY_BRANDING_MODEL.md). One row per
 * Agency-plan user; `clientName`/`introText` stay per-share, not persisted here. */
export async function getAgencyBrandProfile(
  db: Database,
  ownerUserId: string,
): Promise<{ agencyName: string | null; logoUrl: string | null } | null> {
  const [row] = await db
    .select({
      agencyName: schema.agencyBrandProfiles.agencyName,
      logoUrl: schema.agencyBrandProfiles.logoUrl,
    })
    .from(schema.agencyBrandProfiles)
    .where(eq(schema.agencyBrandProfiles.ownerUserId, ownerUserId))
    .limit(1);
  return row ?? null;
}

export async function upsertAgencyBrandProfile(
  db: Database,
  ownerUserId: string,
  fields: { agencyName?: string | null; logoUrl?: string | null },
): Promise<void> {
  const existing = await db
    .select({ id: schema.agencyBrandProfiles.id })
    .from(schema.agencyBrandProfiles)
    .where(eq(schema.agencyBrandProfiles.ownerUserId, ownerUserId))
    .limit(1);
  const now = new Date().toISOString();

  if (existing.length === 0) {
    await db.insert(schema.agencyBrandProfiles).values({
      id: crypto.randomUUID(),
      ownerUserId,
      agencyName: fields.agencyName ?? null,
      logoUrl: fields.logoUrl ?? null,
      createdAt: now,
      updatedAt: now,
    });
    return;
  }

  const patch: Partial<typeof schema.agencyBrandProfiles.$inferInsert> = { updatedAt: now };
  if (fields.agencyName !== undefined) patch.agencyName = fields.agencyName;
  if (fields.logoUrl !== undefined) patch.logoUrl = fields.logoUrl;
  await db
    .update(schema.agencyBrandProfiles)
    .set(patch)
    .where(eq(schema.agencyBrandProfiles.ownerUserId, ownerUserId));
}
