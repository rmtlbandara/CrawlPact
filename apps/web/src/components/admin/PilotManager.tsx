import { useEffect, useState } from "react";
import { Button, DataTable, FormField, Input, Select, StatusChip, Textarea } from "@crawlpact/ui";
import type { DataTableColumn } from "@crawlpact/ui";
import { AdminActionDialog } from "./AdminActionDialog";

type CohortRow = {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "recruiting" | "active" | "analysis" | "completed" | "cancelled";
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
};

type ParticipantRow = {
  id: string;
  userId: string;
  segment: "individual" | "professional" | "agency" | "multi_site" | "other";
  participationStatus:
    "invited" | "joined" | "active" | "completed" | "withdrew" | "inactive" | "disqualified";
  acquisitionSource: string | null;
  humanHelpCount: number;
  joinedAt: string | null;
  createdAt: string;
};

type RatioMetric = { numerator: number; denominator: number; percent: number | null };

type CohortMetrics = {
  totalParticipants: number;
  segmentCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  activated: RatioMetric;
  monitoringEnabled: RatioMetric;
  paidConversion: RatioMetric;
  totalHumanHelpInterventions: number;
};

type FeedbackRow = {
  id: string;
  participantId: string;
  category: string;
  usefulness: string | null;
  clarity: string | null;
  difficulty: string | null;
  primaryValue: string | null;
  blockingIssue: string | null;
  purchaseReason: string | null;
  nonPurchaseReason: string | null;
  comment: string | null;
  createdAt: string;
};

type UserSearchResult = { id: string; displayName: string; status: string; planId: string };

function formatRatio(r: RatioMetric): string {
  if (r.denominator === 0) return "0 / 0 — n/a";
  return `${r.numerator} / ${r.denominator} — ${r.percent}%`;
}

const STATUS_TONE: Record<string, "success" | "info" | "warning" | "error"> = {
  draft: "info",
  recruiting: "warning",
  active: "success",
  analysis: "warning",
  completed: "success",
  cancelled: "error",
  invited: "info",
  joined: "info",
  withdrew: "error",
  inactive: "warning",
  disqualified: "error",
};

const SEGMENT_OPTIONS = [
  { value: "individual", label: "Individual" },
  { value: "professional", label: "Professional" },
  { value: "agency", label: "Agency" },
  { value: "multi_site", label: "Multi-site" },
  { value: "other", label: "Other" },
];

/**
 * Phase 17 Super Admin pilot workspace. Every metric is fetched live from
 * `/api/admin/pilots/:id` (derived from `domains`/`subscriptions`, never
 * duplicated) — this component never computes or caches its own numbers.
 */
