import { eq } from "drizzle-orm";
import { schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import { getEnv } from "../env";

export const SESSION_COOKIE_NAME = "crawlpact_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours (SRS §28.20: shorter admin session lifetime)
const RECENT_AUTH_WINDOW_MS = 5 * 60 * 1000; // 5 minutes, for step-up checks

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export type SessionRecord = {
  id: string;
  userId: string;
  isAdminSession: boolean;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  lastAuthenticatedAt: string;
  userAgent: string | null;
};

/** Creates a new DB-backed session (ADR-0004) and returns the opaque token to set as a cookie. */
export async function createSession(
  db: Database,
  userId: string,
  options: { isAdminSession?: boolean; userAgent?: string | null; ipHash?: string | null } = {},
): Promise<{ token: string; expiresAt: string }> {
  const token = randomToken();
  const now = new Date();
  const ttl = options.isAdminSession ? ADMIN_SESSION_TTL_MS : SESSION_TTL_MS;
  const expiresAt = new Date(now.getTime() + ttl).toISOString();

  await db.insert(schema.sessions).values({
    id: token,
    userId,
    userAgent: options.userAgent ?? null,
    ipHash: options.ipHash ?? null,
    isAdminSession: options.isAdminSession ?? false,
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    expiresAt,
    lastAuthenticatedAt: now.toISOString(),
  });

  return { token, expiresAt };
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (!key) continue;
    result[key] = decodeURIComponent(rest.join("="));
  }
  return result;
}

export function readSessionToken(request: Request): string | null {
  const cookies = parseCookies(request.headers.get("cookie"));
  return cookies[SESSION_COOKIE_NAME] ?? null;
}

export async function getSessionAndUser(
  db: Database,
  token: string,
): Promise<{
  session: typeof schema.sessions.$inferSelect;
  user: typeof schema.users.$inferSelect;
} | null> {
  const [row] = await db
    .select({ session: schema.sessions, user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(eq(schema.sessions.id, token))
    .limit(1);

  if (!row) return null;
  if (row.session.revokedAt) return null;
  if (new Date(row.session.expiresAt).getTime() < Date.now()) return null;

  return row;
}

export async function touchSession(db: Database, token: string): Promise<void> {
  await db
    .update(schema.sessions)
    .set({ lastSeenAt: new Date().toISOString() })
    .where(eq(schema.sessions.id, token));
}

export async function revokeSession(db: Database, sessionId: string): Promise<void> {
  await db
    .update(schema.sessions)
    .set({ revokedAt: new Date().toISOString() })
    .where(eq(schema.sessions.id, sessionId));
}

/** SRS §24/§28.20: sensitive actions require a recent WebAuthn re-assertion, not just a valid session. */
export function isRecentlyAuthenticated(session: { lastAuthenticatedAt: string }): boolean {
  return Date.now() - new Date(session.lastAuthenticatedAt).getTime() < RECENT_AUTH_WINDOW_MS;
}

export function buildSessionCookie(token: string, expiresAt: string): string {
  const isLocal = getEnv().PUBLIC_APP_ENV === "local";
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${new Date(expiresAt).toUTCString()}`,
  ];
  if (!isLocal) parts.push("Secure");
  return parts.join("; ");
}

export function buildClearedSessionCookie(): string {
  const isLocal = getEnv().PUBLIC_APP_ENV === "local";
  const parts = [`${SESSION_COOKIE_NAME}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (!isLocal) parts.push("Secure");
  return parts.join("; ");
}
