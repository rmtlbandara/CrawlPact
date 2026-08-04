import { useState } from "react";
import { Alert, Button } from "@crawlpact/ui";

type PreviewState =
  | { step: "idle" }
  | { step: "loading" }
  | {
      step: "confirming";
      direction: "immediate" | "scheduled";
      immediateTotalCents: number | null;
      currencyCode: string;
      effectiveDate: string | null;
    }
  | { step: "applying" }
  | { step: "done"; direction: "immediate" | "scheduled"; effectiveDate: string | null }
  | { step: "error"; message: string };

function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

/**
 * Plan-change flow for an existing paid subscriber (fixes RISK-017 — the old billing page
 * labelled every non-current plan "Upgrade to X" regardless of actual direction). `label` is
 * computed by the caller from the same direction rule the server re-validates, so the button
 * text is never wrong even before the preview call returns. See
 * docs/billing/PLAN_CHANGE_AND_PRORATION_POLICY.md.
 */
export function PlanChangeButton({
  planId,
  interval,
  label,
}: {
  planId: "solo" | "pro" | "agency";
  interval: "month" | "year";
  label: string;
}) {
  const [state, setState] = useState<PreviewState>({ step: "idle" });

  async function startPreview() {
    setState({ step: "loading" });
    try {
      const response = await fetch("/api/billing/plan-change/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, interval }),
      });
      const body = (await response.json()) as {
        ok: boolean;
        data?: {
          direction: "immediate" | "scheduled";
          currencyCode: string;
          immediateTotalCents: number | null;
          effectiveDate: string | null;
        };
        error?: { message: string };
      };
      if (!body.ok || !body.data) {
        setState({ step: "error", message: body.error?.message ?? "Could not load a preview." });
        return;
      }
      setState({
        step: "confirming",
        direction: body.data.direction,
        immediateTotalCents: body.data.immediateTotalCents,
        currencyCode: body.data.currencyCode,
        effectiveDate: body.data.effectiveDate,
      });
    } catch {
      setState({ step: "error", message: "Could not load a preview. Please try again." });
    }
  }

  async function confirm() {
    setState({ step: "applying" });
    try {
      const response = await fetch("/api/billing/plan-change/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, interval }),
      });
      const body = (await response.json()) as {
        ok: boolean;
        data?: { direction: "immediate" | "scheduled"; effectiveDate: string | null };
        error?: { message: string };
      };
      if (!body.ok || !body.data) {
        setState({ step: "error", message: body.error?.message ?? "This could not be completed." });
        return;
      }
      setState({
        step: "done",
        direction: body.data.direction,
        effectiveDate: body.data.effectiveDate,
      });
    } catch {
      setState({ step: "error", message: "This could not be completed. Please try again." });
    }
  }

  if (state.step === "done") {
    return (
      <Alert
        tone="success"
        title={state.direction === "immediate" ? "Plan updated" : "Change scheduled"}
      >
        {state.direction === "immediate"
          ? "Your plan will update once Paddle confirms the change (usually within moments)."
          : state.effectiveDate
            ? `Your plan will change on ${new Date(state.effectiveDate).toLocaleDateString()}. You keep your current plan until then.`
            : "Your plan will change at the end of the current billing period. You keep your current plan until then."}
      </Alert>
    );
  }

  if (state.step === "confirming") {
    return (
      <div className="flex flex-col gap-3">
        {state.direction === "immediate" ? (
          <p className="text-supporting text-neutral-700">
            {state.immediateTotalCents !== null
              ? `You'll be charged ${formatCents(state.immediateTotalCents, state.currencyCode)} now (prorated), and your new plan applies immediately.`
              : "This applies immediately, prorated for the rest of your billing period."}
          </p>
        ) : (
          <p className="text-supporting text-neutral-700">
            {state.effectiveDate
              ? `This takes effect on ${new Date(state.effectiveDate).toLocaleDateString()}. You keep your current plan and price until then.`
              : "This takes effect at the end of your current billing period. You keep your current plan and price until then."}
          </p>
        )}
        <div className="flex gap-2">
          <Button size="sm" onClick={() => void confirm()}>
            Confirm
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setState({ step: "idle" })}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {state.step === "error" && (
        <div className="mb-2">
          <Alert tone="error" title="That didn't work">
            {state.message}
          </Alert>
        </div>
      )}
      <Button
        isLoading={state.step === "loading" || state.step === "applying"}
        onClick={() => void startPreview()}
      >
        {label}
      </Button>
    </div>
  );
}
