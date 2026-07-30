import { and, eq, isNull } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import type { AgencyBranding } from "@crawlpact/core";
import { bytesToBase64Url } from "./base64url";
import { objectKeyFromLogoUrl } from "./agency-logo";

/** The R2 object key of a revoked share's agency logo, if it had one — the
 * caller (a route, which owns R2 binding access) deletes it from R2 only
 * after this D1 update has already succeeded, per
 * docs/data/DATA_RETENTION.md's "R2 deletion must never precede the D1
 * reference" rule. */
function logoObjectKeyFromStoredBranding(agencyBrandingJson: string | null): string | null {
  if (!agencyBrandingJson) return null;
  const branding = JSON.parse(agencyBrandingJson) as AgencyBranding;
  return branding.logoUrl ? objectKeyFromLogoUrl(branding.logoUrl) : null;
}

async function hashShareToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Confirms the caller owns the domain this scan belongs to — anonymous scans (no domainId) can never be shared this way. */
async function ownsScan(db: Database, userId: string, scanId: string): Promise<boolean> {
  const [row] = await db
    .select({ ownerUserId: schema.domains.ownerUserId })
    .from(schema.scans)
    .innerJoin(schema.domains, eq(schema.scans.domainId, schema.domains.id))
    .where(eq(schema.scans.id, scanId))
    .limit(1);
  return row?.ownerUserId === userId;
}

export async function createShare(
  db: Database,
  userId: string,
  scanId: string,
  expiresInDays: number | undefined,
  agencyBranding: AgencyBranding | null,
): Promise<
  | { ok: true; shareId: string; token: string; expiresAt: string | null; createdAt: string }
  | { ok: false }
> {
  if (!(await ownsScan(db, userId, scanId))) return { ok: false };

  const token = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const id = crypto.randomUUID();
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = expiresInDays
    ? new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  await db.insert(schema.sharedReports).values({
    id,
    scanId,
    ownerUserId: userId,
    tokenHash: await hashShareToken(token),
    agencyBranding: agencyBranding ? JSON.stringify(agencyBranding) : null,
    expiresAt,
    createdAt,
  });

  return { ok: true, shareId: id, token, expiresAt, createdAt };
}

export async function listShares(db: Database, userId: string, scanId: string) {
  return db
    .select()
    .from(schema.sharedReports)
    .where(
      and(
        eq(schema.sharedReports.ownerUserId, userId),
        eq(schema.sharedReports.scanId, scanId),
        isNull(schema.sharedReports.revokedAt),
      ),
    );
}

export type RevokeShareResult = { revoked: boolean; logoObjectKey: string | null };

export async function revokeShare(
  db: Database,
  userId: string,
  shareId: string,
): Promise<RevokeShareResult> {
  const [row] = await db
    .update(schema.sharedReports)
    .set({ revokedAt: new Date().toISOString() })
    .where(and(eq(schema.sharedReports.id, shareId), eq(schema.sharedReports.ownerUserId, userId)))
    .returning({
      id: schema.sharedReports.id,
      agencyBranding: schema.sharedReports.agencyBranding,
    });
  if (!row) return { revoked: false, logoObjectKey: null };
  return {
    revoked: true,
    logoObjectKey: logoObjectKeyFromStoredBranding(row.agencyBranding),
  };
}

/** SRS §28.9 (Super Admin "Shared reports" nav item): every shared report
 * across every customer, for review/revocation. */
export async function listAllSharedReports(db: Database) {
  return db
    .select({
      share: schema.sharedReports,
      owner: { id: schema.users.id, displayName: schema.users.displayName },
    })
    .from(schema.sharedReports)
    .innerJoin(schema.users, eq(schema.sharedReports.ownerUserId, schema.users.id))
    .orderBy(schema.sharedReports.createdAt);
}

/** Admin revocation needs no ownership check — that's the whole point of
 * an administrative override — unlike the customer-facing `revokeShare`. */
export async function adminRevokeShare(
  db: Database,
  shareId: string,
): Promise<{ logoObjectKey: string | null }> {
  const result = await db
    .update(schema.sharedReports)
    .set({ revokedAt: new Date().toISOString() })
    .where(eq(schema.sharedReports.id, shareId))
    .returning({ agencyBranding: schema.sharedReports.agencyBranding });
  return { logoObjectKey: logoObjectKeyFromStoredBranding(result[0]?.agencyBranding ?? null) };
}

/**
 * Resolves a public share token to the scan it grants read access to, plus
 * any agency branding stored on it — null on invalid/expired/revoked.
 */
export type ShareResolution =
  | { status: "valid"; scanId: string; agencyBranding: AgencyBranding | null }
  | { status: "revoked" }
  | { status: "expired" }
  | { status: "invalid" };

/**
 * Distinguishes revoked/expired/invalid rather than collapsing all three into
 * one generic "not available" — a real gap found while reviewing the shared-
 * report page against docs/design/EVIDENCE_OBSERVATORY_REDESIGN_SPEC.md §12,
 * which explicitly calls for the shared-report view to show these as
 * distinct states. The previous version filtered `revokedAt IS NULL` in the
 * SQL WHERE clause itself, so a revoked token was indistinguishable from a
 * token that never existed at the data layer, not just in the UI.
 */
export async function getShareForToken(db: Database, token: string): Promise<ShareResolution> {
  const tokenHash = await hashShareToken(token);
  const [row] = await db
    .select({
      scanId: schema.sharedReports.scanId,
      expiresAt: schema.sharedReports.expiresAt,
      revokedAt: schema.sharedReports.revokedAt,
      agencyBranding: schema.sharedReports.agencyBranding,
    })
    .from(schema.sharedReports)
    .where(eq(schema.sharedReports.tokenHash, tokenHash))
    .limit(1);
  if (!row) return { status: "invalid" };
  if (row.revokedAt) return { status: "revoked" };
  if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
    return { status: "expired" };
  }
  return {
    status: "valid",
    scanId: row.scanId,
    agencyBranding: row.agencyBranding ? (JSON.parse(row.agencyBranding) as AgencyBranding) : null,
  };
}
