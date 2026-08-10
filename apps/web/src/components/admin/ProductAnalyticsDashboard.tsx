import { useEffect, useState } from "react";
import { Card, MetricCard, Select } from "@crawlpact/ui";

type RatioMetric = { numerator: number; denominator: number; percent: number | null };

type ProductAnalyticsSnapshot = {
  rangeDays: number;
  executiveSummary: {
    totalAccounts: number;
    activatedAccounts: number;
    activePaidAccounts: number;
    monitoredDomains: number;
    wau: number;
    mau: number;
    auditToSavedDomainConversion: RatioMetric;
  };
  acquisition: {
    landingViewedInRange: number;
    auditStartedInRange: number;
    pricingViewedInRange: number;
  };
  auditFunnel: {
    auditStarted: number;
    auditCompleted: number;
    resultViewed: number;
    accountCreated: number;
    domainSaved: number;
    completionRate: RatioMetric;
    resultViewRate: RatioMetric;
    resultToSignupRate: RatioMetric;
    signupToSavedDomainRate: RatioMetric;
  };
  activation: { accountsWithBaseline: RatioMetric; accountsWithMonitoringEnabled: RatioMetric };
  engagement: {
    domainOpened: number;
    timelineViewed: number;
    rescanUsed: number;
    reportShared: number;
  };
  retention: { activatedInRange: number; stillActiveInRange: RatioMetric };
  conversion: {
    pricingViewed: number;
    planSelected: number;
    checkoutOpened: number;
    subscriptionActivated: number;
  };
  revenue: { activeSubscriptionsByPlan: Record<string, number>; estimatedMrrUsdCents: number };
  agency: {
    agencyPlanAccounts: number;
    accountsUsingGroups: number;
    accountsUsingCsvImport: number;
    accountsUsingCsvExport: number;
    accountsWithAgencyBranding: number;
  };
  measurementHealth: {
    lastEventAt: string | null;
    eventsLast24h: number;
    consentGrantedLast30d: number;
    consentDeclinedLast30d: number;
  };
};

function RatioText({ ratio, suffix }: { ratio: RatioMetric; suffix: string }) {
  if (ratio.denominator === 0) {
    return <span className="text-neutral-500">Insufficient historical data</span>;
  }
  return (
    <span>
      {ratio.numerator} / {ratio.denominator} {suffix} — {ratio.percent}%
    </span>
  );
}

/**
 * Phase 13 Super Admin product-measurement dashboard
 * (docs/analytics/CRAWLPACT_PRODUCT_MEASUREMENT_STRATEGY.md). Aggregate
 * numbers only — never a per-visitor clickstream or search-by-person
 * surface (docs/analytics/PRODUCT_METRIC_DICTIONARY.md "Admin privacy").
 */