export function PilotManager() {
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [metrics, setMetrics] = useState<CohortMetrics | null>(null);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [cohortName, setCohortName] = useState("");
  const [cohortDescription, setCohortDescription] = useState("");

  const [addParticipantOpen, setAddParticipantOpen] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [segment, setSegment] = useState<string>("individual");

  async function loadCohorts() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/pilots");
      const body = (await res.json()) as {
        ok: boolean;
        data?: { cohorts: CohortRow[] };
        error?: { message: string };
      };
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setCohorts(body.data?.cohorts ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadCohortDetail(cohortId: string) {
    const res = await fetch(`/api/admin/pilots/${cohortId}`);
    const body = (await res.json()) as {
      ok: boolean;
      data?: { participants: ParticipantRow[]; metrics: CohortMetrics; feedback: FeedbackRow[] };
      error?: { message: string };
    };
    if (!body.ok) {
      setBanner(body.error?.message ?? "Failed to load cohort detail");
      return;
    }
    setParticipants(body.data?.participants ?? []);
    setMetrics(body.data?.metrics ?? null);
    setFeedback(body.data?.feedback ?? []);
  }

  useEffect(() => {
    loadCohorts();
  }, []);

  useEffect(() => {
    if (selectedCohortId) loadCohortDetail(selectedCohortId);
  }, [selectedCohortId]);

  async function createCohort(reason: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/pilots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          name: cohortName,
          description: cohortDescription || undefined,
        }),
      });
      const body = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setBanner("Cohort created (draft status).");
      setCreateOpen(false);
      setCohortName("");
      setCohortDescription("");
      await loadCohorts();
    } catch (err) {
      setBanner((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function setCohortStatus(cohortId: string, status: string, reason: string) {
    const res = await fetch(`/api/admin/pilots/${cohortId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, status }),
    });
    const body = (await res.json()) as { ok: boolean; error?: { message: string } };
    if (!body.ok) {
      setBanner(body.error?.message ?? "Failed to update cohort status");
      return;
    }
    await loadCohorts();
  }

  async function searchUsersForParticipant() {
    if (!userQuery.trim()) return;
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(userQuery)}`);
    const body = (await res.json()) as { ok: boolean; data?: UserSearchResult[] };
    if (body.ok) setUserResults(body.data ?? []);
  }

  async function addParticipant(reason: string) {
    if (!selectedCohortId || !selectedUserId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/pilots/${selectedCohortId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, userId: selectedUserId, segment }),
      });
      const body = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setBanner("Participant added.");
      setAddParticipantOpen(false);
      setUserQuery("");
      setUserResults([]);
      setSelectedUserId(null);
      await loadCohortDetail(selectedCohortId);
    } catch (err) {
      setBanner((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function updateParticipantStatus(participantId: string, status: string) {
    if (!selectedCohortId) return;
    const reason = window.prompt("Reason for this status change (min 3 characters):");
    if (!reason || reason.trim().length < 3) return;
    const res = await fetch(
      `/api/admin/pilots/${selectedCohortId}/participants/${participantId}/status`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, status }),
      },
    );
    const body = (await res.json()) as { ok: boolean; error?: { message: string } };
    if (!body.ok) {
      setBanner(body.error?.message ?? "Failed to update participant status");
      return;
    }
    await loadCohortDetail(selectedCohortId);
  }

  async function removeParticipant(participantId: string) {
    if (!selectedCohortId) return;
    const reason = window.prompt("Reason for removing this participant (min 3 characters):");
    if (!reason || reason.trim().length < 3) return;
    const res = await fetch(
      `/api/admin/pilots/${selectedCohortId}/participants/${participantId}/remove`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      },
    );
    const body = (await res.json()) as { ok: boolean; error?: { message: string } };
    if (!body.ok) {
      setBanner(body.error?.message ?? "Failed to remove participant");
      return;
    }
    await loadCohortDetail(selectedCohortId);
  }

  const cohortColumns: DataTableColumn<CohortRow>[] = [
    {
      key: "name",
      header: "Cohort",
      render: (c) => (
        <button
          type="button"
          className="text-brand-700 underline underline-offset-2"
          onClick={() => setSelectedCohortId(c.id)}
        >
          {c.name}
        </button>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (c) => <StatusChip tone={STATUS_TONE[c.status] ?? "info"} label={c.status} />,
    },
    {
      key: "created",
      header: "Created",
      render: (c) => new Date(c.createdAt).toLocaleDateString(),
      hideBelow: "md",
    },
  ];

  const participantColumns: DataTableColumn<ParticipantRow>[] = [
    {
      key: "userId",
      header: "User ID",
      render: (p) => <span className="font-mono text-caption">{p.userId}</span>,
    },
    { key: "segment", header: "Segment", render: (p) => p.segment.replace("_", " ") },
    {
      key: "status",
      header: "Status",
      render: (p) => (
        <StatusChip
          tone={STATUS_TONE[p.participationStatus] ?? "info"}
          label={p.participationStatus}
        />
      ),
    },
    { key: "help", header: "Human help", render: (p) => p.humanHelpCount, hideBelow: "md" },
    {
      key: "actions",
      header: "",
      render: (p) => (
        <div className="flex gap-3">
          <select
            className="rounded border border-neutral-300 px-1 py-0.5 text-caption"
            value=""
            onChange={(e) => {
              if (e.target.value) updateParticipantStatus(p.id, e.target.value);
            }}
          >
            <option value="">Set status…</option>
            {[
              "invited",
              "joined",
              "active",
              "completed",
              "withdrew",
              "inactive",
              "disqualified",
            ].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="text-caption text-red-700 hover:underline"
            onClick={() => removeParticipant(p.id)}
          >
            Remove
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {banner && <p className="text-supporting text-neutral-700">{banner}</p>}
      <Button className="self-start" onClick={() => setCreateOpen(true)}>
        Create pilot cohort
      </Button>

      <section>
        <h2 className="text-h3 text-neutral-950">Cohorts</h2>
        <div className="mt-3">
          <DataTable
            columns={cohortColumns}
            rows={cohorts}
            getRowKey={(c) => c.id}
            isLoading={isLoading}
            error={error}
            emptyTitle="No pilot cohorts yet"
          />
        </div>
      </section>

      {selectedCohortId && (
        <section className="rounded-card border border-neutral-200 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-h3 text-neutral-950">Cohort detail</h2>
            <div className="flex gap-2">
              {["recruiting", "active", "analysis", "completed", "cancelled"].map((s) => (
                <button
                  key={s}
                  type="button"
                  className="rounded border border-neutral-300 px-2 py-1 text-caption hover:bg-neutral-50"
                  onClick={() => {
                    const reason = window.prompt(
                      `Reason for moving this cohort to "${s}" (min 3 characters):`,
                    );
                    if (reason && reason.trim().length >= 3)
                      setCohortStatus(selectedCohortId, s, reason);
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {metrics && (
            <dl className="mt-4 grid grid-cols-2 gap-4 rounded-card border border-neutral-200 bg-neutral-50 p-4 text-supporting sm:grid-cols-4">
              <div>
                <dt className="text-neutral-500">Participants</dt>
                <dd className="font-medium text-neutral-950">{metrics.totalParticipants}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Activated (saved-domain baseline)</dt>
                <dd className="font-medium text-neutral-950">{formatRatio(metrics.activated)}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Monitoring enabled</dt>
                <dd className="font-medium text-neutral-950">
                  {formatRatio(metrics.monitoringEnabled)}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">Real paid conversion</dt>
                <dd className="font-medium text-neutral-950">
                  {formatRatio(metrics.paidConversion)}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">Human-help interventions</dt>
                <dd className="font-medium text-neutral-950">
                  {metrics.totalHumanHelpInterventions}
                </dd>
              </div>
            </dl>
          )}

          <Button className="mt-4" variant="secondary" onClick={() => setAddParticipantOpen(true)}>
            Add participant
          </Button>

          <div className="mt-4">
            <DataTable
              columns={participantColumns}
              rows={participants}
              getRowKey={(p) => p.id}
              isLoading={false}
              emptyTitle="No participants yet"
            />
          </div>

          <h3 className="mt-6 text-card-heading text-neutral-950">Feedback ({feedback.length})</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {feedback.map((f) => (
              <li key={f.id} className="rounded-card border border-neutral-200 p-3 text-supporting">
                <p className="text-caption text-neutral-500">
                  {new Date(f.createdAt).toLocaleString()} · {f.category.replace(/_/g, " ")}
                </p>
                {f.comment && <p className="mt-1 text-neutral-800">{f.comment}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <AdminActionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create a pilot cohort"
        description="Starts in draft status. No entitlement is ever granted by cohort or participant membership."
        confirmLabel="Create cohort"
        busy={busy}
        onConfirm={createCohort}
      >
        <div className="mb-4 flex flex-col gap-3">
          <FormField label="Cohort name">
            <Input
              value={cohortName}
              onChange={(e) => setCohortName(e.target.value)}
              placeholder="e.g. Pilot wave 1"
            />
          </FormField>
          <FormField label="Description (optional)">
            <Textarea
              value={cohortDescription}
              onChange={(e) => setCohortDescription(e.target.value)}
              rows={3}
            />
          </FormField>
        </div>
      </AdminActionDialog>

      <AdminActionDialog
        open={addParticipantOpen}
        onOpenChange={setAddParticipantOpen}
        title="Add a pilot participant"
        description="Associates an existing CrawlPact user with this cohort. This repository has no email field — search by user ID, display name, or a domain they own."
        confirmLabel="Add participant"
        busy={busy}
        onConfirm={addParticipant}
      >
        <div className="mb-4 flex flex-col gap-3">
          <FormField label="Search users">
            <Input
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchUsersForParticipant()}
              placeholder="ID, display name, or domain"
            />
          </FormField>
          <Button variant="secondary" onClick={searchUsersForParticipant}>
            Search
          </Button>
          {userResults.length > 0 && (
            <ul className="flex flex-col gap-1">
              {userResults.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    className={`w-full rounded border px-2 py-1 text-left text-supporting ${selectedUserId === u.id ? "border-brand-600 bg-brand-50" : "border-neutral-200"}`}
                    onClick={() => setSelectedUserId(u.id)}
                  >
                    {u.displayName} — {u.planId} ({u.id})
                  </button>
                </li>
              ))}
            </ul>
          )}
          <FormField label="Segment">
            <Select value={segment} onValueChange={setSegment} options={SEGMENT_OPTIONS} />
          </FormField>
        </div>
      </AdminActionDialog>
    </div>
  );
}
