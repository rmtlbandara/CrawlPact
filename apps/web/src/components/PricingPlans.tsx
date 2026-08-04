import { useState } from "react";
import { track } from "../lib/analytics-client";

export type PricingPlanEntry = {
  id: "free" | "solo" | "pro" | "agency";
  name: string;
  audience: string;
  cta: string;
  recommended: boolean;
  savedDomainLimit: number;
  monitoringFrequency: "none" | "monthly" | "weekly";
  historyRetentionMonths: number;
  manualRescansPerDomainPerMonth: number;
  domainGroupsEnabled: boolean;
  csvExportEnabled: boolean;
  privateAtomFeedEnabled: boolean;
  batchImportLimit: number;
  agencyBrandingEnabled: boolean;
  /** null for Free — Free has no Paddle price at all. */
  monthlyCents: number | null;
  yearlyCents: number | null;
};

const MONITORING_LABEL: Record<PricingPlanEntry["monitoringFrequency"], string> = {
  none: "No monitoring",
  monthly: "Monthly monitoring",
  weekly: "Weekly monitoring",
};

function formatUsd(cents: number): string {
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

/**
 * The entire interactive pricing surface (Phase 6) — monthly/yearly toggle, plan cards, and the
 * comparison table — as one client island so the toggle never triggers a page reload. Structured
 * pricing data (JSON-LD) is rendered separately, server-side, in pricing.astro's own frontmatter,
 * and lists every interval regardless of which one is selected here.
 */
export function PricingPlans({
  plans,
  isAuthenticated,
}: {
  plans: PricingPlanEntry[];
  isAuthenticated: boolean;
}) {
  const [interval, setInterval] = useState<"month" | "year">("year");

  function ctaHref(plan: PricingPlanEntry): string {
    if (plan.id === "free") return "/audit";
    return isAuthenticated
      ? `/app/billing?plan=${plan.id}&interval=${interval}`
      : `/sign-in?plan=${plan.id}&interval=${interval}`;
  }

  return (
    <div>
      <div
        className="inline-flex rounded-control border border-neutral-300 p-1"
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
              "rounded-control px-4 py-1.5 text-body font-medium " +
              (interval === value
                ? "bg-brand-600 text-white"
                : "text-neutral-700 hover:bg-neutral-50")
            }
          >
            {value === "month" ? "Monthly" : "Yearly — Save up to 18%"}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => (
          <div
            key={plan.id}
            id={plan.id}
            className={
              "scroll-mt-20 rounded-card border p-5 " +
              (plan.recommended ? "border-brand-600 ring-1 ring-brand-600" : "border-neutral-200")
            }
          >
            {plan.recommended && (
              <p className="mb-2 text-metadata font-medium uppercase tracking-wide text-brand-700">
                Most Popular
              </p>
            )}
            <h2 className="text-card-heading text-neutral-950">{plan.name}</h2>
            <p className="mt-1 text-supporting text-neutral-600">{plan.audience}</p>
            {plan.id === "free" ? (
              <p className="mt-2 text-h3 text-neutral-950">$0 forever</p>
            ) : (
              <>
                <p className="mt-2 text-h3 text-neutral-950">
                  ${formatUsd(interval === "month" ? plan.monthlyCents! : plan.yearlyCents!)} /{" "}
                  {interval === "month" ? "month" : "year"}
                </p>
                {interval === "year" && (
                  <p className="text-supporting text-neutral-500">
                    ≈ ${(plan.yearlyCents! / 12 / 100).toFixed(2)}/month
                  </p>
                )}
              </>
            )}
            <p className="mt-2 text-supporting text-neutral-600">
              {plan.savedDomainLimit} domain{plan.savedDomainLimit === 1 ? "" : "s"}
            </p>
            <p className="text-supporting text-neutral-600">
              {MONITORING_LABEL[plan.monitoringFrequency]}
            </p>
            <a
              href={ctaHref(plan)}
              onClick={() => track("plan_selected", { planId: plan.id, interval })}
              className="mt-4 block rounded-control border border-neutral-300 px-3 py-2 text-center text-body font-medium text-neutral-800 hover:bg-neutral-50"
            >
              {plan.cta}
            </a>
          </div>
        ))}
      </div>

      {/* A scrollable region must itself be keyboard-focusable (WCAG 2.1.1;
          axe-core's "scrollable-region-focusable" rule) even though `role="region"`
          isn't in jsx-a11y's interactive-role list — see AuditReportView.tsx for the
          same documented pattern. */}
      <div
        className="mt-10 overflow-x-auto rounded-card border border-neutral-200"
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        role="region"
        aria-label="Plan comparison table"
      >
        <table className="w-full min-w-[720px] border-collapse text-left text-body">
          <thead>
            <tr className="border-b border-neutral-200 text-supporting font-medium text-neutral-600">
              <th scope="col" className="px-4 py-3">
                Feature
              </th>
              {plans.map((plan) => (
                <th key={plan.id} scope="col" className="px-4 py-3 text-neutral-950">
                  {plan.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            <tr>
              <th scope="row" className="px-4 py-3 font-normal text-neutral-600">
                Price
              </th>
              {plans.map((plan) => (
                <td key={plan.id} className="px-4 py-3 font-medium">
                  {plan.id === "free"
                    ? "$0"
                    : `$${formatUsd(interval === "month" ? plan.monthlyCents! : plan.yearlyCents!)}/${interval === "month" ? "mo" : "yr"}`}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className="px-4 py-3 font-normal text-neutral-600">
                Saved domains
              </th>
              {plans.map((plan) => (
                <td key={plan.id} className="px-4 py-3">
                  {plan.savedDomainLimit}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className="px-4 py-3 font-normal text-neutral-600">
                Monitoring
              </th>
              {plans.map((plan) => (
                <td key={plan.id} className="px-4 py-3">
                  {MONITORING_LABEL[plan.monitoringFrequency]}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className="px-4 py-3 font-normal text-neutral-600">
                History retention
              </th>
              {plans.map((plan) => (
                <td key={plan.id} className="px-4 py-3">
                  {plan.historyRetentionMonths >= 1
                    ? `${plan.historyRetentionMonths} month${plan.historyRetentionMonths === 1 ? "" : "s"}`
                    : "30 days"}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className="px-4 py-3 font-normal text-neutral-600">
                Manual rescans / domain / month
              </th>
              {plans.map((plan) => (
                <td key={plan.id} className="px-4 py-3">
                  {plan.manualRescansPerDomainPerMonth}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className="px-4 py-3 font-normal text-neutral-600">
                Private report sharing
              </th>
              {plans.map((plan) => (
                <td key={plan.id} className="px-4 py-3">
                  Yes
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className="px-4 py-3 font-normal text-neutral-600">
                Domain groups
              </th>
              {plans.map((plan) => (
                <td key={plan.id} className="px-4 py-3">
                  {plan.domainGroupsEnabled ? "Yes" : "No"}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className="px-4 py-3 font-normal text-neutral-600">
                CSV export
              </th>
              {plans.map((plan) => (
                <td key={plan.id} className="px-4 py-3">
                  {plan.csvExportEnabled ? "Yes" : "No"}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className="px-4 py-3 font-normal text-neutral-600">
                Private Atom feed
              </th>
              {plans.map((plan) => (
                <td key={plan.id} className="px-4 py-3">
                  {plan.privateAtomFeedEnabled ? "Yes" : "No"}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className="px-4 py-3 font-normal text-neutral-600">
                Batch import
              </th>
              {plans.map((plan) => (
                <td key={plan.id} className="px-4 py-3">
                  {plan.batchImportLimit > 0 ? `Up to ${plan.batchImportLimit}` : "No"}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className="px-4 py-3 font-normal text-neutral-600">
                Agency-branded shared reports
              </th>
              {plans.map((plan) => (
                <td key={plan.id} className="px-4 py-3">
                  {plan.agencyBrandingEnabled ? "Yes" : "No"}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
