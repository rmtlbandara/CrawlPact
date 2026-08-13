import { useEffect, useState } from "react";
import { Button, FormField, Modal, Select, Textarea } from "@crawlpact/ui";

const CATEGORIES = [
  "onboarding",
  "audit_clarity",
  "evidence",
  "recommendation",
  "saved_domain",
  "timeline",
  "monitoring",
  "notification",
  "report_sharing",
  "agency_workspace",
  "pricing",
  "billing",
  "reliability",
  "support",
  "feature_request",
  "other",
] as const;

/**
 * §43: a non-intrusive link, not a popup, shown only to actual pilot
 * participants — checked once on mount via a lightweight fetch. Renders
 * nothing for the overwhelming majority of (non-pilot) users, so normal app
 * navigation carries no extra weight for them beyond this one check.
 */
export function PilotFeedbackLink() {
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("onboarding");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/app/pilot/feedback")
      .then((r) => r.json())
      .then((raw: unknown) => {
        const body = raw as {
          ok: boolean;
          data?: { isPilotParticipant: boolean; participantIds: string[] };
        };
        if (body.ok && body.data?.isPilotParticipant) {
          setParticipantId(body.data.participantIds[0] ?? null);
        }
      })
      .catch(() => {
        // Non-critical UI affordance — a failed check simply hides the link.
      });
  }, []);

  if (!participantId) return null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/app/pilot/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId,
          category,
          comment: comment.trim() || undefined,
        }),
      });
      const body = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setSubmitted(true);
      setComment("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="rounded-control px-3 py-2 text-body font-medium text-neutral-700 hover:bg-neutral-100"
        onClick={() => {
          setOpen(true);
          setSubmitted(false);
        }}
      >
        Pilot feedback
      </button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Pilot feedback"
        description="Optional. Tell us what's working or not — this is private and only visible to the CrawlPact team."
        footer={
          submitted ? (
            <Button onClick={() => setOpen(false)}>Close</Button>
          ) : (
            <Button onClick={submit} disabled={busy}>
              {busy ? "Sending…" : "Send feedback"}
            </Button>
          )
        }
      >
        {submitted ? (
          <p className="text-body text-neutral-700">Thank you — this has been recorded.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {error && <p className="text-supporting text-red-700">{error}</p>}
            <FormField label="What is this about?">
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as (typeof CATEGORIES)[number])}
                options={CATEGORIES.map((c) => ({ value: c, label: c.replace(/_/g, " ") }))}
              />
            </FormField>
            <FormField label="Comment (optional)">
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 1000))}
                maxLength={1000}
                rows={4}
                placeholder="What's working, what's confusing, what's missing — never enter a password or payment detail here."
              />
            </FormField>
          </div>
        )}
      </Modal>
    </>
  );
}
