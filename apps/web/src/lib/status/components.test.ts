import { describe, expect, it } from "vitest";
import { isStatusComponentKey, STATUS_COMPONENTS, statusComponentLabel } from "./components";

describe("status components", () => {
  it("recognises every canonical key", () => {
    for (const c of STATUS_COMPONENTS) {
      expect(isStatusComponentKey(c.key)).toBe(true);
    }
  });

  it("rejects an unknown key", () => {
    expect(isStatusComponentKey("not_a_real_component")).toBe(false);
  });

  it("returns the matching label for a known key", () => {
    expect(statusComponentLabel("billing_checkout")).toBe("Billing and checkout");
  });

  it("falls back to the raw key for an unknown key rather than throwing", () => {
    expect(statusComponentLabel("mystery")).toBe("mystery");
  });
});
