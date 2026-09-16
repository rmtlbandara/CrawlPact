import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@crawlpact/core";
import type { ApiResponse } from "@crawlpact/core";
import type { GoogleInsightsSnapshot } from "../../../../lib/admin/google-insights";

async function readJson<T>(response: Response): Promise<ApiResponse<T>> {
  return (await response.json()) as ApiResponse<T>;
}

vi.mock("@crawlpact/database", () => ({ createDb: vi.fn(() => ({})) }));

const mockEnv = {
  DB: {} as unknown,
  PUBLIC_APP_ENV: "local",
  GOOGLE_ANALYTICS_SERVICE_ACCOUNT_JSON: "test-credential-json",
  GOOGLE_GA4_PROPERTY_ID: "547512440",
  GOOGLE_SEARCH_CONSOLE_SITE_URL: "sc-domain:crawlpact.com",
  CRUX_API_KEY: "test-crux-key",
  CRUX_ORIGIN: "https://crawlpact.com",
};
vi.mock("../../../../lib/env", () => ({ getEnv: () => mockEnv }));

const requireAdminSessionMock = vi.fn();
vi.mock("../../../../lib/auth/require-admin", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

const getGoogleInsightsSnapshotMock = vi.fn();
vi.mock("../../../../lib/admin/google-insights", () => ({
  getGoogleInsightsSnapshot: getGoogleInsightsSnapshotMock,
}));

const { GET } = await import("./google-insights");

function makeRequest(): Request {
  return new Request("https://crawlpact.com/api/admin/integrations/google-insights");
}

describe("GET /api/admin/integrations/google-insights", () => {
  beforeEach(() => {
    requireAdminSessionMock.mockReset();
    getGoogleInsightsSnapshotMock.mockReset();
  });

  it("rejects an unauthenticated request without calling the provider layer", async () => {
    requireAdminSessionMock.mockRejectedValue(new ApiError("UNAUTHENTICATED", "Sign in required."));

    const response = await GET({ request: makeRequest() } as never);
    expect(response.status).toBe(401);
    const body = await readJson<GoogleInsightsSnapshot>(response);
    expect(body.ok).toBe(false);
    if (!body.ok) expect(body.error.code).toBe("UNAUTHENTICATED");
    expect(getGoogleInsightsSnapshotMock).not.toHaveBeenCalled();
  });

  it("rejects a non-admin (authenticated but forbidden) request", async () => {
    requireAdminSessionMock.mockRejectedValue(
      new ApiError("ADMIN_ACTION_FORBIDDEN", "This account does not have administrator access."),
    );

    const response = await GET({ request: makeRequest() } as never);
    expect(response.status).toBe(403);
    const body = await readJson<GoogleInsightsSnapshot>(response);
    expect(body.ok).toBe(false);
    if (!body.ok) expect(body.error.code).toBe("ADMIN_ACTION_FORBIDDEN");
    expect(getGoogleInsightsSnapshotMock).not.toHaveBeenCalled();
  });

  it("returns a sanitized snapshot for an authenticated admin", async () => {
    requireAdminSessionMock.mockResolvedValue({ user: { id: "admin-1" }, roles: ["super_admin"] });
    getGoogleInsightsSnapshotMock.mockResolvedValue({
      searchConsole: { status: "ok", rowCount: 3, topRows: [] },
      ga4: { status: "ok", rowCount: 7, totals: { activeUsers: 20, sessions: 25 } },
      crux: { status: "no_data" },
    });

    const response = await GET({ request: makeRequest() } as never);
    expect(response.status).toBe(200);
    const body = await readJson<GoogleInsightsSnapshot>(response);
    expect(body.ok).toBe(true);
    if (body.ok) {
      expect(body.data.searchConsole.status).toBe("ok");
      expect(body.data.ga4.status).toBe("ok");
      expect(body.data.crux.status).toBe("no_data");
      expect(typeof body.requestId).toBe("string");
    }

    expect(getGoogleInsightsSnapshotMock).toHaveBeenCalledWith({
      serviceAccountJson: mockEnv.GOOGLE_ANALYTICS_SERVICE_ACCOUNT_JSON,
      ga4PropertyId: mockEnv.GOOGLE_GA4_PROPERTY_ID,
      searchConsoleSiteUrl: mockEnv.GOOGLE_SEARCH_CONSOLE_SITE_URL,
      cruxApiKey: mockEnv.CRUX_API_KEY,
      cruxOrigin: mockEnv.CRUX_ORIGIN,
    });
  });

  it("returns 200 with a mixed snapshot when only one provider fails (a partial failure is not an HTTP error)", async () => {
    requireAdminSessionMock.mockResolvedValue({ user: { id: "admin-1" }, roles: ["super_admin"] });
    getGoogleInsightsSnapshotMock.mockResolvedValue({
      searchConsole: { status: "ok", rowCount: 2, topRows: [] },
      ga4: { status: "permission_denied" },
      crux: { status: "no_data" },
    });

    const response = await GET({ request: makeRequest() } as never);
    expect(response.status).toBe(200);
    const body = await readJson<GoogleInsightsSnapshot>(response);
    expect(body.ok).toBe(true);
    if (body.ok) {
      expect(body.data.searchConsole.status).toBe("ok");
      expect(body.data.ga4.status).toBe("permission_denied");
      expect(body.data.crux.status).toBe("no_data");
    }
  });

  it("never returns a secret, token, or credential value in the response body", async () => {
    requireAdminSessionMock.mockResolvedValue({ user: { id: "admin-1" }, roles: ["super_admin"] });
    getGoogleInsightsSnapshotMock.mockResolvedValue({
      searchConsole: { status: "ok", rowCount: 0, topRows: [] },
      ga4: { status: "ok", rowCount: 0, totals: { activeUsers: 0, sessions: 0 } },
      crux: { status: "no_data" },
    });

    const response = await GET({ request: makeRequest() } as never);
    const text = await response.text();
    expect(text).not.toContain(mockEnv.GOOGLE_ANALYTICS_SERVICE_ACCOUNT_JSON);
    expect(text).not.toContain(mockEnv.CRUX_API_KEY);
    expect(text).not.toContain("access_token");
    expect(text).not.toContain("Bearer ");
  });

  it("maps an unexpected thrown error to a generic internal error, not a raw leak", async () => {
    requireAdminSessionMock.mockResolvedValue({ user: { id: "admin-1" }, roles: ["super_admin"] });
    getGoogleInsightsSnapshotMock.mockRejectedValue(new Error("unexpected failure"));

    const response = await GET({ request: makeRequest() } as never);
    expect(response.status).toBe(500);
    const body = await readJson<GoogleInsightsSnapshot>(response);
    expect(body.ok).toBe(false);
    if (!body.ok) expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
