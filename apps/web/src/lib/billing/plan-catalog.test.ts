import { describe, expect, it } from "vitest";
import { PLAN_COPY } from "./plan-catalog";

/**
 * Phase 19 pricing-comparison prompt §54: Pro is "Most Popular" and Agency never is, on plan
 * cards and any comparison-header treatment that reads `recommended` from this same catalog copy.
 */
describe("PLAN_COPY recommended flag", () => {
  it("marks only Pro as recommended (Most Popular)", () => {
    expect(PLAN_COPY.pro.recommended).toBe(true);
    expect(PLAN_COPY.free.recommended).toBe(false);
    expect(PLAN_COPY.solo.recommended).toBe(false);
    expect(PLAN_COPY.agency.recommended).toBe(false);
  });
});
