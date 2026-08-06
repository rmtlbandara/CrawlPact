import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import type { DnsResolver } from "@crawlpact/scanner";
import { createD1TestHarness } from "./d1-harness";
import { createFakeR2Bucket } from "./fake-r2-bucket";
import { createVirtualCredential, simulateRegistration } from "./virtual-authenticator";
import { cookieFromResponse, ctx, jsonRequest, readJson } from "./test-helpers";

let mockEnv: Cloudflare.Env;
vi.mock("../../src/lib/env", () => ({ getEnv: () => mockEnv }));

const registerBegin = (await import("../../src/pages/api/auth/register/begin")).POST;
const registerFinish = (await import("../../src/pages/api/auth/register/finish")).POST;
const createDomainRoute = (await import("../../src/pages/api/domains/index")).POST;
const { getActiveRegistry } = await import("../../src/lib/registry-data");
const { runAudit } = await import("../../src/lib/run-audit");
const { persistScan } = await import("../../src/lib/persist-scan");
const { getScanReport } = await import("../../src/lib/get-scan-report");

const RP_ID = "localhost";
const ORIGIN = "http://localhost:4321";

// Real DNS-over-HTTPS resolution (the scanner's default) needs outbound
// network access this sandboxed test environment doesn't have — inject a
// fake resolver, exactly like packages/scanner/src/orchestrator.test.ts
// does, so the target-safety check passes without depending on it.
const publicResolver: DnsResolver = async () => ({ ok: true, addresses: ["93.184.216.34"] });

function makeResponse(
  status: number,
  body: string,
  headers: Record<string, string> = {},
): Response {
  return new Response(body, { status, headers });
}

/**
 * Proves the real, end-to-end persist -> read round trip for the signal
 * data (llms.txt, llms-full.txt, RSL, Content Signals, robots meta) that
 * Part 3 Step 14 added to the report contract. This is the load-bearing
 * test for "the free tools show a real, honest scoped result" — without
 * it, the new `AuditReportResponse` fields would only be typechecked, not
 * proven to actually round-trip through D1 correctly. Calls the real
 * `runAudit` + `persistScan` pipeline directly (same functions the admin
 * and customer scan routes call) rather than going through HTTP, so a
 * custom DNS resolver can be injected.
 */
