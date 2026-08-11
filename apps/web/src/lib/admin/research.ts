import { desc, eq, inArray } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import {
  computeRegistryObservatoryForRelease,
  getRegistryObservatorySnapshot,
} from "../observatory/registry-observatory";
import {
  buildRegistryLandscapeContent,
  getChecksumSubset,
  validateResearchPublicationContent,
  type ResearchPublicationContent,
  type ResearchPublicationValidationResult,
} from "../research/publication-content";
import { computePublicationChecksum } from "../research/publication-checksum";

function checksumFor(content: ResearchPublicationContent): Promise<string> {
  return computePublicationChecksum(getChecksumSubset(content));
}

/**
 * Phase 16 Super Admin research-publication lifecycle:
 * draft -> review -> published -> corrected -> withdrawn
 * (or draft/review discarded without ever publishing). Mirrors the
 * publish/rollback governance discipline `admin/registry.ts` established in
 * Phase 15 — manual publication (§45), immutable once published except
 * through a governed correction (§47/§49), and every mutation requires a
 * `requireAdminAction` reason at the API-route layer (never enforced here —
 * this module is the business logic, not the auth boundary).
 */

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type ResearchPublicationRow = typeof schema.researchPublications.$inferSelect;

export async function listResearchPublications(db: Database): Promise<ResearchPublicationRow[]> {
  return db
    .select()
    .from(schema.researchPublications)
    .orderBy(desc(schema.researchPublications.createdAt));
}

export async function getResearchPublicationById(
  db: Database,
  id: string,
): Promise<ResearchPublicationRow | null> {
  const [row] = await db
    .select()
    .from(schema.researchPublications)
    .where(eq(schema.researchPublications.id, id))
    .limit(1);
  return row ?? null;
}

/** Public read path — only ever returns a publication a visitor is allowed
 * to see (§110, draft/review must never leak). Withdrawn publications are
 * still returned (rendered with a withdrawal notice, not 404'd — §139/§217),
 * draft/review are not. */
export async function getVisibleResearchPublicationBySlug(
  db: Database,
  slug: string,
): Promise<ResearchPublicationRow | null> {
  const [row] = await db
    .select()
    .from(schema.researchPublications)
    .where(eq(schema.researchPublications.slug, slug))
    .limit(1);
  if (!row) return null;
  if (row.status === "draft" || row.status === "review") return null;
  return row;
}

export async function listPublishedResearchPublications(
  db: Database,
): Promise<ResearchPublicationRow[]> {
  return db
    .select()
    .from(schema.researchPublications)
    .where(inArray(schema.researchPublications.status, ["published", "corrected"]))
    .orderBy(desc(schema.researchPublications.publishedAt));
}

/**
 * Generates the "AI Crawler Registry Landscape" draft from the *current*
 * active registry release — the only publication kind this phase ships
 * (§75; a website-policy benchmark publication requires the separate,
 * unmet, corpus gate — see docs/research/PHASE_16_RESEARCH_CORPUS_DECISION.md).
 * Deterministic: re-running this against an unchanged active release
 * produces byte-identical content and checksum.
 */
