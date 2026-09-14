import { readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  classifyApiOwnership,
  isAppOnlyPagePath,
  isPublicOnlyPath,
  isSensitivePath,
} from "./route-ownership";
import type { ApiOwnership } from "./route-ownership";

describe("isPublicOnlyPath — Phase 2 executable form of the route ownership matrix", () => {
  it("classifies the root and marketing pages as public-only", () => {
    for (const path of ["/", "/about", "/about/", "/pricing", "/pricing/", "/contact"]) {
      expect(isPublicOnlyPath(path)).toBe(true);
    }
  });

  it("classifies content-collection prefixes as public-only", () => {
    for (const path of [
      "/crawlers/googlebot",
      "/guides/robots-txt-syntax-basics",
      "/platforms/wordpress",
      "/tools/ai-crawler-checker",
    ]) {
      expect(isPublicOnlyPath(path)).toBe(true);
    }
  });

  it("classifies the anonymous audit surface and /pay as public-only", () => {
    expect(isPublicOnlyPath("/audit")).toBe(true);
    expect(isPublicOnlyPath("/audit/some-audit-id")).toBe(true);
    expect(isPublicOnlyPath("/pay")).toBe(true);
  });

  it("classifies public capability-URL prefixes as public-only", () => {
    expect(isPublicOnlyPath("/shared/some-token")).toBe(true);
    expect(isPublicOnlyPath("/feed/some-token.xml")).toBe(true);
  });

  it("classifies SSR-indexable prefixes (/for/, /research/) as public-only", () => {
    expect(isPublicOnlyPath("/for/some-landing-page")).toBe(true);
    expect(isPublicOnlyPath("/research/some-publication")).toBe(true);
  });

  it("does NOT classify APP_ONLY routes as public-only", () => {
    for (const path of [
      "/sign-in",
      "/app",
      "/app/domains",
      "/app/billing",
      "/admin",
      "/admin/users",
    ]) {
      expect(isPublicOnlyPath(path)).toBe(false);
    }
  });

  it("does NOT classify API routes as public-only (they are handled by their own ownership, not this redirect mechanism)", () => {
    expect(isPublicOnlyPath("/api/audit")).toBe(false);
    expect(isPublicOnlyPath("/api/domains")).toBe(false);
  });

  it("does not confuse /api/audit/* with the public /audit/* page prefix", () => {
    // Regression guard: both start with "/audit"-ish text but only the
    // non-/api one is a public page prefix.
    expect(isPublicOnlyPath("/api/audit/continuation/abc123")).toBe(false);
    expect(isPublicOnlyPath("/audit/abc123")).toBe(true);
  });

  it("is trailing-slash insensitive", () => {
    expect(isPublicOnlyPath("/about")).toBe(isPublicOnlyPath("/about/"));
    expect(isPublicOnlyPath("/crawlers/googlebot")).toBe(isPublicOnlyPath("/crawlers/googlebot/"));
  });

  /**
   * Found live, 2026-09-09: `/about/index.html` (a real Static Assets alias
   * of the canonical `/about/` page) returned the real public page directly
   * through `app.crawlpact.com` because `isPublicOnlyPath` didn't recognize
   * it at all — the app-host boundary branch in `worker.ts` never fired, so
   * the request fell through to the raw asset. See
   * `resolveStaticAssetAlias`'s doc comment in `route-registry.ts`.
   */
  it("classifies a literal Static Assets alias of an exact public route as public-only", () => {
    for (const path of [
      "/index.html",
      "/index",
      "/about/index.html",
      "/about/index",
      "/about.html",
    ]) {
      expect(isPublicOnlyPath(path)).toBe(true);
    }
  });

  it("classifies a literal Static Assets alias of a collection root/detail page as public-only", () => {
    for (const path of [
      "/crawlers/index.html",
      "/crawlers.html",
      "/crawlers/gptbot/index.html",
      "/crawlers/gptbot/index",
      "/crawlers/gptbot.html",
    ]) {
      expect(isPublicOnlyPath(path)).toBe(true);
    }
  });

  it("does NOT classify an alias-shaped path under a sensitive/private prefix as public-only (the alias check must not weaken app/api/admin classification)", () => {
    for (const path of [
      "/app/index.html",
      "/app.html",
      "/admin/index.html",
      "/admin.html",
      "/sign-in/index.html",
      "/sign-in.html",
      "/api/domains/index.html",
      "/api/domains.html",
    ]) {
      expect(isPublicOnlyPath(path)).toBe(false);
    }
  });

  it("does NOT classify an alias-shaped path for an SSR-indexable route as public-only via the alias check alone changing the outcome (still public via the existing exact-route check, just not via a nonexistent Static Assets file)", () => {
    // /pricing/index.html has no literal file (SSR, confirmed live 404) —
    // isPublicOnlyPath still correctly returns false here since bare
    // "/pricing/index.html" isn't itself an indexable route or prefix match,
    // matching the real live behavior (this path 404s, it never bypasses
    // anything worth redirecting).
    expect(isPublicOnlyPath("/pricing/index.html")).toBe(false);
  });

  it("does not false-positive on a path that merely looks alias-shaped but matches no known route", () => {
    expect(isPublicOnlyPath("/apparently-fine.html")).toBe(false);
    expect(isPublicOnlyPath("/apparently-fine/index.html")).toBe(false);
  });
});