export function ProductAnalyticsDashboard() {
  const [rangeDays, setRangeDays] = useState("30");
  const [snapshot, setSnapshot] = useState<ProductAnalyticsSnapshot | null>(null);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    setSnapshot(null);
    setError(undefined);
    fetch(`/api/admin/analytics?rangeDays=${rangeDays}`)
      .then(
        (res) =>
          res.json() as Promise<{
            ok: boolean;
            data?: ProductAnalyticsSnapshot;
            error?: { message: string };
          }>,
      )
      .then((body) => {
        if (!body.ok || !body.data) throw new Error(body.error?.message ?? "Request failed");
        setSnapshot(body.data);
      })
      .catch((err) => setError((err as Error).message));
  }, [rangeDays]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <label htmlFor="range-select" className="text-supporting font-medium text-neutral-700">
          Date range
        </label>
        <Select
          id="range-select"
          value={rangeDays}
          onValueChange={setRangeDays}
          options={[
            { value: "7", label: "7 days" },
            { value: "30", label: "30 days" },
            { value: "90", label: "90 days" },
            { value: "365", label: "12 months" },
          ]}
        />
      </div>

      {error && <p className="text-supporting text-error">{error}</p>}
      {!snapshot && !error && <p className="text-supporting text-neutral-600">Loading…</p>}

      {snapshot && (
        <>
          <section aria-labelledby="exec-summary-heading">
            <h2 id="exec-summary-heading" className="text-card-heading text-neutral-950">
              Executive summary
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              <MetricCard label="Total accounts" value={snapshot.executiveSummary.totalAccounts} />
              <MetricCard
                label="Activated accounts"
                value={snapshot.executiveSummary.activatedAccounts}
                helpText="At least one saved domain with an established baseline"
              />
              <MetricCard
                label="Active paid accounts"
                value={snapshot.executiveSummary.activePaidAccounts}
              />
              <MetricCard
                label="Monitored domains"
                value={snapshot.executiveSummary.monitoredDomains}
              />
              <MetricCard
                label="WAU"
                value={snapshot.executiveSummary.wau}
                helpText="Last 7 days"
              />
              <MetricCard
                label="MAU"
                value={snapshot.executiveSummary.mau}
                helpText="Last 30 days"
              />
              <MetricCard
                label="Audit → saved-domain conversion"
                value={
                  <RatioText
                    ratio={snapshot.executiveSummary.auditToSavedDomainConversion}
                    suffix=""
                  />
                }
              />
            </div>
          </section>

          <section aria-labelledby="acquisition-heading">
            <h2 id="acquisition-heading" className="text-card-heading text-neutral-950">
              Acquisition
            </h2>
            <p className="mt-1 text-supporting text-neutral-500">
              First-party aggregate counts — not attribution; consented Google Analytics separately
              covers marketing-page traffic (see the analytics/consent design docs).
            </p>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <MetricCard
                label="Landing viewed"
                value={snapshot.acquisition.landingViewedInRange}
              />
              <MetricCard label="Audits started" value={snapshot.acquisition.auditStartedInRange} />
              <MetricCard
                label="Pricing viewed"
                value={snapshot.acquisition.pricingViewedInRange}
              />
            </div>
          </section>

          <section aria-labelledby="audit-funnel-heading">
            <h2 id="audit-funnel-heading" className="text-card-heading text-neutral-950">
              Audit funnel
            </h2>
            <Card className="mt-3">
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-supporting text-neutral-600">Completion rate</dt>
                  <dd className="text-body text-neutral-950">
                    <RatioText ratio={snapshot.auditFunnel.completionRate} suffix="completed" />
                  </dd>
                </div>
                <div>
                  <dt className="text-supporting text-neutral-600">Result-view rate</dt>
                  <dd className="text-body text-neutral-950">
                    <RatioText ratio={snapshot.auditFunnel.resultViewRate} suffix="viewed" />
                  </dd>
                </div>
                <div>
                  <dt className="text-supporting text-neutral-600">Result → signup</dt>
                  <dd className="text-body text-neutral-950">
                    <RatioText ratio={snapshot.auditFunnel.resultToSignupRate} suffix="signed up" />
                  </dd>
                </div>
                <div>
                  <dt className="text-supporting text-neutral-600">Signup → saved domain</dt>
                  <dd className="text-body text-neutral-950">
                    <RatioText
                      ratio={snapshot.auditFunnel.signupToSavedDomainRate}
                      suffix="saved"
                    />
                  </dd>
                </div>
              </dl>
            </Card>
          </section>

          <section aria-labelledby="activation-heading">
            <h2 id="activation-heading" className="text-card-heading text-neutral-950">
              Activation
            </h2>
            <Card className="mt-3">
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-supporting text-neutral-600">Accounts with a baseline</dt>
                  <dd className="text-body text-neutral-950">
                    <RatioText
                      ratio={snapshot.activation.accountsWithBaseline}
                      suffix="of all accounts"
                    />
                  </dd>
                </div>
                <div>
                  <dt className="text-supporting text-neutral-600">
                    Monitoring enabled (of activated)
                  </dt>
                  <dd className="text-body text-neutral-950">
                    <RatioText
                      ratio={snapshot.activation.accountsWithMonitoringEnabled}
                      suffix=""
                    />
                  </dd>
                </div>
              </dl>
            </Card>
          </section>

          <section aria-labelledby="engagement-heading">
            <h2 id="engagement-heading" className="text-card-heading text-neutral-950">
              Engagement
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <MetricCard label="Domains opened" value={snapshot.engagement.domainOpened} />
              <MetricCard label="Timelines viewed" value={snapshot.engagement.timelineViewed} />
              <MetricCard label="Rescans used" value={snapshot.engagement.rescanUsed} />
              <MetricCard label="Reports shared" value={snapshot.engagement.reportShared} />
            </div>
          </section>

          <section aria-labelledby="retention-heading">
            <h2 id="retention-heading" className="text-card-heading text-neutral-950">
              Retention (simplified)
            </h2>
            <p className="mt-1 text-supporting text-neutral-500">
              Accounts created within the range who also generated any product event in the last 30
              days — a simplified proxy, not full cohort day-N retention (see
              docs/analytics/PRODUCT_METRIC_DICTIONARY.md).
            </p>
            <Card className="mt-3">
              <RatioText ratio={snapshot.retention.stillActiveInRange} suffix="still active" />
            </Card>
          </section>

          <section aria-labelledby="conversion-heading">
            <h2 id="conversion-heading" className="text-card-heading text-neutral-950">
              Billing conversion
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <MetricCard label="Pricing viewed" value={snapshot.conversion.pricingViewed} />
              <MetricCard label="Plan selected" value={snapshot.conversion.planSelected} />
              <MetricCard label="Checkout opened" value={snapshot.conversion.checkoutOpened} />
              <MetricCard
                label="Subscription activated"
                value={snapshot.conversion.subscriptionActivated}
              />
            </div>
          </section>

          <section aria-labelledby="revenue-heading">
            <h2 id="revenue-heading" className="text-card-heading text-neutral-950">
              Revenue (from billing truth, not analytics)
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Object.entries(snapshot.revenue.activeSubscriptionsByPlan).map(([plan, n]) => (
                <MetricCard key={plan} label={`Active — ${plan}`} value={n} />
              ))}
              <MetricCard
                label="Estimated MRR"
                value={`$${(snapshot.revenue.estimatedMrrUsdCents / 100).toLocaleString()}`}
                helpText="Estimated from active subscriptions' list price — not a Paddle-reconciled figure"
              />
            </div>
          </section>

          <section aria-labelledby="agency-heading">
            <h2 id="agency-heading" className="text-card-heading text-neutral-950">
              Agency adoption
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <MetricCard label="Agency-plan accounts" value={snapshot.agency.agencyPlanAccounts} />
              <MetricCard label="Using groups" value={snapshot.agency.accountsUsingGroups} />
              <MetricCard label="Using CSV import" value={snapshot.agency.accountsUsingCsvImport} />
              <MetricCard label="Using CSV export" value={snapshot.agency.accountsUsingCsvExport} />
              <MetricCard
                label="With agency branding"
                value={snapshot.agency.accountsWithAgencyBranding}
              />
            </div>
          </section>

          <section aria-labelledby="measurement-health-heading">
            <h2 id="measurement-health-heading" className="text-card-heading text-neutral-950">
              Measurement health
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <MetricCard
                label="Last event"
                value={
                  snapshot.measurementHealth.lastEventAt
                    ? new Date(snapshot.measurementHealth.lastEventAt).toLocaleString()
                    : "None yet"
                }
              />
              <MetricCard label="Events (24h)" value={snapshot.measurementHealth.eventsLast24h} />
              <MetricCard
                label="Analytics consent granted (30d)"
                value={snapshot.measurementHealth.consentGrantedLast30d}
              />
              <MetricCard
                label="Analytics consent declined (30d)"
                value={snapshot.measurementHealth.consentDeclinedLast30d}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
