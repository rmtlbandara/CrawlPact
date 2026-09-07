import { and, eq } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import type { BatchItem } from "drizzle-orm/batch";
import { getActiveAdminRoles } from "../admin/roles";
import { listActiveCredentials } from "./credentials";

/**
 * CrawlPact-account resolution for a verified Google identity (ADR-0009).
 * Google's `sub` (subject) claim is the only identity key ever used here —
 * never email. See docs/architecture/adr/ADR-0009-GOOGLE-FEDERATED-AUTHENTICATION.md
 * §"Identity key" for why an email match can never prove two accounts
 * belong to the same person in this data model.
 */

type OAuthAccountRow = typeof schema.oauthAccounts.$inferSelect;

const DEFAULT_DISPLAY_NAME = "CrawlPact user";
const MAX_DISPLAY_NAME_LENGTH = 80;

/** Same sanitization contract as PATCH /api/account (trim, bounded length) — Google's `name` claim is untrusted input like any other. */
export function deriveDisplayName(googleName: string | null): string {
  const trimmed = (googleName ?? "").trim();
  if (trimmed.length === 0) return DEFAULT_DISPLAY_NAME;
  return trimmed.slice(0, MAX_DISPLAY_NAME_LENGTH);
}

export async function isAdminAccount(db: Database, userId: string): Promise<boolean> {
  const roles = await getActiveAdminRoles(db, userId);
  return roles.length > 0;
}

