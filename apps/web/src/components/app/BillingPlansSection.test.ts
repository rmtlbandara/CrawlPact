import { describe, expect, it } from "vitest";
import { directionLabel } from "./BillingPlansSection";

/**
 * Client-side mirror of the server's `planChangeDirection` rule (see
 * lib/billing/plan-change.test.ts for the authoritative rule's own coverage) — this only tests
 * that the UI's label text agrees with the direction the server would independently compute,
 * since the server always re-validates regardless of what this renders.
 */
describe("directionLabel", () => {
  it("offers a plain 'Choose X' label when there is no current subscription", () => {
    expect(directionLabel(null, { planId: "pro", interval: "month", name: "Pro" })).toBe(
      "Choose Pro",
    );
  });

  it("labels a plan upgrade as 'Upgrade to X'", () => {
    expect(
      directionLabel(
        { planId: "solo", interval: "month" },
        { planId: "pro", interval: "month", name: "Pro" },
      ),
    ).toBe("Upgrade to Pro");
  });

  it("labels a plan downgrade as 'Downgrade to X'", () => {
    expect(
      directionLabel(
        { planId: "pro", interval: "month" },
        { planId: "solo", interval: "month", name: "Solo" },
      ),
    ).toBe("Downgrade to Solo");
  });

  it("labels same-plan monthly -> yearly as an upgrade", () => {
    expect(
      directionLabel(
        { planId: "solo", interval: "month" },
        { planId: "solo", interval: "year", name: "Solo" },
      ),
    ).toBe("Upgrade to Solo");
  });

  it("labels same-plan yearly -> monthly as a downgrade", () => {
    expect(
      directionLabel(
        { planId: "solo", interval: "year" },
        { planId: "solo", interval: "month", name: "Solo" },
      ),
    ).toBe("Downgrade to Solo");
  });
});