describe("isAppOnlyPagePath — Phase 4 apex→app legacy-page redirect set", () => {
  it("flags sign-in, app, and admin (bare and nested)", () => {
    for (const path of [
      "/sign-in",
      "/app",
      "/app/domains",
      "/app/domains/abc123",
      "/app/billing",
      "/admin",
      "/admin/users",
      "/admin/users/abc123",
    ]) {
      expect(isAppOnlyPagePath(path)).toBe(true);
    }
  });

  it("does not false-positive on a route that merely starts with a similar prefix", () => {
    expect(isAppOnlyPagePath("/apparently-fine")).toBe(false);
    expect(isAppOnlyPagePath("/sign-in-evil")).toBe(false);
    expect(isAppOnlyPagePath("/administration")).toBe(false);
  });

  it("does not flag public or API routes", () => {
    expect(isAppOnlyPagePath("/")).toBe(false);
    expect(isAppOnlyPagePath("/pricing")).toBe(false);
    expect(isAppOnlyPagePath("/api/domains")).toBe(false);
  });
});

describe("classifyApiOwnership — Phase 4 executable /api/* ownership contract", () => {
  it("classifies the anonymous audit family as PUBLIC_ONLY, except the owned-audit share action", () => {
    expect(classifyApiOwnership("/api/audit")).toBe("PUBLIC_ONLY");
    expect(classifyApiOwnership("/api/audit/abc123")).toBe("PUBLIC_ONLY");
    expect(classifyApiOwnership("/api/audit/abc123/report")).toBe("PUBLIC_ONLY");
    expect(classifyApiOwnership("/api/audit/abc123/continuation")).toBe("PUBLIC_ONLY");
    expect(classifyApiOwnership("/api/audit/abc123/share")).toBe("APP_ONLY");
  });

  it("classifies continuation consumption (a distinct top-level path from the audit-scoped creation endpoint) as APP_ONLY", () => {
    expect(classifyApiOwnership("/api/audit/continuation/xyz789")).toBe("APP_ONLY");
  });

  it("classifies analytics/track as the one SHARED_SAME_ORIGIN_SURFACE entry", () => {
    expect(classifyApiOwnership("/api/analytics/track")).toBe("SHARED_SAME_ORIGIN_SURFACE");
  });

  it("classifies the Paddle webhook as SERVER_TO_SERVER_PUBLIC", () => {
    expect(classifyApiOwnership("/api/billing/webhook")).toBe("SERVER_TO_SERVER_PUBLIC");
  });

  it("classifies the rest of /api/billing/* as APP_ONLY", () => {
    for (const path of [
      "/api/billing/checkout",
      "/api/billing/portal-session",
      "/api/billing/plan-change/preview",
      "/api/billing/plan-change/confirm",
      "/api/billing/plan-change/cancel-scheduled",
    ]) {
      expect(classifyApiOwnership(path)).toBe("APP_ONLY");
    }
  });

  it("classifies agency-branding's public asset read separately from its APP_ONLY mutation endpoints", () => {
    expect(classifyApiOwnership("/api/agency-branding/logo/some-key")).toBe("PUBLIC_ONLY");
    expect(classifyApiOwnership("/api/agency-branding/logo")).toBe("APP_ONLY");
    expect(classifyApiOwnership("/api/agency-branding/profile")).toBe("APP_ONLY");
  });

  it("classifies auth, account, domains, groups, workspace, notifications, app, and admin as APP_ONLY", () => {
    for (const path of [
      "/api/auth/login/begin",
      "/api/auth/register/finish",
      "/api/account",
      "/api/account/google/disconnect",
      "/api/domains",
      "/api/groups/abc123",
      "/api/workspace/domains",
      "/api/notifications/feed-token",
      "/api/app/pilot/feedback",
      "/api/admin/users",
      "/api/admin/registry/crawlers",
    ]) {
      expect(classifyApiOwnership(path)).toBe("APP_ONLY");
    }
  });

  it("classifies test-only routes as INTERNAL_ONLY", () => {
    expect(classifyApiOwnership("/api/test-only/set-plan")).toBe("INTERNAL_ONLY");
  });

  it("returns UNKNOWN for a non-/api/ path", () => {
    expect(classifyApiOwnership("/app/domains")).toBe("UNKNOWN");
  });

  it("returns UNKNOWN, never a silent default, for an unrecognized /api/* path", () => {
    expect(classifyApiOwnership("/api/some-future-endpoint-nobody-added-here-yet")).toBe("UNKNOWN");
  });

  /**
   * The load-bearing guarantee behind the Phase 4 directive's "do not
   * default an unknown API into shared" / "zero UNRESOLVED entries"
   * requirement: every route file that actually exists under
   * `apps/web/src/pages/api/` must classify as something other than
   * `"UNKNOWN"`. This is what makes the previous test's UNKNOWN case a
   * defined-empty branch in `worker.ts`'s wrong-host check, not a fail-open
   * gap for anything real — a new endpoint added later without updating
   * `classifyApiOwnership` fails this test, not silently at runtime.
   */
  it("classifies every real API route file with a real ownership, never UNKNOWN", () => {
    const apiDir = fileURLToPath(new URL("../pages/api", import.meta.url));

    function walk(dir: string, urlPrefix: string): string[] {
      const paths: string[] = [];
      for (const entry of readdirSync(dir)) {
        if (entry === "AGENTS.md") continue;
        const fullPath = `${dir}/${entry}`;
        if (statSync(fullPath).isDirectory()) {
          paths.push(...walk(fullPath, `${urlPrefix}/${entry}`));
          continue;
        }
        if (!entry.endsWith(".ts")) continue;
        // Astro file-based routing: `index.ts` is the directory's own
        // route; `[param].ts`/`[...param].ts` become a placeholder segment
        // that still needs *some* concrete value to test the classifier
        // with (the classifier only cares about static prefix shape, so any
        // placeholder value works).
        const base = entry.replace(/\.ts$/, "");
        const segment = base === "index" ? "" : `/${base.replace(/^\[.*\]$/, "placeholder")}`;
        paths.push(`${urlPrefix}${segment}`);
      }
      return paths;
    }

    const realApiPaths = walk(apiDir, "/api");
    const unresolved = realApiPaths.filter(
      (path) => classifyApiOwnership(path) === ("UNKNOWN" satisfies ApiOwnership),
    );
    expect(unresolved).toEqual([]);
  });
});

describe("isSensitivePath — the narrow unknown-host fail-closed set", () => {
  it("flags admin, api, app, and sign-in", () => {
    expect(isSensitivePath("/admin")).toBe(true);
    expect(isSensitivePath("/admin/users")).toBe(true);
    expect(isSensitivePath("/api/domains")).toBe(true);
    expect(isSensitivePath("/app")).toBe(true);
    expect(isSensitivePath("/app/domains")).toBe(true);
    expect(isSensitivePath("/sign-in")).toBe(true);
  });

  it("does not flag genuinely public or low-stakes routes", () => {
    expect(isSensitivePath("/about")).toBe(false);
    expect(isSensitivePath("/audit/some-id")).toBe(false);
    expect(isSensitivePath("/shared/some-token")).toBe(false);
    expect(isSensitivePath("/dev/components")).toBe(false);
    expect(isSensitivePath("/")).toBe(false);
  });

  it("does not false-positive on a route that merely starts with a similar prefix", () => {
    expect(isSensitivePath("/apparently-fine")).toBe(false);
  });
});