export async function generateRegistryLandscapeDraft(
  db: Database,
  params: { createdByUserId: string },
): Promise<{ id: string; slug: string }> {
  const observatory = await getRegistryObservatorySnapshot(db);
  if (!observatory) {
    throw new Error(
      "Cannot generate a Registry Landscape draft: no active registry release exists.",
    );
  }
  const content = buildRegistryLandscapeContent(observatory);
  const checksum = await checksumFor(content);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const baseSlug = slugify(content.title);
  const existingSlugs = new Set(
    (
      await db.select({ slug: schema.researchPublications.slug }).from(schema.researchPublications)
    ).map((r) => r.slug),
  );
  let slug = baseSlug;
  let suffix = 2;
  while (existingSlugs.has(slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  await db.insert(schema.researchPublications).values({
    id,
    slug,
    kind: "registry_landscape",
    status: "draft",
    title: content.title,
    methodologyVersion: content.methodologyVersion,
    registryVersionId: content.registryVersionId,
    contentJson: JSON.stringify(content),
    checksum,
    correctionLog: "[]",
    createdByUserId: params.createdByUserId,
    createdAt: now,
    updatedAt: now,
  });

  return { id, slug };
}

export function parsePublicationContent(row: ResearchPublicationRow): ResearchPublicationContent {
  return JSON.parse(row.contentJson) as ResearchPublicationContent;
}

/** draft -> review, blocked on any validation error (§46, §211). */
export async function submitResearchPublicationForReview(
  db: Database,
  id: string,
): Promise<ResearchPublicationValidationResult> {
  const row = await getResearchPublicationById(db, id);
  if (!row) throw new Error(`Research publication "${id}" not found.`);
  if (row.status !== "draft") {
    throw new Error(
      `Research publication "${id}" is "${row.status}", not "draft" — cannot submit for review.`,
    );
  }
  const validation = validateResearchPublicationContent(parsePublicationContent(row));
  if (validation.errors.length > 0) return validation;

  await db
    .update(schema.researchPublications)
    .set({ status: "review", updatedAt: new Date().toISOString() })
    .where(eq(schema.researchPublications.id, id));
  return validation;
}

/**
 * review -> published. This is the only step that makes a publication
 * publicly visible (§45/§212) — always a Super Admin action, never
 * automatic. Recomputes and re-verifies the checksum immediately before
 * flipping status, so a published row's checksum is guaranteed to match its
 * frozen content at the moment of publication.
 */
export async function publishResearchPublication(
  db: Database,
  id: string,
  publishedByUserId: string,
): Promise<{ alreadyPublished: boolean }> {
  const row = await getResearchPublicationById(db, id);
  if (!row) throw new Error(`Research publication "${id}" not found.`);
  if (row.status === "published" || row.status === "corrected") return { alreadyPublished: true };
  if (row.status !== "review") {
    throw new Error(
      `Research publication "${id}" is "${row.status}", not "review" — cannot publish.`,
    );
  }

  const content = parsePublicationContent(row);
  const validation = validateResearchPublicationContent(content);
  if (validation.errors.length > 0) {
    throw new Error(
      `Research publication "${id}" failed validation and cannot be published: ${validation.errors.map((e) => e.message).join("; ")}`,
    );
  }
  const recomputedChecksum = await checksumFor(content);
  if (recomputedChecksum !== row.checksum) {
    throw new Error(
      `Research publication "${id}" checksum mismatch at publish time (stored ${row.checksum}, recomputed ${recomputedChecksum}) — refusing to publish inconsistent content.`,
    );
  }

  const now = new Date().toISOString();
  await db
    .update(schema.researchPublications)
    .set({ status: "published", publishedAt: now, updatedAt: now })
    .where(eq(schema.researchPublications.id, id));
  void publishedByUserId; // recorded via the API route's requireAdminAction audit log, not a column on this row
  return { alreadyPublished: false };
}

/**
 * Recomputes content from the *same pinned* `registryVersionId` the
 * publication has always used (never a newer active release — §24, don't
 * silently continue a series across an incompatible source change) and
 * records a visible correction entry. Used when a bug in the metric
 * computation itself (not a registry change) produced wrong numbers.
 */
export async function correctResearchPublication(
  db: Database,
  id: string,
  params: { what: string; why: string; conclusionsChanged: boolean },
): Promise<void> {
  const row = await getResearchPublicationById(db, id);
  if (!row) throw new Error(`Research publication "${id}" not found.`);
  if (row.status !== "published" && row.status !== "corrected") {
    throw new Error(
      `Research publication "${id}" is "${row.status}" — only a published publication can be corrected.`,
    );
  }

  const observatory = await getRegistryObservatorySnapshot(db);
  if (!observatory || observatory.registryVersionId !== row.registryVersionId) {
    throw new Error(
      `Cannot recompute "${id}": its pinned registry release "${row.registryVersionId}" is no longer the active release. A correction must recompute from the same release it was published against, not a newer one — publish a new, superseding publication instead.`,
    );
  }
  const content = buildRegistryLandscapeContent(observatory);
  const now = new Date().toISOString();
  const correctionLog = JSON.parse(row.correctionLog) as unknown[];
  correctionLog.push({ date: now, ...params });
  content.correctionLog = correctionLog as ResearchPublicationContent["correctionLog"];
  const checksum = await checksumFor(content);

  await db
    .update(schema.researchPublications)
    .set({
      status: "corrected",
      contentJson: JSON.stringify(content),
      checksum,
      correctionLog: JSON.stringify(correctionLog),
      correctedAt: now,
      updatedAt: now,
    })
    .where(eq(schema.researchPublications.id, id));
}

/** published/corrected -> withdrawn (terminal, §217). Row and URL remain —
 * rendered with a withdrawal banner, not deleted or 404'd. */
export async function withdrawResearchPublication(
  db: Database,
  id: string,
  reason: string,
): Promise<void> {
  const row = await getResearchPublicationById(db, id);
  if (!row) throw new Error(`Research publication "${id}" not found.`);
  if (row.status !== "published" && row.status !== "corrected") {
    throw new Error(
      `Research publication "${id}" is "${row.status}" — only a published publication can be withdrawn.`,
    );
  }
  await db
    .update(schema.researchPublications)
    .set({ status: "withdrawn", withdrawalReason: reason, updatedAt: new Date().toISOString() })
    .where(eq(schema.researchPublications.id, id));
}

/**
 * Recomputes a publication's metrics fresh from its pinned registry release
 * and compares against the stored checksum — no writes. Backs
 * `pnpm research:reproduce` and the publication-reproducibility test (§199).
 */
export async function reproduceResearchPublication(
  db: Database,
  id: string,
): Promise<{ matches: boolean; storedChecksum: string; recomputedChecksum: string }> {
  const row = await getResearchPublicationById(db, id);
  if (!row) throw new Error(`Research publication "${id}" not found.`);

  // Reproduction must use the exact same release the publication was
  // pinned to, which may no longer be the *active* one — so recompute the
  // observatory snapshot logic against that specific release rather than
  // calling getRegistryObservatorySnapshot() (which always reads whichever
  // release is currently active).
  const observatory = await computeRegistryObservatoryForRelease(db, row.registryVersionId);
  const content = buildRegistryLandscapeContent(observatory);
  const recomputedChecksum = await checksumFor(content);

  return {
    matches: recomputedChecksum === row.checksum,
    storedChecksum: row.checksum,
    recomputedChecksum,
  };
}
