import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, schema } from "@crawlpact/database";
import type { Database } from "@crawlpact/database";
import type { D1Database } from "@cloudflare/workers-types";
import { createD1TestHarness } from "./d1-harness";
import { ctx, jsonRequest, readJson } from "./test-helpers";

/**
 * Phase 1 Workstream 3 (RUM): proves the `/api/rum` beacon endpoint against
 * real D1 — a valid beacon persists rows with the route bucketed (never the
 * raw path), an invalid payload is rejected and writes nothing, and the
 * shared `security_events`-backed rate limiter actually engages after the
 * threshold (directive §11: never trust a browser-supplied value blindly,
 * including "how many requests it sends").
 */

let mockEnv: Cloudflare.Env;
vi.mock("../../src/lib/env", () => ({ getEnv: () => mockEnv }));

const rumRoute = (await import("../../src/pages/api/rum")).POST;

const ORIGIN = "http://localhost:4321";

describe("POST /api/rum (real D1)", () => {
  let dispose: () => Promise<void>;
  let rawDb: D1Database;
  let db: Database;

  beforeAll(async () => {
    const harness = await createD1TestHarness();
    dispose = harness.dispose;
    rawDb = harness.db;
    db = createDb(harness.db);
    mockEnv = {
      DB: rawDb,
      PUBLIC_APP_ENV: "local",
      PUBLIC_SITE_URL: ORIGIN,
      PUBLIC_APP_URL: ORIGIN,
      SESSION_SIGNING_SECRET: "integration-test-secret-value-long-enough",
    } as unknown as Cloudflare.Env;
  });

  afterAll(async () => {
    await dispose();
  });

  it("persists a valid beacon with the route bucketed, not the raw path", async () => {
    const response = await rumRoute(
      ctx(
        jsonRequest("http://x/api/rum", "POST", {
          route: "/crawlers/gptbot/?utm_source=test",
          device: "mobile",
          metrics: [{ name: "LCP", value: 2100, rating: "good" }],
        }),
      ),
    );
    const body = await readJson<{ recorded: number }>(response);
    expect(response.status).toBe(200);
    expect(body.ok && body.data.recorded).toBe(1);

    const rows = await db.select().from(schema.rumVitals);
    const row = rows.find((r) => r.metricName === "LCP");
    expect(row?.route).toBe("/crawlers/:slug/");
    expect(row?.deviceCategory).toBe("mobile");
    expect(row?.metricValue).toBe(2100);
    expect(row?.rating).toBe("good");
  });

  it("rejects a malformed payload and writes nothing for it", async () => {
    const before = (await db.select().from(schema.rumVitals)).length;
    const response = await rumRoute(
      ctx(
        jsonRequest("http://x/api/rum", "POST", {
          route: "/",
          device: "mobile",
          metrics: [{ name: "NOT_A_REAL_METRIC", value: 100 }],
        }),
      ),
    );
    expect(response.status).toBe(400);
    const after = (await db.select().from(schema.rumVitals)).length;
    expect(after).toBe(before);
  });

  it("rate-limits repeated beacons from the same caller", async () => {
    const withIp = (req: Request): Request =>
      new Request(req, {
        headers: { ...Object.fromEntries(req.headers), "CF-Connecting-IP": "203.0.113.5" },
      });

    let lastStatus = 200;
    for (let i = 0; i < 65; i++) {
      const response = await rumRoute(
        ctx(
          withIp(
            jsonRequest("http://x/api/rum", "POST", {
              route: "/",
              device: "desktop",
              metrics: [{ name: "TTFB", value: 100 }],
            }),
          ),
        ),
      );
      lastStatus = response.status;
      if (lastStatus !== 200) break;
    }

    expect(lastStatus).not.toBe(200);
  });
});
