import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiResponse } from "@crawlpact/core";

// apps/web/src/lib/env.ts is the only module that imports "cloudflare:workers"
// directly (see that file's comment) — mocking it here means this test runs
// under plain Node/Vitest without needing a real Workers runtime, while
// still exercising the real POST handler, not a stand-in for it.
let mockEnv: { AUDIT_ENGINE_ENABLED: string };
vi.mock("../../src/lib/env", () => ({
  getEnv: () => mockEnv,
}));

const { POST } = await import("../../src/pages/api/audit/index");

/**
 * Exercises the real /api/audit handler (not a mock) with a constructed
 * Request, verifying the contract that matters most for this phase: no
 * fabricated audit result is ever returned while the scanner is disabled
 * (see docs/status/KNOWN_RISKS.md).
 */
function makeContext(body: unknown) {
  const request = new Request("http://localhost/api/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { request } as Parameters<typeof POST>[0];
}

async function readJson<T>(response: Response): Promise<ApiResponse<T>> {
  return (await response.json()) as ApiResponse<T>;
}

describe("POST /api/audit", () => {
  beforeEach(() => {
    mockEnv = { AUDIT_ENGINE_ENABLED: "false" };
  });

  it("returns AUDIT_ENGINE_DISABLED for a valid target when the engine is off", async () => {
    const response = await POST(makeContext({ target: "example.com" }));
    expect(response.status).toBe(503);
    const body = await readJson(response);
    expect(body.ok).toBe(false);
    if (!body.ok) expect(body.error.code).toBe("AUDIT_ENGINE_DISABLED");
  });

  it("rejects a literal IP target with AUDIT_TARGET_INVALID", async () => {
    const response = await POST(makeContext({ target: "http://127.0.0.1" }));
    expect(response.status).toBe(400);
    const body = await readJson(response);
    if (!body.ok) expect(body.error.code).toBe("AUDIT_TARGET_INVALID");
  });

  it("rejects an unsupported scheme", async () => {
    const response = await POST(makeContext({ target: "javascript:alert(1)" }));
    expect(response.status).toBe(400);
    const body = await readJson(response);
    if (!body.ok) expect(body.error.code).toBe("AUDIT_TARGET_INVALID");
  });

  it("rejects a request with no target", async () => {
    const response = await POST(makeContext({}));
    expect(response.status).toBe(400);
    const body = await readJson(response);
    if (!body.ok) expect(body.error.code).toBe("VALIDATION_FAILED");
  });

  it("fails loudly with INTERNAL_ERROR (not a fabricated result) when the engine is on but no D1 binding is available", async () => {
    // This test intentionally has no working D.B — its purpose is to prove
    // the handler's single try/catch (apps/web/src/pages/api/audit/index.ts)
    // turns an unexpected infrastructure failure into a proper JSON error
    // envelope instead of an unhandled exception / HTML error page, and
    // never returns ok:true for a scan that didn't actually complete.
    mockEnv = { AUDIT_ENGINE_ENABLED: "true" };
    const response = await POST(makeContext({ target: "example.com" }));
    const body = await readJson(response);
    expect(response.status).toBe(500);
    expect(body.ok).toBe(false);
    if (!body.ok) expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
