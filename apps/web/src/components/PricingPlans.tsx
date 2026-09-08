import { useState } from "react";
import { track } from "../lib/analytics-client";
import { COMPARISON_SECTIONS, formatUsdCents, planPriceLabel } from "../lib/pricing-comparison";
import type { ComparisonCell } from "../lib/pricing-comparison";

export type PricingPlanEntry = {
  id: "free" | "solo" | "pro" | "agency";
  name: string;
  audience: string;
  cta: string;
  recommended: boolean;
  savedDomainLimit: number;
  monitoringFrequency: "none" | "monthly" | "weekly";
  /** Raw retention in days, straight from the plan catalog — never pre-rounded to months here,
   * so display formatting (pricing-comparison.ts's formatHistoryRetention) has the real value to
   * work with instead of a second, lossy copy. */
  historyRetentionDays: number;
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

const formatUsd = formatUsdCents;

function ComparisonCellContent({ cell }: { cell: ComparisonCell }) {
  if (cell.kind === "included") {
    return (
      <span className="inline-flex items-center gap-1.5 text-neutral-800">
        <span aria-hidden="true">✓</span> Included
      </span>
    );
  }
  if (cell.kind === "not-included") {
    return (
      <span className="text-neutral-400">
        <span aria-hidden="true">—</span>
        <span className="sr-only">Not included</span>
      </span>
    );
  }
  return <span className="text-neutral-800">{cell.text}</span>;
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
    if (plan.id === "free") return "/audit/";
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
              "flex h-full scroll-mt-20 flex-col rounded-card border p-5 " +
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
              className="mt-auto block rounded-control border border-neutral-300 px-3 py-2 text-center text-body font-medium text-neutral-800 hover:bg-neutral-50"
            >
              {plan.cta}
            </a>
          </div>
        ))}
      </div>

      <div className="mt-10 max-w-2xl">
        <h2 className="text-h3 text-neutral-950">Every plan includes the full audit</h2>
        <p className="mt-2 text-body text-neutral-700">
          Every CrawlPact plan includes the complete AI crawler policy audit — Free included. Choose
          a paid plan when you need recurring monitoring, longer history, more domains, or portfolio
          workflows.
        </p>
      </div>

      <p className="mt-6 text-supporting text-neutral-500 sm:hidden">
        Swipe horizontally to compare plans.
      </p>

      <div className="mt-4 space-y-10">
        {COMPARISON_SECTIONS.map((section) => (
          <section key={section.id}>
            <h3 className="text-card-heading text-neutral-950">{section.heading}</h3>
            {/* A scrollable region must itself be keyboard-focusable (WCAG 2.1.1;
                axe-core's "scrollable-region-focusable" rule) even though `role="region"`
                isn't in jsx-a11y's interactive-role list — see AuditReportView.tsx for the
                same documented pattern. */}
            <div
              // `contain:paint` stops this box's clipped table content from being counted
              // toward the document's root scrollWidth — without it, four sibling
              // overflow-x-auto tables (vs. the old single table) tickle a real Chromium
              // behavior where document.documentElement.scrollWidth includes a scrolled
              // container's full unclipped content extent even though the container itself,
              // and every ancestor up to <body>, measures and behaves correctly (verified via
              // getBoundingClientRect on every level — only the root scrollWidth figure was
              // wrong, though window.scrollTo could still pan there, so this is a real,
              // user-triggerable page-level horizontal scroll, not just a stale-property
              // artifact). Reproduced/fixed against the real page via a temporary debug
              // spec — regression-tested at 320px in forced-colors-and-zoom.spec.ts.
              className="mt-3 overflow-x-auto rounded-card border border-neutral-200 [contain:paint]"
              // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
              tabIndex={0}
              role="region"
              aria-label={section.scrollRegionLabel}
            >
              <table className="w-full min-w-[640px] border-collapse text-left text-body">
                <caption className="sr-only">{section.caption}</caption>
                <thead>
                  <tr className="border-b border-neutral-200 text-supporting font-medium text-neutral-600">
                    <th scope="col" className="px-4 py-3">
                      Feature
                    </th>
                    {plans.map((plan) => (
                      <th
                        key={plan.id}
                        scope="col"
                        className={
                          "px-4 py-3 align-bottom text-neutral-950 " +
                          (plan.recommended ? "bg-brand-50" : "")
                        }
                      >
                        {plan.recommended && (
                          <span className="block text-metadata font-medium uppercase tracking-wide text-brand-700">
                            Most Popular
                          </span>
                        )}
                        <span className="block">{plan.name}</span>
                        <span className="block text-supporting font-normal text-neutral-600">
                          {planPriceLabel(plan, interval)}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {section.rows.map((row) => (
                    <tr key={row.key}>
                      <th scope="row" className="px-4 py-3 align-top font-normal text-neutral-600">
                        <span className="block text-neutral-800">{row.label}</span>
                        {row.description && (
                          <span className="mt-0.5 block text-supporting text-neutral-500">
                            {row.description}
                          </span>
                        )}
                      </th>
                      {plans.map((plan) => (
                        <td
                          key={plan.id}
                          className={"px-4 py-3 " + (plan.recommended ? "bg-brand-50" : "")}
                        >
                          <ComparisonCellContent cell={row.cell(plan)} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      <div className="mt-10 rounded-card border border-neutral-200 bg-neutral-50 p-5 text-center">
        <p className="text-body text-neutral-700">
          Not ready to choose? Start with the free audit and upgrade when you need monitoring.
        </p>
        <a
          href="/audit/"
          onClick={() => track("plan_selected", { planId: "free", interval })}
          className="mt-3 inline-block rounded-control border border-neutral-300 bg-white px-4 py-2 text-body font-medium text-neutral-800 hover:bg-neutral-100"
        >
          Audit a domain free
        </a>
      </div>
    </div>
  );
}
