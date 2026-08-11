import { useEffect, useState } from "react";
import { Button, DataTable, StatusChip } from "@crawlpact/ui";
import type { DataTableColumn } from "@crawlpact/ui";
import { AdminActionDialog } from "./AdminActionDialog";

type PublicationRow = {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "review" | "published" | "corrected" | "superseded" | "withdrawn";
  registryVersionId: string;
  methodologyVersion: string;
  checksum: string;
  createdAt: string;
  publishedAt: string | null;
  correctedAt: string | null;
};

type ValidationIssue = { code: string; message: string };

const STATUS_TONE: Record<PublicationRow["status"], "success" | "info" | "warning" | "error"> = {
  draft: "info",
  review: "warning",
  published: "success",
  corrected: "warning",
  superseded: "info",
  withdrawn: "error",
};

/**
 * Phase 16 Super Admin research workspace — the "Collect → Validate →
 * Review → Approve → Publish" flow (§45). Only the Registry Landscape
 * publication kind exists this phase; there is no website-policy corpus/run
 * UI because Layer B was not built — see
 * docs/research/PHASE_16_RESEARCH_CORPUS_DECISION.md.
 */
export function ResearchManager() {
  const [rows, setRows] = useState<PublicationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [submitReviewTarget, setSubmitReviewTarget] = useState<string | null>(null);
  const [publishTarget, setPublishTarget] = useState<string | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<string | null>(null);
  const [lastValidation, setLastValidation] = useState<{
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
  } | null>(null);

  async function load() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/research/publications");
      const body = (await res.json()) as {
        ok: boolean;
        data?: { publications: PublicationRow[] };
        error?: { message: string };
      };
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setRows(body.data?.publications ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function generateDraft(reason: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/research/publications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setBanner("Draft generated from the current active registry release. Not publicly visible.");
      setGenerateOpen(false);
      await load();
    } catch (err) {
      setBanner((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitReview(reason: string) {
    if (!submitReviewTarget) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/research/publications/${submitReviewTarget}/submit-review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      );
      const body = (await res.json()) as {
        ok: boolean;
        data?: { validation: { errors: ValidationIssue[]; warnings: ValidationIssue[] } };
        error?: { message: string };
      };
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setLastValidation(body.data?.validation ?? null);
      if ((body.data?.validation.errors.length ?? 0) > 0) {
        setBanner("Validation failed — still a draft. See issues below.");
      } else {
        setBanner("Submitted for review. Still not publicly visible.");
        setSubmitReviewTarget(null);
      }
      await load();
    } catch (err) {
      setBanner((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function publish(reason: string) {
    if (!publishTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/research/publications/${publishTarget}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setBanner("Published — now publicly visible at /research.");
      setPublishTarget(null);
      await load();
    } catch (err) {
      setBanner((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(reason: string) {
    if (!withdrawTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/research/publications/${withdrawTarget}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setBanner("Withdrawn — the page remains at its URL with a withdrawal notice.");
      setWithdrawTarget(null);
      await load();
    } catch (err) {
      setBanner((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const columns: DataTableColumn<PublicationRow>[] = [
    { key: "title", header: "Title", render: (r) => r.title },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusChip tone={STATUS_TONE[r.status]} label={r.status} />,
    },
    { key: "slug", header: "Slug", render: (r) => r.slug, hideBelow: "md" },
    {
      key: "created",
      header: "Created",
      render: (r) => new Date(r.createdAt).toLocaleString(),
      hideBelow: "lg",
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className="flex gap-3">
          {r.status === "draft" && (
            <button
              type="button"
              className="text-supporting font-medium text-brand-700 hover:underline"
              onClick={() => setSubmitReviewTarget(r.id)}
            >
              Submit for review
            </button>
          )}
          {r.status === "review" && (
            <button
              type="button"
              className="text-supporting font-medium text-brand-700 hover:underline"
              onClick={() => setPublishTarget(r.id)}
            >
              Publish
            </button>
          )}
          {(r.status === "published" || r.status === "corrected") && (
            <button
              type="button"
              className="text-supporting font-medium text-red-700 hover:underline"
              onClick={() => setWithdrawTarget(r.id)}
            >
              Withdraw
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {banner && <p className="text-supporting text-neutral-700">{banner}</p>}
      <Button className="self-start" onClick={() => setGenerateOpen(true)}>
        Generate Registry Landscape draft
      </Button>

      <section>
        <h2 className="text-h3 text-neutral-950">Publications</h2>
        <div className="mt-3">
          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(r) => r.id}
            isLoading={isLoading}
            error={error}
            emptyTitle="No publications yet"
          />
        </div>
      </section>

      {lastValidation && (
        <section className="rounded-card border border-neutral-200 bg-white p-4">
          {lastValidation.errors.length > 0 && (
            <div className="rounded-card border border-red-300 bg-red-50 p-2">
              <p className="text-supporting font-semibold text-red-800">
                Blocking validation errors — cannot move to review:
              </p>
              <ul className="mt-1 list-inside list-disc text-supporting text-red-800">
                {lastValidation.errors.map((e) => (
                  <li key={e.code}>{e.message}</li>
                ))}
              </ul>
            </div>
          )}
          {lastValidation.warnings.length > 0 && (
            <div className="mt-2 rounded-card border border-amber-300 bg-amber-50 p-2">
              <p className="text-supporting font-semibold text-amber-800">Warnings:</p>
              <ul className="mt-1 list-inside list-disc text-supporting text-amber-800">
                {lastValidation.warnings.map((w) => (
                  <li key={w.code}>{w.message}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <AdminActionDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        title="Generate a Registry Landscape draft"
        description="Deterministically computes a new draft publication from the currently active registry release. Not publicly visible until submitted for review and then explicitly published."
        confirmLabel="Generate draft"
        busy={busy}
        onConfirm={generateDraft}
      />

      <AdminActionDialog
        open={submitReviewTarget !== null}
        onOpenChange={(open) => !open && setSubmitReviewTarget(null)}
        title="Submit for review"
        description="Runs automated validation (denominators, methodology version, unsupported-claim language). Still not publicly visible."
        confirmLabel="Submit for review"
        busy={busy}
        onConfirm={submitReview}
      />

      <AdminActionDialog
        open={publishTarget !== null}
        onOpenChange={(open) => !open && setPublishTarget(null)}
        title="Publish this research publication"
        description="Makes it publicly visible at /research immediately. This is a meaningful public-trust action — publishing a research study is not reversible by editing, only by a governed correction or withdrawal."
        confirmLabel="Publish"
        busy={busy}
        onConfirm={publish}
      />

      <AdminActionDialog
        open={withdrawTarget !== null}
        onOpenChange={(open) => !open && setWithdrawTarget(null)}
        title="Withdraw this publication"
        description="Terminal — the page stays at its URL but renders a withdrawal notice instead of the data. This cannot be undone by republishing the same row."
        confirmLabel="Withdraw"
        destructive
        busy={busy}
        onConfirm={withdraw}
      />
    </div>
  );
}
