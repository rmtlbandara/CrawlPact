import { isNotNull } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import type { AgencyBranding } from "@crawlpact/core";
import { objectKeyFromLogoUrl } from "./agency-logo";

/**
 * R2 orphan-object inventory and cleanup for the `AGENCY_LOGOS` bucket
 * (Phase 11, Stage 11D). This bucket has exactly one write path (agency
 * branding logo upload) and, as `DATA_RETENTION.md`'s "Object storage
 * cleanup" section already disclosed, two known gaps that can leave an
 * object behind with no D1 row referencing it any more: bulk share
 * revocation and account deletion neither one deletes the departing
 * user's logo objects. This is the bounded, read-verified, dry-run-capable
 * process that finds (and optionally deletes) those orphans, rather than
 * leaving the disclosed gap open indefinitely.
 *
 * Safety model:
 * - **Bounded pages**: one `bucket.list()` call per invocation, capped at
 *   `maxObjects` — this never tries to enumerate the whole bucket in one
 *   invocation, matching the same "bounded work per run" discipline as
 *   `data-retention.ts`'s chunked purges. A bucket with more objects than
 *   one page reports `truncated: true`; a future run's cursor continues
 *   from where the last one left off (the caller is responsible for
 *   persisting/passing the cursor if continuation across runs matters —
 *   this phase's admin-triggered use is manual/bounded, not a cron job).
 * - **D1-reference confirmation, not assumption**: an object is only
 *   classified as orphaned after checking every real `shared_reports` row
 *   with non-null `agency_branding`, and (Phase 9) every
 *   `agency_brand_profiles.logo_url`, confirming none of them reference
 *   this key. Both tables are small (single digits to low hundreds in
 *   production) — a full in-memory scan of their own branding/logo values
 *   is simpler and more auditable than a fragile `LIKE` match on JSON
 *   text, and no less accurate. A profile logo can exist with no share
 *   referencing it yet (a user sets up branding before their first
 *   share) — without this second reference source it would be wrongly
 *   flagged as orphaned. See docs/product/AGENCY_BRANDING_MODEL.md's "R2
 *   lifecycle correction."
 * - **Grace period**: an object uploaded within the last `graceMinutes` is
 *   never treated as orphaned even if no D1 row references it yet — the
 *   real upload route writes the R2 object and the D1 row in that order
 *   (object first, so a failed D1 write never leaves a dangling reference),
 *   so a genuinely-in-progress upload can transiently look unreferenced.
 */

const DEFAULT_MAX_OBJECTS = 1000;
const DEFAULT_GRACE_MINUTES = 60;

export type R2OrphanCleanupResult = {
  scanned: number;
  orphansFound: string[];
  orphansDeleted: number;
  dryRun: boolean;
  /** True if the bucket has more objects than this run's bounded page covered — not every
   * object was inspected this run. */
  truncated: boolean;
  nextCursor: string | undefined;
};

export type R2OrphanCleanupOptions = {
  dryRun?: boolean;
  maxObjects?: number;
  graceMinutes?: number;
  cursor?: string;
};

export async function findAndCleanupOrphanedLogos(
  db: Database,
  bucket: R2Bucket,
  options: R2OrphanCleanupOptions = {},
): Promise<R2OrphanCleanupResult> {
  const dryRun = options.dryRun ?? false;
  const maxObjects = options.maxObjects ?? DEFAULT_MAX_OBJECTS;
  const graceMinutes = options.graceMinutes ?? DEFAULT_GRACE_MINUTES;
  const graceCutoff = new Date(Date.now() - graceMinutes * 60 * 1000);

  const page = await bucket.list({ limit: maxObjects, cursor: options.cursor });

  const [brandedShares, brandProfiles] = await Promise.all([
    db
      .select({ agencyBranding: schema.sharedReports.agencyBranding })
      .from(schema.sharedReports)
      .where(isNotNull(schema.sharedReports.agencyBranding)),
    db
      .select({ logoUrl: schema.agencyBrandProfiles.logoUrl })
      .from(schema.agencyBrandProfiles)
      .where(isNotNull(schema.agencyBrandProfiles.logoUrl)),
  ]);

  const referencedKeys = new Set<string>();
  for (const row of brandedShares) {
    if (!row.agencyBranding) continue;
    let branding: AgencyBranding;
    try {
      branding = JSON.parse(row.agencyBranding) as AgencyBranding;
    } catch {
      continue;
    }
    if (!branding.logoUrl) continue;
    const key = objectKeyFromLogoUrl(branding.logoUrl);
    if (key) referencedKeys.add(key);
  }
  for (const row of brandProfiles) {
    if (!row.logoUrl) continue;
    const key = objectKeyFromLogoUrl(row.logoUrl);
    if (key) referencedKeys.add(key);
  }

  const orphansFound = page.objects
    .filter((object) => !referencedKeys.has(object.key) && object.uploaded < graceCutoff)
    .map((object) => object.key);

  let orphansDeleted = 0;
  if (!dryRun && orphansFound.length > 0) {
    await bucket.delete(orphansFound);
    orphansDeleted = orphansFound.length;
  }

  return {
    scanned: page.objects.length,
    orphansFound,
    orphansDeleted,
    dryRun,
    truncated: page.truncated,
    nextCursor: page.truncated ? page.cursor : undefined,
  };
}