describe("audit report signal fields (llms.txt/RSL/Content Signals/robots meta) (real D1)", () => {
  let dispose: () => Promise<void>;
  let db: Database;
  const originalFetch = globalThis.fetch;

  beforeAll(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    db = createDb(harness.db);
    mockEnv = {
      DB: harness.db,
      AGENCY_LOGOS: createFakeR2Bucket(),
      PUBLIC_APP_ENV: "local",
      PUBLIC_SITE_URL: ORIGIN,
      SESSION_SIGNING_SECRET: "integration-test-secret-value-long-enough",
      WEBAUTHN_RP_ID: RP_ID,
      WEBAUTHN_RP_ORIGIN: ORIGIN,
      PADDLE_API_KEY: "test",
      PADDLE_ENVIRONMENT: "sandbox",
      PADDLE_WEBHOOK_SECRET: "test",
      PADDLE_PRICE_ID_SOLO: "test",
      PADDLE_PRICE_ID_PRO: "test",
      PADDLE_PRICE_ID_AGENCY: "test",
      PUBLIC_PADDLE_CLIENT_TOKEN: "test",
      BILLING_ENABLED: "false",
      AUDIT_ENGINE_ENABLED: "false",
    };
  });

  afterAll(async () => {
    await dispose();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  async function signUpUser(displayName: string): Promise<{ cookie: string; userId: string }> {
    const beginResponse = await registerBegin(
      ctx(jsonRequest("http://x/register/begin", "POST", { displayName })),
    );
    const begin = await readJson<{
      challengeId: string;
      publicKeyCredentialCreationOptions: { challenge: string };
    }>(beginResponse);
    if (!begin.ok) throw new Error("begin failed");
    const credential = await createVirtualCredential();
    const response = await simulateRegistration(
      credential,
      begin.data.publicKeyCredentialCreationOptions.challenge,
      RP_ID,
      ORIGIN,
    );
    const finishResponse = await registerFinish(
      ctx(
        jsonRequest("http://x/register/finish", "POST", {
          challengeId: begin.data.challengeId,
          credential: response,
        }),
      ),
    );
    const cookie = cookieFromResponse(finishResponse);
    const finishBody = await readJson<{ user: { id: string } }>(finishResponse);
    if (!finishBody.ok) throw new Error("finish failed");
    return { cookie, userId: finishBody.data.user.id };
  }

  async function runAndPersistScan(cookie: string, target: string): Promise<string> {
    const createResponse = await createDomainRoute(
      ctx(jsonRequest("http://x/domains", "POST", { target }, cookie)),
    );
    const created = await readJson<{ domainId: string; canonicalOrigin: string }>(createResponse);
    if (!created.ok) throw new Error("domain create failed");

    const registry = await getActiveRegistry(db);
    if (!registry) throw new Error("no active registry in test harness");

    const result = await runAudit(
      created.data.canonicalOrigin,
      "maximum_ai_visibility",
      registry.crawlers,
      registry.rulesetVersionId,
      { resolver: publicResolver },
    );
    expect(result.status).not.toBe("target_unavailable");

    const scanId = crypto.randomUUID();
    await persistScan(
      db,
      {
        scanId,
        targetInput: target,
        preset: "maximum_ai_visibility",
        registryVersionId: registry.registryVersionId,
        rulesetVersionId: registry.rulesetVersionId,
        domainId: created.data.domainId,
        triggeredBy: "manual",
      },
      result,
    );
    return scanId;
  }

  it("persists and re-derives llms.txt, llms-full.txt, RSL, Content Signals, and robots meta when they are present", async () => {
    const { cookie } = await signUpUser("Signal User");

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/robots.txt")) {
        return makeResponse(200, "User-agent: *\nAllow: /\n");
      }
      if (url.endsWith("/llms-full.txt")) {
        return makeResponse(200, "# Full docs\n[API reference](/api)\n[Guide](/guide)\n");
      }
      if (url.endsWith("/llms.txt")) {
        return makeResponse(200, "# Example Site\n[Docs](/docs)\n");
      }
      if (url.endsWith("/.well-known/rsl.xml")) {
        return makeResponse(
          200,
          "<license><permits>search</permits><prohibits>train</prohibits><payment>subscription</payment></license>",
        );
      }
      if (url.endsWith("/sitemap.xml")) {
        return makeResponse(404, "");
      }
      // Homepage.
      return makeResponse(
        200,
        '<html><head><meta name="robots" content="noindex"><link rel="canonical" href="https://example.com/"></head></html>',
        { "x-robots-tag": "noindex, noarchive", "content-signal": "search=yes, ai-train=no" },
      );
    }) as unknown as typeof fetch;

    const scanId = await runAndPersistScan(cookie, "example.com");
    const report = await getScanReport(db, scanId);
    if (!report) throw new Error("report not found");

    expect(report.llmsTxt).toEqual({
      checked: true,
      found: true,
      hasH1Heading: true,
      linkedResources: ["/docs"],
      sizeBytes: expect.any(Number),
      issues: [],
    });
    expect(report.llmsFullTxt.found).toBe(true);
    expect(report.llmsFullTxt.linkedResources).toEqual(["/api", "/guide"]);

    expect(report.rsl.checked).toBe(true);
    expect(report.rsl.discovered).toBe(true);
    expect(report.rsl.permits).toEqual(["search"]);
    expect(report.rsl.prohibits).toEqual(["train"]);
    expect(report.rsl.paymentTerms).toEqual(["subscription"]);

    expect(report.contentSignals.checked).toBe(true);
    expect(report.contentSignals.present).toBe(true);
    expect(report.contentSignals.recognised).toEqual({ search: "yes", "ai-train": "no" });

    expect(report.robotsMeta.checked).toBe(true);
    expect(report.robotsMeta.metaRobots).toBe("noindex");
    expect(report.robotsMeta.canonicalUrl).toBe("https://example.com/");
    expect(report.robotsMeta.xRobotsTag).toEqual(["noindex", "noarchive"]);

    // The crawler matrix now carries the matched robots.txt line number too.
    expect(report.crawlerMatrix[0]?.matchedLineNumber).not.toBeUndefined();
  });

  it("honestly reports checked-but-absent (not fabricated 'not found') when none of these signals exist", async () => {
    const { cookie } = await signUpUser("Absent Signal User");

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/robots.txt")) return makeResponse(200, "User-agent: *\nAllow: /\n");
      if (url.endsWith("/llms.txt") || url.endsWith("/llms-full.txt")) return makeResponse(404, "");
      if (url.endsWith("/.well-known/rsl.xml")) return makeResponse(404, "");
      if (url.endsWith("/sitemap.xml")) return makeResponse(404, "");
      return makeResponse(200, "<html><head></head><body>hi</body></html>");
    }) as unknown as typeof fetch;

    const scanId = await runAndPersistScan(cookie, "example.net");
    const report = await getScanReport(db, scanId);
    if (!report) throw new Error("report not found");

    expect(report.llmsTxt.checked).toBe(true);
    expect(report.llmsTxt.found).toBe(false);
    expect(report.llmsFullTxt.checked).toBe(true);
    expect(report.llmsFullTxt.found).toBe(false);

    expect(report.rsl.checked).toBe(true);
    expect(report.rsl.discovered).toBe(false);

    expect(report.contentSignals.checked).toBe(true);
    expect(report.contentSignals.present).toBe(false);
    expect(report.contentSignals.raw).toBeNull();

    expect(report.robotsMeta.checked).toBe(true);
    expect(report.robotsMeta.metaRobots).toBeNull();
    expect(report.robotsMeta.xRobotsTag).toEqual([]);
  });

  it("stores html_meta as a minimised evidence blob with a resource hash, not the raw HTML (Phase 11, RISK-007)", async () => {
    const { cookie } = await signUpUser("Storage Reduction User");

    const homepageHtml =
      '<html><head><meta name="robots" content="noindex"><link rel="canonical" href="https://example.com/"></head></html>';
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/robots.txt")) return makeResponse(200, "User-agent: *\nAllow: /\n");
      if (url.endsWith("/llms.txt") || url.endsWith("/llms-full.txt")) return makeResponse(404, "");
      if (url.endsWith("/.well-known/rsl.xml")) return makeResponse(404, "");
      if (url.endsWith("/sitemap.xml")) return makeResponse(404, "");
      return makeResponse(200, homepageHtml);
    }) as unknown as typeof fetch;

    const scanId = await runAndPersistScan(cookie, "example.org");

    const [row] = await db
      .select()
      .from(schema.scanResources)
      .where(eq(schema.scanResources.id, `${scanId}_html_meta`))
      .limit(1);
    if (!row) throw new Error("html_meta resource row not found");

    expect(row.snapshotText).not.toBeNull();
    expect(row.snapshotText!.length).toBeLessThan(homepageHtml.length + 500);
    const parsed = JSON.parse(row.snapshotText!) as { format: string };
    expect(parsed.format).toBe("html_meta_evidence_v1");
    expect(row.resourceHash).not.toBeNull();
    expect(row.resourceHash).toMatch(/^[0-9a-f]{64}$/);

    // The report layer still reads the same, correct signals back out of
    // the minimised blob as it did from the old raw-HTML format.
    const report = await getScanReport(db, scanId);
    if (!report) throw new Error("report not found");
    expect(report.robotsMeta.metaRobots).toBe("noindex");
    expect(report.robotsMeta.canonicalUrl).toBe("https://example.com/");
  });

  // Real network call (runAndPersistScan against example.co) — under full-suite
  // system load this can exceed vitest's default 5000ms, same class of flake
  // fixed for the Phase 11 retention test in PR #87; same fix here.
  it(
    "still reads a pre-Phase-11 html_meta row that holds raw HTML instead of the minimised blob (backward compatibility)",
    { timeout: 20_000 },
    async () => {
      const { cookie } = await signUpUser("Legacy Row User");
      const scanId = await runAndPersistScan(cookie, "example.co");

      // Simulate a row written before this phase: overwrite the
      // just-persisted (minimised) html_meta row with raw HTML, exactly as
      // the old code path used to store it. Old rows are never rewritten by
      // this phase, so this is the real, permanent shape they're in.
      await db
        .update(schema.scanResources)
        .set({
          snapshotText:
            '<html><head><meta name="robots" content="noindex, nofollow"><link rel="canonical" href="https://legacy.example/"></head></html>',
          resourceHash: null,
        })
        .where(eq(schema.scanResources.id, `${scanId}_html_meta`));

      const report = await getScanReport(db, scanId);
      if (!report) throw new Error("report not found");
      expect(report.robotsMeta.checked).toBe(true);
      expect(report.robotsMeta.metaRobots).toBe("noindex, nofollow");
      expect(report.robotsMeta.canonicalUrl).toBe("https://legacy.example/");
    },
  );

  it("populates a SHA-256 resource_hash for every fetched resource type, not just html_meta (Phase 11, resource hashing)", async () => {
    const { cookie } = await signUpUser("Resource Hash User");

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/robots.txt")) return makeResponse(200, "User-agent: *\nAllow: /\n");
      if (url.endsWith("/llms.txt")) return makeResponse(200, "# Hash Test\n");
      if (url.endsWith("/llms-full.txt")) return makeResponse(404, "");
      if (url.endsWith("/.well-known/rsl.xml")) return makeResponse(404, "");
      if (url.endsWith("/sitemap.xml")) return makeResponse(404, "");
      return makeResponse(200, "<html><head></head><body>hash me</body></html>");
    }) as unknown as typeof fetch;

    const scanId = await runAndPersistScan(cookie, "example.dev");

    const rows = await db
      .select()
      .from(schema.scanResources)
      .where(eq(schema.scanResources.scanId, scanId));

    const robotsRow = rows.find((r) => r.resourceType === "robots_txt");
    const llmsRow = rows.find((r) => r.resourceType === "llms_txt");
    const htmlMetaRow = rows.find((r) => r.resourceType === "html_meta");

    for (const row of [robotsRow, llmsRow, htmlMetaRow]) {
      expect(row?.resourceHash).toMatch(/^[0-9a-f]{64}$/);
    }
    // Different fetched bodies must hash differently — a real digest, not a
    // constant placeholder.
    expect(robotsRow?.resourceHash).not.toBe(llmsRow?.resourceHash);
    expect(robotsRow?.resourceHash).not.toBe(htmlMetaRow?.resourceHash);
  });

  it("stores sitemap as its already-computed SitemapValidation result, not the raw XML (Phase 11, RISK-007)", async () => {
    const { cookie } = await signUpUser("Sitemap Storage User");

    const sitemapXml =
      `<?xml version="1.0"?><urlset><url><loc>https://example.io/a</loc></url></urlset>` +
      "x".repeat(5_000);
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/robots.txt")) return makeResponse(200, "User-agent: *\nAllow: /\n");
      if (url.endsWith("/llms.txt") || url.endsWith("/llms-full.txt")) return makeResponse(404, "");
      if (url.endsWith("/.well-known/rsl.xml")) return makeResponse(404, "");
      if (url.endsWith("/sitemap.xml")) return makeResponse(200, sitemapXml);
      return makeResponse(200, "<html><head></head><body>hi</body></html>");
    }) as unknown as typeof fetch;

    const scanId = await runAndPersistScan(cookie, "example.io");

    const [row] = await db
      .select()
      .from(schema.scanResources)
      .where(eq(schema.scanResources.id, `${scanId}_sitemap`))
      .limit(1);
    if (!row) throw new Error("sitemap resource row not found");

    expect(row.snapshotText).not.toBeNull();
    expect(row.snapshotText!.length).toBeLessThan(sitemapXml.length / 2);
    const parsed = JSON.parse(row.snapshotText!) as {
      looksLikeSitemap: boolean;
      sampledUrls: string[];
    };
    expect(parsed.looksLikeSitemap).toBe(true);
    expect(parsed.sampledUrls).toEqual(["https://example.io/a"]);
  });
});
