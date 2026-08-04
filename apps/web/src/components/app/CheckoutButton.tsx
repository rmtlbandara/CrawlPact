import { useState } from "react";
import { initializePaddle } from "@paddle/paddle-js";
import { Alert, Button } from "@crawlpact/ui";
import { track } from "../../lib/analytics-client";

export function CheckoutButton({
  planId,
  interval,
  label,
}: {
  planId: "solo" | "pro" | "agency";
  interval: "month" | "year";
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setError(null);
    track("plan_selected", { planId, interval });
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, interval }),
      });
      const body = (await response.json()) as {
        ok: boolean;
        data?: {
          priceId: string;
          customData: { userId: string };
          clientToken: string;
          environment: "sandbox" | "production";
        };
        error?: { message: string };
      };
      if (!body.ok || !body.data) {
        setError(body.error?.message ?? "Could not start checkout.");
        track("checkout_failed", { planId, interval });
        return;
      }

      const paddle = await initializePaddle({
        token: body.data.clientToken,
        environment: body.data.environment,
      });
      if (!paddle) {
        setError("Checkout could not be loaded. Please try again.");
        track("checkout_failed", { planId, interval });
        return;
      }

      track("checkout_opened", { planId, interval });
      paddle.Checkout.open({
        items: [{ priceId: body.data.priceId, quantity: 1 }],
        customData: body.data.customData,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-2">
          <Alert tone="error" title="Checkout unavailable">
            {error}
          </Alert>
        </div>
      )}
      <Button isLoading={busy} onClick={() => void handleClick()}>
        {label}
      </Button>
    </div>
  );
}
