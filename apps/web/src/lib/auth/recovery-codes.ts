import { and, eq, isNull } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";

const CODE_COUNT = 10;
// Excludes 0/O/1/I/L to avoid visual ambiguity when a user transcribes a
// downloaded code by hand (SRS §24: recovery codes shall be downloadable).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const GROUP_LENGTH = 5;
const GROUP_COUNT = 3;

function generateOneCode(): string {
  const bytes = new Uint8Array(GROUP_LENGTH * GROUP_COUNT);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]);
  const groups: string[] = [];
  for (let i = 0; i < GROUP_COUNT; i++) {
    groups.push(chars.slice(i * GROUP_LENGTH, (i + 1) * GROUP_LENGTH).join(""));
  }
  return groups.join("-");
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

async function hashCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalizeCode(code)),
  );
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Regenerating always invalidates the previous set in full (SRS §24) — old,
 * unused codes are deleted outright rather than merely superseded, so a
 * stale downloaded PDF/CSV can never be replayed after a user regenerates.
 */
export async function generateRecoveryCodes(db: Database, userId: string): Promise<string[]> {
  await db.delete(schema.recoveryCodes).where(eq(schema.recoveryCodes.userId, userId));

  const codes = Array.from({ length: CODE_COUNT }, generateOneCode);
  const now = new Date().toISOString();
  await db.insert(schema.recoveryCodes).values(
    await Promise.all(
      codes.map(async (code) => ({
        id: crypto.randomUUID(),
        userId,
        codeHash: await hashCode(code),
        createdAt: now,
      })),
    ),
  );

  return codes;
}

export type RedeemRecoveryCodeResult = { ok: true; userId: string } | { ok: false };

export async function redeemRecoveryCode(
  db: Database,
  code: string,
): Promise<RedeemRecoveryCodeResult> {
  const codeHash = await hashCode(code);
  const [row] = await db
    .select()
    .from(schema.recoveryCodes)
    .where(and(eq(schema.recoveryCodes.codeHash, codeHash), isNull(schema.recoveryCodes.usedAt)))
    .limit(1);

  if (!row) return { ok: false };

  await db
    .update(schema.recoveryCodes)
    .set({ usedAt: new Date().toISOString() })
    .where(eq(schema.recoveryCodes.id, row.id));

  return { ok: true, userId: row.userId };
}
