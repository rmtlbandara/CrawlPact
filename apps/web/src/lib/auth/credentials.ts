import { and, eq, isNull } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import type { WebAuthnCredential } from "@simplewebauthn/server";
import { base64UrlToBytes, bytesToBase64Url } from "../base64url";
import { getActiveAdminRoles } from "../admin/roles";

type PasskeyCredentialRow = typeof schema.passkeyCredentials.$inferSelect;

export function toWebAuthnCredential(row: PasskeyCredentialRow): WebAuthnCredential {
  return {
    id: row.credentialId,
    publicKey: base64UrlToBytes(row.publicKey),
    counter: row.signCount,
    ...(row.transports ? { transports: JSON.parse(row.transports) } : {}),
  };
}

export async function listActiveCredentials(
  db: Database,
  userId: string,
): Promise<PasskeyCredentialRow[]> {
  return db
    .select()
    .from(schema.passkeyCredentials)
    .where(
      and(
        eq(schema.passkeyCredentials.userId, userId),
        isNull(schema.passkeyCredentials.removedAt),
      ),
    );
}

export async function findActiveCredentialById(
  db: Database,
  credentialId: string,
): Promise<PasskeyCredentialRow | null> {
  const [row] = await db
    .select()
    .from(schema.passkeyCredentials)
    .where(
      and(
        eq(schema.passkeyCredentials.credentialId, credentialId),
        isNull(schema.passkeyCredentials.removedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function insertCredential(
  db: Database,
  userId: string,
  label: string,
  credential: WebAuthnCredential,
): Promise<void> {
  const now = new Date().toISOString();
  await db.insert(schema.passkeyCredentials).values({
    id: crypto.randomUUID(),
    userId,
    label,
    credentialId: credential.id,
    publicKey: bytesToBase64Url(credential.publicKey),
    signCount: credential.counter,
    transports: credential.transports ? JSON.stringify(credential.transports) : null,
    createdAt: now,
  });
}

export async function updateCredentialCounter(
  db: Database,
  credentialRowId: string,
  newCounter: number,
): Promise<void> {
  await db
    .update(schema.passkeyCredentials)
    .set({ signCount: newCounter, lastUsedAt: new Date().toISOString() })
    .where(eq(schema.passkeyCredentials.id, credentialRowId));
}

export async function renameCredential(
  db: Database,
  userId: string,
  credentialRowId: string,
  label: string,
): Promise<boolean> {
  const result = await db
    .update(schema.passkeyCredentials)
    .set({ label })
    .where(
      and(
        eq(schema.passkeyCredentials.id, credentialRowId),
        eq(schema.passkeyCredentials.userId, userId),
        isNull(schema.passkeyCredentials.removedAt),
      ),
    )
    .returning({ id: schema.passkeyCredentials.id });
  return result.length > 0;
}

/**
 * SRS §24 implies passkey-only accounts must always retain at least one
 * usable credential — removal is refused if it would leave zero active
 * passkeys, since that would permanently lock the user out (recovery codes
 * are a backstop, not a replacement for this check).
 */
export async function removeCredential(
  db: Database,
  userId: string,
  credentialRowId: string,
): Promise<
  { ok: true } | { ok: false; reason: "not_found" | "last_credential" | "admin_minimum_passkeys" }
> {
  const active = await listActiveCredentials(db, userId);
  if (active.length <= 1) return { ok: false, reason: "last_credential" };
  if (!active.some((row) => row.id === credentialRowId)) return { ok: false, reason: "not_found" };

  // SRS §28.20: "Super Admin accounts shall require... at least two
  // registered passkeys." A single admin-specific passkey lost with no
  // spare would leave that admin unable to sign in at all (recovery codes
  // exist, but they're the general account-recovery path, not a
  // substitute for the admin-specific requirement the SRS states
  // explicitly). Only blocks dropping below 2 for an active admin account
  // — ordinary users still only need to keep 1.
  if (active.length <= 2) {
    const roles = await getActiveAdminRoles(db, userId);
    if (roles.length > 0) return { ok: false, reason: "admin_minimum_passkeys" };
  }

  await db
    .update(schema.passkeyCredentials)
    .set({ removedAt: new Date().toISOString() })
    .where(
      and(
        eq(schema.passkeyCredentials.id, credentialRowId),
        eq(schema.passkeyCredentials.userId, userId),
      ),
    );
  return { ok: true };
}