export async function findGoogleAccountBySubject(
  db: Database,
  sub: string,
): Promise<OAuthAccountRow | null> {
  const [row] = await db
    .select()
    .from(schema.oauthAccounts)
    .where(
      and(
        eq(schema.oauthAccounts.provider, "google"),
        eq(schema.oauthAccounts.providerSubject, sub),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function findGoogleAccountByUserId(
  db: Database,
  userId: string,
): Promise<OAuthAccountRow | null> {
  const [row] = await db
    .select()
    .from(schema.oauthAccounts)
    .where(
      and(eq(schema.oauthAccounts.userId, userId), eq(schema.oauthAccounts.provider, "google")),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Refreshes provider metadata on every successful sign-in — section 20:
 * "update it when Google later supplies a changed verified address." The
 * identity itself never changes (still keyed on `sub`/`id`, not email) —
 * this only keeps the display metadata current.
 */
async function touchGoogleAccount(
  db: Database,
  id: string,
  fresh: { email: string | null; emailVerified: boolean },
): Promise<void> {
  await db
    .update(schema.oauthAccounts)
    .set({
      email: fresh.email,
      emailVerified: fresh.emailVerified,
      lastUsedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.oauthAccounts.id, id));
}

export type GoogleAuthOutcome =
  | { ok: true; userId: string }
  | { ok: false; reason: "not_linked" | "account_unavailable" | "admin_requires_passkey" };

/**
 * Resolves an already-linked Google identity to its CrawlPact user, subject
 * to the same account-status policy as passkey login (`suspended` blocks,
 * `pending_deletion` does not — see login/finish.ts) plus the mandatory
 * admin isolation rule: an account with any active administrator role can
 * never be authenticated via Google, full stop (section 29 — a compromised
 * Google credential must never be a path into the admin account shell).
 */
export async function resolveGoogleSignIn(
  db: Database,
  identity: { sub: string; email: string | null; emailVerified: boolean },
): Promise<GoogleAuthOutcome> {
  const oauthAccount = await findGoogleAccountBySubject(db, identity.sub);
  if (!oauthAccount) return { ok: false, reason: "not_linked" };

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, oauthAccount.userId))
    .limit(1);
  if (!user || user.status === "suspended") {
    return { ok: false, reason: "account_unavailable" };
  }

  if (await isAdminAccount(db, user.id)) {
    return { ok: false, reason: "admin_requires_passkey" };
  }

  await touchGoogleAccount(db, oauthAccount.id, {
    email: identity.email,
    emailVerified: identity.emailVerified,
  });
  return { ok: true, userId: user.id };
}

export type GoogleSignUpOutcome =
  | { ok: true; userId: string; created: boolean }
  // "not_linked" is only theoretically reachable here (a TOCTOU race where
  // the just-found oauth_accounts row's user is deleted between the lookup
  // above and `resolveGoogleSignIn` re-reading it) — included so the return
  // type stays honest about what `resolveGoogleSignIn` can actually produce,
  // not filtered out.
  | { ok: false; reason: "not_linked" | "account_unavailable" | "admin_requires_passkey" };

/**
 * "Sign up with Google": idempotent by design (section 17/51) — a Google
 * `sub` already linked signs into the existing account rather than ever
 * creating a second one, so repeatedly clicking "Sign up with Google"
 * (double submit, browser back-button replay) can never duplicate an
 * account. New-user creation mirrors passkey registration's defaults
 * exactly (status=active, planId=free, isAdmin=false — see
 * register/finish.ts) and is atomic: the `users` row and its `oauth_accounts`
 * association are written in one `db.batch()`, so there is never a window
 * with one but not the other, and a concurrent duplicate signup for the
 * same `sub` can only ever win the race once — the second batch's INSERT
 * fails the `UNIQUE (provider, provider_subject)` constraint, and that
 * caller falls back to resolving the row the first caller just created.
 */
export async function resolveOrCreateGoogleSignUp(
  db: Database,
  identity: { sub: string; email: string | null; emailVerified: boolean; name: string | null },
): Promise<GoogleSignUpOutcome> {
  const existing = await findGoogleAccountBySubject(db, identity.sub);
  if (existing) {
    const outcome = await resolveGoogleSignIn(db, identity);
    if (!outcome.ok) return outcome;
    return { ok: true, userId: outcome.userId, created: false };
  }

  const userId = crypto.randomUUID();
  const now = new Date().toISOString();
  const statements: BatchItem<"sqlite">[] = [
    db.insert(schema.users).values({
      id: userId,
      displayName: deriveDisplayName(identity.name),
      status: "active",
      planId: "free",
      isAdmin: false,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(schema.oauthAccounts).values({
      id: crypto.randomUUID(),
      userId,
      provider: "google",
      providerSubject: identity.sub,
      email: identity.email,
      emailVerified: identity.emailVerified,
      createdAt: now,
      updatedAt: now,
      lastUsedAt: now,
    }),
  ];

  try {
    await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
  } catch {
    // Lost a concurrent-signup race on the (provider, provider_subject)
    // uniqueness constraint — the other request's user now owns this `sub`.
    // Resolve it the same way an already-linked signup does, rather than
    // surfacing the DB error; the orphan `users` row inserted by this
    // failed batch never commits, since `db.batch()` is all-or-nothing.
    const outcome = await resolveGoogleSignIn(db, identity);
    if (!outcome.ok) return outcome;
    return { ok: true, userId: outcome.userId, created: false };
  }

  return { ok: true, userId, created: true };
}

export type GoogleLinkOutcome =
  | { ok: true }
  | {
      ok: false;
      reason: "linked_elsewhere" | "user_already_has_google" | "admin_requires_passkey";
    };

/**
 * Explicit account linking (section 21-23): the account must already be
 * authenticated (the caller derives `userId` from the session, never the
 * request body) and the Google identity must not already belong to a
 * different CrawlPact user. Never merges by email. Relinking the exact same
 * `(userId, sub)` pair is treated as idempotent success (section 52), not an
 * error — a double-submitted "Connect Google" click must not fail.
 */
export async function linkGoogleAccount(
  db: Database,
  params: { userId: string; sub: string; email: string | null; emailVerified: boolean },
): Promise<GoogleLinkOutcome> {
  if (await isAdminAccount(db, params.userId)) {
    return { ok: false, reason: "admin_requires_passkey" };
  }

  const bySubject = await findGoogleAccountBySubject(db, params.sub);
  if (bySubject) {
    if (bySubject.userId !== params.userId) return { ok: false, reason: "linked_elsewhere" };
    // Same Google identity, same account — idempotent success.
    await db
      .update(schema.oauthAccounts)
      .set({
        email: params.email,
        emailVerified: params.emailVerified,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.oauthAccounts.id, bySubject.id));
    return { ok: true };
  }

  const existingForUser = await findGoogleAccountByUserId(db, params.userId);
  if (existingForUser) {
    // This account already has a *different* Google identity connected.
    // Deliberately not an implicit "replace" (section 23's anti-auto-merge
    // posture extends to not silently swapping a connected identity either)
    // — the account holder must disconnect the existing one first.
    return { ok: false, reason: "user_already_has_google" };
  }

  const now = new Date().toISOString();
  try {
    await db.insert(schema.oauthAccounts).values({
      id: crypto.randomUUID(),
      userId: params.userId,
      provider: "google",
      providerSubject: params.sub,
      email: params.email,
      emailVerified: params.emailVerified,
      createdAt: now,
      updatedAt: now,
      lastUsedAt: now,
    });
  } catch {
    // Lost a race against a concurrent link/signup for the same `sub`.
    const raced = await findGoogleAccountBySubject(db, params.sub);
    if (raced && raced.userId === params.userId) return { ok: true };
    return { ok: false, reason: "linked_elsewhere" };
  }

  return { ok: true };
}

export type GoogleDisconnectOutcome =
  { ok: true } | { ok: false; reason: "not_connected" | "lockout_risk" };

/**
 * Section 24: disconnecting Google must never leave the account with no
 * usable sign-in method. Recovery codes are a one-time backstop, not a
 * permanent authenticator, so they are deliberately not counted here — only
 * an active passkey makes disconnecting Google safe.
 */
export async function disconnectGoogleAccount(
  db: Database,
  userId: string,
): Promise<GoogleDisconnectOutcome> {
  const existing = await findGoogleAccountByUserId(db, userId);
  if (!existing) return { ok: false, reason: "not_connected" };

  const activePasskeys = await listActiveCredentials(db, userId);
  if (activePasskeys.length === 0) return { ok: false, reason: "lockout_risk" };

  await db.delete(schema.oauthAccounts).where(eq(schema.oauthAccounts.id, existing.id));
  return { ok: true };
}
