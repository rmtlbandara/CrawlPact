import { describe, expect, it } from "vitest";
import { planChangeDirection } from "./plan-change";

/**
 * RISK-017: the pre-Phase-6 billing page labelled every non-current plan "Upgrade to X"
 * regardless of actual direction. This is the rule that fixes it — see
 * docs/billing/PLAN_CHANGE_AND_PRORATION_POLICY.md for the full rationale.
 */
describe("planChangeDirection", () => {
  it("is immediate for a plan upgrade (Solo -> Pro, same interval)", () => {
    expect(
      planChangeDirection(
        { planId: "solo", interval: "month" },
        { planId: "pro", interval: "month" },
      ),
    ).toBe("immediate");
  });

  it("is immediate for a two-step plan upgrade (Solo -> Agency)", () => {
    expect(
      planChangeDirection(
        { planId: "solo", interval: "year" },
        { planId: "agency", interval: "year" },
      ),
    ).toBe("immediate");
  });

  it("is scheduled for a plan downgrade (Pro -> Solo, same interval)", () => {
    expect(
      planChangeDirection(
        { planId: "pro", interval: "month" },
        { planId: "solo", interval: "month" },
      ),
    ).toBe("scheduled");
  });

  it("is immediate for same-plan monthly -> yearly (more commitment)", () => {
    expect(
      planChangeDirection(
        { planId: "solo", interval: "month" },
        { planId: "solo", interval: "year" },
      ),
    ).toBe("immediate");
  });

  it("is scheduled for same-plan yearly -> monthly (less commitment)", () => {
    expect(
      planChangeDirection(
        { planId: "solo", interval: "year" },
        { planId: "solo", interval: "month" },
      ),
    ).toBe("scheduled");
  });

  it("is scheduled for a downgrade that also reduces commitment (Pro yearly -> Solo monthly)", () => {
    expect(
      planChangeDirection(
        { planId: "pro", interval: "year" },
        { planId: "solo", interval: "month" },
      ),
    ).toBe("scheduled");
  });

  it("is immediate for an upgrade that also increases commitment (Solo monthly -> Pro yearly)", () => {
    expect(
      planChangeDirection(
        { planId: "solo", interval: "month" },
        { planId: "pro", interval: "year" },
      ),
    ).toBe("immediate");
  });

  it("a downgrade in plan outweighs an increase in commitment (Pro monthly -> Solo yearly)", () => {
    // Solo/year ranks 11, Pro/month ranks 20 — moving to a lower plan (even paid yearly, which
    // alone would be "more commitment") is still a net downgrade under the single ordered-pair
    // rule, since plan rank is weighted ×10 against interval's ×1.
    expect(
      planChangeDirection(
        { planId: "pro", interval: "month" },
        { planId: "solo", interval: "year" },
      ),
    ).toBe("scheduled");
  });
});
