import { useState } from "react";
import { CheckoutButton } from "./CheckoutButton";
import { PlanChangeButton } from "./PlanChangeButton";
import { track } from "../../lib/analytics-client";

type PaidPlanId = "solo" | "pro" | "agency";
const PLAN_RANK: Record<PaidPlanId, number> = { solo: 1, pro: 2, agency: 3 };
const INTERVAL_WEIGHT: Record<"month" | "year", number> = { month: 0, year: 1 };

/** Exported so tests can exercise the exact same upgrade-vs-downgrade label rule the UI uses,
 * without duplicating it — mirrors (but does not itself decide) the authoritative server-side
 * rule in lib/billing/plan-change.ts's `planChangeDirection`; the server always re-validates. */
export function directionLabel(
  current: { planId: PaidPlanId; interval: "month" | "year" } | null,
  target: { planId: PaidPlanId; interval: "month" | "year"; name: string },
): string {
  if (!current) return `Choose ${target.name}`;
  const currentRank = PLAN_RANK[current.planId] * 10 + INTERVAL_WEIGHT[current.interval];
  const targetRank = PLAN_RANK[target.planId] * 10 + INTERVAL_WEIGHT[target.interval];
  return targetRank > currentRank ? `Upgrade to ${target.name}` : `Downgrade to ${target.name}`;
}

export function BillingPlansSection({
  plans,
  currentPlanId,
  currentInterval,
  initialInterval,
}: {
  plans: { id: PaidPlanId; name: string; monthlyCents: number; yearlyCents: number }[];
  /** null when the account has no active/trialing/past_due paid subscription (Free). */
  currentPlanId: PaidPlanId | null;
  currentInterval: "month" | "year" | null;
  /** Carried through from a `/pricing` CTA via sign-in (Phase 6 checkout continuity) — only
   * used as the toggle's starting position, never trusted for anything beyond that. */
  initialInterval?: "month" | "year";
}) {
  const [interval, setInterval] = useState<"month" | "year">(
    initialInterval ?? currentInterval ?? "year",
  );
  const hasActiveSubscription = currentPlanId !== null && currentInterval !== null;

  return (
    <div>
      <div
        className="mb-4 inline-flex rounded-control border border-neutral-300 p-1"
        role="group"
        aria-label="Billing interval"
      >
        {(["month", "year"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={interval === value}
            onClick={() => {
              setInterval(value);
              track("billing_interval_selected", { interval: value });
            }}
            className={
              "rounded-control px-4 py-1.5 text-supporting font-medium " +
              (interval === value
                ? "bg-brand-600 text-white"
                : "text-neutral-700 hover:bg-neutral-50")
            }
          >
            {value === "month" ? "Monthly" : "Yearly"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent =
            hasActiveSubscription && plan.id === currentPlanId && interval === currentInterval;
          const amountCents = interval === "month" ? plan.monthlyCents : plan.yearlyCents;
          return (
            <div key={plan.id} className="rounded-card border border-neutral-200 bg-white p-5">
              <h3 className="text-card-heading text-neutral-950">{plan.name}</h3>
              <p className="mt-1 text-body text-neutral-700">
                ${(amountCents / 100).toFixed(2)} / {interval === "month" ? "month" : "year"}
              </p>
              {isCurrent ? (
                <p className="mt-3 text-supporting text-neutral-600">This is your current plan.</p>
              ) : hasActiveSubscription && currentPlanId ? (
                <div className="mt-3">
                  <PlanChangeButton
                    planId={plan.id}
                    interval={interval}
                    label={directionLabel(
                      { planId: currentPlanId, interval: currentInterval! },
                      { planId: plan.id, interval, name: plan.name },
                    )}
                  />
                </div>
              ) : (
                <div className="mt-3">
                  <CheckoutButton
                    planId={plan.id}
                    interval={interval}
                    label={`Choose ${plan.name}`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
