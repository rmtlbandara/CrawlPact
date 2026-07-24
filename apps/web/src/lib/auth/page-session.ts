import type { Database } from "@crawlpact/database";
import { getSessionAndUser, readSessionToken } from "./session";

/**
 * The Astro-page counterpart to require-session.ts's `requireSession`
 * (which throws `ApiError` for API routes). Pages redirect on a missing
 * session instead of returning a JSON error, so this returns `null` and
 * lets the caller `return Astro.redirect("/sign-in")`.
 */
export async function getPageSession(db: Database, request: Request) {
  const token = readSessionToken(request);
  if (!token) return null;
  return getSessionAndUser(db, token);
}
