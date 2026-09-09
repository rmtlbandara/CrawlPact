import type { ApiResponse } from "@crawlpact/core";

/** Shared request/response plumbing for API-route integration tests (see auth-flow.integration.test.ts for the original). */

// Matches PUBLIC_SITE_URL in every test file's mockEnv — requireSession's
// same-origin CSRF check (lib/auth/require-session.ts) requires a matching
// Origin header on every non-GET request, same as a real browser sends.
const TEST_ORIGIN = "http://localhost:4321";

/**
 * Phase 2 of the app-subdomain migration (ADR-0010) made `assertSameOrigin`
 * self-referential: it checks a request's `Origin` header against *that
 * request's own arrival origin* (`new URL(request.url).origin`), not a fixed
 * configured value — see `lib/auth/same-origin.ts`. Every call site across
 * this test suite historically passed an arbitrary placeholder host (e.g.
 * `"http://x/register/begin"`), which was harmless under the old
 * fixed-origin check but would now make every mutating request's arrival
 * origin ("http://x") untrusted, rejecting it regardless of a matching
 * `Origin` header. Rewriting just the origin here — centrally, once — to
 * `TEST_ORIGIN` (matching every test file's `PUBLIC_SITE_URL` mock) keeps
 * every existing call site working unchanged while making the constructed
 * `Request` a realistic same-origin one, exactly like a real browser
 * request. Tests that specifically exercise cross-origin/wrong-host
 * behavior construct their `Request` directly instead of through these
 * helpers.
 */
function withTestOrigin(url: string): string {
  const parsed = new URL(url);
  return new URL(`${parsed.pathname}${parsed.search}`, TEST_ORIGIN).toString();
}

export function jsonRequest(url: string, method: string, body: unknown, cookie?: string): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Origin: TEST_ORIGIN,
  };
  if (cookie) headers["Cookie"] = cookie;
  return new Request(withTestOrigin(url), { method, headers, body: JSON.stringify(body) });
}

export function getRequest(url: string, cookie?: string): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers["Cookie"] = cookie;
  return new Request(withTestOrigin(url), { method: "GET", headers });
}

/** For DELETE/POST calls with no JSON body. */
export function mutatingRequest(url: string, method: string, cookie?: string): Request {
  const headers: Record<string, string> = { Origin: TEST_ORIGIN };
  if (cookie) headers["Cookie"] = cookie;
  return new Request(withTestOrigin(url), { method, headers });
}

/** For multipart/form-data uploads (e.g. the agency-branding logo route). */
export function formDataRequest(url: string, formData: FormData, cookie?: string): Request {
  const headers: Record<string, string> = { Origin: TEST_ORIGIN };
  if (cookie) headers["Cookie"] = cookie;
  return new Request(withTestOrigin(url), { method: "POST", headers, body: formData });
}

export function ctx(request: Request, params: Record<string, string | undefined> = {}) {
  return { request, params, url: new URL(request.url) } as never;
}

export function cookieFromResponse(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) throw new Error("Response had no Set-Cookie header");
  return setCookie.split(";")[0]!;
}

export async function readJson<T>(response: Response): Promise<ApiResponse<T>> {
  return (await response.json()) as ApiResponse<T>;
}
