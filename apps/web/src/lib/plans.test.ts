import { describe, expect, it } from "vitest";
import { PLANS } from "./plans";

describe("PLANS (single source for pricing.astro and the homepage pricing preview)", () => {
  it("has exactly the four current plans, in order", () => {
    expect(PLANS.map((p) => p.id)).toEqual(["free", "solo", "pro", "agency"]);
  });

  it("preserves the exact current prices — this phase must never change pricing", () => {
    expect(PLANS.find((p) => p.id === "free")?.price).toBe("USD 0");
    expect(PLANS.find((p) => p.id === "solo")?.price).toBe("USD 79");
    expect(PLANS.find((p) => p.id === "pro")?.price).toBe("USD 179");
    expect(PLANS.find((p) => p.id === "agency")?.price).toBe("USD 399");
  });

  it("preserves the exact current domain limits and monitoring frequency", () => {
    const byId = Object.fromEntries(PLANS.map((p) => [p.id, p]));
    expect(byId.free).toMatchObject({ domains: 1, monitoring: "None" });
    expect(byId.solo).toMatchObject({ domains: 5, monitoring: "Monthly" });
    expect(byId.pro).toMatchObject({ domains: 25, monitoring: "Weekly" });
    expect(byId.agency).toMatchObject({ domains: 100, monitoring: "Weekly" });
  });

  it("only the Pro plan is marked recommended", () => {
    expect(PLANS.filter((p) => p.recommended).map((p) => p.id)).toEqual(["pro"]);
  });

  it("does not introduce monthly pricing", () => {
    for (const plan of PLANS) {
      expect(plan.price).not.toMatch(/\/mo|month/i);
    }
  });
});
