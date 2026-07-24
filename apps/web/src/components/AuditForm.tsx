import { useId, useState } from "react";
import type { FormEvent } from "react";
import { normalizeTarget } from "@crawlpact/core";
import { Button, Input } from "@crawlpact/ui";

type SubmitState =
  | { status: "idle" }
  | { status: "invalid"; message: string }
  | { status: "submitting" }
  | { status: "disabled"; message: string }
  | { status: "error"; message: string };

/**
 * The hero/final-CTA audit form (SRS §9.5, §9.18, FR-AUD-001). Runs
 * client-side normalisation first so obviously invalid input never reaches
 * the network, then calls the real /api/audit contract. Until Part 2 ships
 * the scanner, the API responds with AUDIT_ENGINE_DISABLED and this
 * component shows that honestly — it never fabricates a report (see
 * docs/status/KNOWN_RISKS.md).
 */
export function AuditForm({
  idPrefix,
  focus,
}: {
  idPrefix: string;
  /** Reorders the resulting report to lead with the relevant section for
   * this entry point (SRS §30 free tools) — the underlying audit is always
   * the same real scan, nothing is hidden. */
  focus?: "crawlers" | "robots" | "llms" | "rsl" | "content-signals";
}) {
  const [value, setValue] = useState("");
  const [state, setState] = useState<SubmitState>({ status: "idle" });
  const inputId = useId();
  const errorId = `${idPrefix}-error`;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (state.status === "submitting") return; // prevent duplicate submission (SRS FR-AUD requirement)

    const normalized = normalizeTarget(value);
    if (!normalized.ok) {
      setState({
        status: "invalid",
        message:
          normalized.reason === "empty"
            ? "Enter a domain, such as example.com"
            : "This does not look like a public domain or URL CrawlPact can audit.",
      });
      return;
    }

    setState({ status: "submitting" });
    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: value }),
      });
      const body = (await response.json()) as {
        ok: boolean;
        error?: { code: string; message: string };
        data?: { auditId: string };
      };

      if (!body.ok) {
        if (body.error?.code === "AUDIT_ENGINE_DISABLED") {
          setState({ status: "disabled", message: body.error.message });
          return;
        }
        setState({ status: "error", message: body.error?.message ?? "Something went wrong." });
        return;
      }

      window.location.href = focus
        ? `/audit/${body.data!.auditId}?focus=${focus}`
        : `/audit/${body.data!.auditId}`;
    } catch {
      setState({
        status: "error",
        message: "CrawlPact could not reach the audit service. Please try again.",
      });
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:items-start"
    >
      <div className="flex-1">
        <label htmlFor={inputId} className="sr-only">
          Domain or URL to audit
        </label>
        <Input
          id={inputId}
          name="target"
          placeholder="Enter a domain, such as example.com"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-invalid={state.status === "invalid" || state.status === "error" || undefined}
          aria-describedby={
            state.status !== "idle" && state.status !== "submitting" ? errorId : undefined
          }
          autoComplete="off"
          inputMode="url"
        />
        {state.status === "invalid" && (
          <p id={errorId} role="alert" className="mt-1.5 text-supporting text-error">
            {state.message}
          </p>
        )}
        {state.status === "error" && (
          <p id={errorId} role="alert" className="mt-1.5 text-supporting text-error">
            {state.message}
          </p>
        )}
        {state.status === "disabled" && (
          <p id={errorId} role="status" className="mt-1.5 text-supporting text-neutral-600">
            {state.message}
          </p>
        )}
      </div>
      <Button type="submit" size="lg" isLoading={state.status === "submitting"}>
        Audit domain
      </Button>
    </form>
  );
}
