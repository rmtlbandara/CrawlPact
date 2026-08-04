import { useState } from "react";
import { Alert, Button } from "@crawlpact/ui";
import { track } from "../../lib/analytics-client";

export function PortalButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/portal-session", { method: "POST" });
      const body = (await response.json()) as {
        ok: boolean;
        data?: { url: string };
        error?: { message: string };
      };
      if (!body.ok || !body.data) {
        setError(body.error?.message ?? "The billing portal is unavailable right now.");
        return;
      }
      track("customer_portal_opened");
      window.location.href = body.data.url;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-2">
          <Alert tone="error" title="That didn't work">
            {error}
          </Alert>
        </div>
      )}
      <Button variant="secondary" isLoading={busy} onClick={() => void handleClick()}>
        Manage billing
      </Button>
    </div>
  );
}
