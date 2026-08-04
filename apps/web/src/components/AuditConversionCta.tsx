import { useEffect, useState } from "react";
import { Alert, Button } from "@crawlpact/ui";
import { track } from "../lib/analytics-client";
import type { ConversionCtaCopy } from "../lib/policy-summary";

/**
 * The contextual "Save and monitor this domain" CTA on an anonymous audit report (Phase 5,
 * Anonymous Audit Result and Account-Conversion Flow — prompt §10). Never appears on the shared
 * (`/shared/[token]`) or sample-report pages — only `/audit/[auditId].astro` passes this prop,
 * since only there does "save this domain" make sense (a shared report is already someone else's
 * saved domain; the sample report has no real scan behind it).
 *
 * Preserves the core product promise: this is purely additive to the report the visitor already
 * has. Declining it leaves the full report exactly as useful as it was.
 */
export function AuditConversionCta({
  auditId,
  isAuthenticated,
  ownedDomain,
  copy,
}: {
  auditId: string;
  isAuthenticated: boolean;
  /** Set when the signed-in viewer already has this exact domain saved — in that case there is
   * nothing to convert, only somewhere to go. */
  ownedDomain: { domainId: string } | null;
  copy: ConversionCtaCopy;
}) {
  const [busy, setBusy] = useState<"save_and_monitor" | "save_only" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fires once per mount only — later prop identity changes (there are none in practice,
    // since these come from a single server-rendered pass) intentionally don't re-fire this.
    if (!ownedDomain) track("anonymous_conversion_cta_viewed", { variant: copy.variant });
  }, []);

  if (ownedDomain) {
    return (
      <section className="no-print rounded-panel border border-neutral-200 bg-neutral-50 p-6">
        <h2 className="text-h3 text-neutral-950">You already monitor this domain</h2>
        <p className="mt-2 text-body text-neutral-700">
          This domain is already saved to your account.
        </p>
        <div className="mt-4">
          <a
            href={`/app/domains/${ownedDomain.domainId}`}
            className="inline-flex h-11 items-center justify-center rounded-control bg-brand-600 px-4 text-body font-medium text-white hover:bg-brand-700"
          >
            Manage this domain
          </a>
        </div>
      </section>
    );
  }

  async function startContinuation(intendedAction: "save_and_monitor" | "save_only") {
    if (busy) return;
    setBusy(intendedAction);
    setError(null);
    track("anonymous_conversion_cta_clicked", { variant: copy.variant, intendedAction });
    try {
      const response = await fetch(`/api/audit/${auditId}/continuation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intendedAction }),
      });
      const parsed = (await response.json()) as {
        ok: boolean;
        data?: { continuationId: string };
        error?: { message: string };
      };
      if (!parsed.ok || !parsed.data) {
        setError(parsed.error?.message ?? "This could not be saved right now. Please try again.");
        setBusy(null);
        return;
      }
      const target = isAuthenticated
        ? `/app/continue?continuation=${encodeURIComponent(parsed.data.continuationId)}`
        : `/sign-in?continuation=${encodeURIComponent(parsed.data.continuationId)}`;
      window.location.href = target;
    } catch {
      setError("This could not be saved right now. Please try again.");
      setBusy(null);
    }
  }

  return (
    <section className="no-print rounded-panel border border-neutral-200 bg-white p-6">
      <h2 className="text-h3 text-neutral-950">{copy.headline}</h2>
      <p className="mt-2 text-body text-neutral-700">{copy.body}</p>
      {error && (
        <div className="mt-3">
          <Alert tone="error" title="That didn't work">
            {error}
          </Alert>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          type="button"
          isLoading={busy === "save_and_monitor"}
          disabled={busy !== null && busy !== "save_and_monitor"}
          onClick={() => startContinuation("save_and_monitor")}
        >
          Save and monitor this domain
        </Button>
        <Button
          type="button"
          variant="secondary"
          isLoading={busy === "save_only"}
          disabled={busy !== null && busy !== "save_only"}
          onClick={() => startContinuation("save_only")}
        >
          Save without monitoring
        </Button>
      </div>
      <p className="mt-3 text-supporting text-neutral-500">
        {isAuthenticated
          ? "You're already signed in — this takes you straight to confirming the save."
          : "This takes you to create a free account or sign in with a passkey. Your report stays available either way."}
      </p>
    </section>
  );
}
