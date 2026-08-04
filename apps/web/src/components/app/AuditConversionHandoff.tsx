import { useEffect, useState } from "react";
import { Alert, Button } from "@crawlpact/ui";
import { track } from "../../lib/analytics-client";

type CompleteResponse = {
  domainId: string;
  canonicalOrigin: string;
  baselineEstablished: boolean;
  baselineStrategy: "adopted" | "rerun" | null;
  scoreValue: number | null;
  monitoringEligible: boolean;
  warning: string | null;
};

type Screen =
  | { step: "confirm" }
  | { step: "confirming" }
  | { step: "error"; message: string }
  | { step: "result"; result: CompleteResponse; monitoring: "pending" | "enabled" | "skipped" };

/**
 * The authenticated handoff step (Phase 5, prompt §14 onward): shown at /app/continue after a
 * viewer has signed in via a "Save and monitor" / "Save without monitoring" CTA click on an
 * anonymous report. Requires one explicit confirm click before doing anything mutating — see
 * docs/security/PHASE_05_AUDIT_CONVERSION_THREAT_REVIEW.md for why this never auto-fires on
 * mount. Monitoring is always a separate, explicit step after the save succeeds, regardless of
 * which CTA the visitor originally clicked.
 */
export function AuditConversionHandoff({
  continuationId,
  canonicalOrigin,
  intendedAction,
}: {
  continuationId: string;
  canonicalOrigin: string;
  intendedAction: "save_and_monitor" | "save_only";
}) {
  const [screen, setScreen] = useState<Screen>({ step: "confirm" });

  useEffect(() => {
    // Fires once when the result screen with an eligible, successful save first appears.
    if (screen.step === "result" && screen.result.monitoringEligible && !screen.result.warning) {
      track("monitoring_setup_viewed");
    }
  }, [screen.step]);

  async function confirm() {
    setScreen({ step: "confirming" });
    try {
      const response = await fetch(`/api/audit/continuation/${continuationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const parsed = (await response.json()) as {
        ok: boolean;
        data?: CompleteResponse;
        error?: { message: string };
      };
      if (!parsed.ok || !parsed.data) {
        setScreen({
          step: "error",
          message: parsed.error?.message ?? "This could not be completed. Please try again.",
        });
        return;
      }
      setScreen({ step: "result", result: parsed.data, monitoring: "pending" });
    } catch {
      setScreen({ step: "error", message: "This could not be completed. Please try again." });
    }
  }

  async function setMonitoring(domainId: string, enable: boolean) {
    setScreen((current) =>
      current.step === "result"
        ? { ...current, monitoring: enable ? "enabled" : "skipped" }
        : current,
    );
    track(enable ? "monitoring_enabled" : "monitoring_skipped");
    if (!enable) return;
    try {
      await fetch(`/api/domains/${domainId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monitoringState: "active" }),
      });
    } catch {
      // Non-fatal — the domain is already saved either way; the dashboard link below always
      // lets the visitor retry from Domains if this particular PATCH failed.
    }
  }

  if (screen.step === "confirm" || screen.step === "confirming") {
    return (
      <section className="rounded-panel border border-neutral-200 bg-white p-6">
        <h1 className="text-h2 text-neutral-950">Save {canonicalOrigin}?</h1>
        <p className="mt-3 text-body text-neutral-700">
          {intendedAction === "save_and_monitor"
            ? "This saves the domain to your account and prepares it for ongoing monitoring."
            : "This saves the domain to your account without enabling monitoring."}{" "}
          Your public report stays available either way.
        </p>
        <div className="mt-5">
          <Button isLoading={screen.step === "confirming"} onClick={() => void confirm()}>
            Confirm and save
          </Button>
        </div>
      </section>
    );
  }

  if (screen.step === "error") {
    return (
      <section className="rounded-panel border border-neutral-200 bg-white p-6">
        <Alert tone="error" title="That didn't work">
          {screen.message}
        </Alert>
        <div className="mt-4">
          <a
            href="/app/domains"
            className="text-body font-medium text-brand-700 underline underline-offset-2"
          >
            Go to your domains
          </a>
        </div>
      </section>
    );
  }

  const { result, monitoring } = screen;

  return (
    <section className="flex flex-col gap-6">
      <section className="rounded-panel border border-neutral-200 bg-white p-6">
        <h1 className="text-h2 text-neutral-950">{result.canonicalOrigin} is saved</h1>
        {result.warning ? (
          <p className="mt-3 text-body text-neutral-700">{result.warning}</p>
        ) : (
          <p className="mt-3 text-body text-neutral-700">
            {result.baselineStrategy === "adopted"
              ? "Your original scan is now this domain's starting result."
              : "A fresh scan was run to establish this domain's starting result."}
            {result.scoreValue !== null && ` Current score: ${result.scoreValue}.`}
          </p>
        )}
      </section>

      {result.monitoringEligible && !result.warning && (
        <section className="rounded-panel border border-neutral-200 bg-white p-6">
          <h2 className="text-h3 text-neutral-950">Enable monitoring?</h2>
          <p className="mt-2 text-body text-neutral-700">
            CrawlPact will periodically re-check this domain and alert you if its AI crawler policy
            changes. You can turn this on or off at any time from the domain's page.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              disabled={monitoring !== "pending"}
              onClick={() => void setMonitoring(result.domainId, true)}
            >
              {monitoring === "enabled" ? "Monitoring enabled" : "Enable monitoring"}
            </Button>
            <Button
              variant="secondary"
              disabled={monitoring !== "pending"}
              onClick={() => void setMonitoring(result.domainId, false)}
            >
              {monitoring === "skipped" ? "Skipped" : "Not now"}
            </Button>
          </div>
        </section>
      )}

      {!result.monitoringEligible && !result.warning && (
        <section className="rounded-panel border border-neutral-200 bg-neutral-50 p-6">
          <h2 className="text-h3 text-neutral-950">Monitoring isn't included on your plan</h2>
          <p className="mt-2 text-body text-neutral-700">
            Your domain has been saved. Upgrading your plan adds scheduled re-checks and change
            alerts for it.
          </p>
          <a
            href="/app/billing"
            className="mt-3 inline-block text-body font-medium text-brand-700 underline underline-offset-2"
          >
            View plans
          </a>
        </section>
      )}

      {(monitoring !== "pending" || result.warning || !result.monitoringEligible) && (
        <a
          href={`/app/domains/${result.domainId}`}
          className="inline-flex h-11 w-fit items-center justify-center rounded-control bg-brand-600 px-4 text-body font-medium text-white hover:bg-brand-700"
        >
          Go to {result.canonicalOrigin}
        </a>
      )}
    </section>
  );
}
