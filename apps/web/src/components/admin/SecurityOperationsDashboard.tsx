import { useEffect, useState } from "react";
import { DataTable, Select, StatusChip } from "@crawlpact/ui";
import type { DataTableColumn } from "@crawlpact/ui";
import { AdminActionDialog } from "./AdminActionDialog";

type SecurityEventRow = {
  event: {
    id: number;
    eventType: string;
    userId: string | null;
    ipHash: string | null;
    target: string | null;
    details: string | null;
    createdAt: string;
    resolvedAt: string | null;
    resolutionNote: string | null;
  };
  user: { displayName: string | null } | null;
};

const EVENT_TYPES = [
  { value: "any", label: "All event types" },
  { value: "unsafe_scan_attempt", label: "Unsafe scan attempt" },
  { value: "rate_limit", label: "Rate limit" },
  { value: "auth_failure", label: "Authentication failure" },
  { value: "recovery_code_failure", label: "Recovery code failure" },
  { value: "suspicious_session", label: "Suspicious session" },
  { value: "invalid_paddle_signature", label: "Invalid Paddle signature" },
  { value: "replayed_webhook", label: "Replayed webhook" },
  { value: "admin_security_action", label: "Administrator security action" },
];

/** SRS §28.14: security dashboard + event resolution. Suspend/block/revoke
 * actions themselves live on the user-detail and blocked-targets pages
 * (Steps 3/6) — this view is the triage surface that links out to them. */
export function SecurityOperationsDashboard() {
  const [events, setEvents] = useState<SecurityEventRow[]>([]);
  const [highVolumeAccounts, setHighVolumeAccounts] = useState<
    { userId: string; displayName: string; scanCount: number }[]
  >([]);
  const [frequentHosts, setFrequentHosts] = useState<{ canonicalOrigin: string; count: number }[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [eventType, setEventType] = useState("any");
  const [unresolvedOnly, setUnresolvedOnly] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (eventType !== "any") params.set("eventType", eventType);
    if (unresolvedOnly) params.set("unresolvedOnly", "true");
    try {
      const res = await fetch(`/api/admin/security?${params.toString()}`);
      const body = (await res.json()) as {
        ok: boolean;
        data?: {
          events: SecurityEventRow[];
          highVolumeAccounts: { userId: string; displayName: string; scanCount: number }[];
          frequentlyScannedHosts: { canonicalOrigin: string; count: number }[];
        };
        error?: { message: string };
      };
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setEvents(body.data!.events);
      setHighVolumeAccounts(body.data!.highVolumeAccounts);
      setFrequentHosts(body.data!.frequentlyScannedHosts);
      setError(undefined);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [eventType, unresolvedOnly]);

  async function resolve(note: string) {
    if (resolveTarget === null) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/security/${resolveTarget}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const body = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setBanner("Marked resolved.");
      setResolveTarget(null);
      await load();
    } catch (err) {
      setBanner((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const columns: DataTableColumn<SecurityEventRow>[] = [
    { key: "type", header: "Event", render: (r) => r.event.eventType.replace(/_/g, " ") },
    {
      key: "user",
      header: "User",
      render: (r) => (r.user?.displayName ? r.user.displayName : "—"),
      hideBelow: "sm",
    },
    { key: "target", header: "Target", render: (r) => r.event.target ?? "—", hideBelow: "md" },
    { key: "created", header: "When", render: (r) => new Date(r.event.createdAt).toLocaleString() },
    {
      key: "status",
      header: "Status",
      render: (r) =>
        r.event.resolvedAt ? (
          <StatusChip tone="success" label="Resolved" />
        ) : (
          <StatusChip tone="warning" label="Open" />
        ),
    },
    {
      key: "actions",
      header: "",
      render: (r) =>
        !r.event.resolvedAt && (
          <button
            type="button"
            className="text-supporting font-medium text-brand-700 hover:underline"
            onClick={() => setResolveTarget(r.event.id)}
          >
            Resolve
          </button>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {banner && <p className="text-supporting text-neutral-700">{banner}</p>}

      <section>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-64">
            <Select options={EVENT_TYPES} value={eventType} onValueChange={setEventType} />
          </div>
          <label className="flex items-center gap-2 text-supporting text-neutral-700">
            <input
              type="checkbox"
              checked={unresolvedOnly}
              onChange={(e) => setUnresolvedOnly(e.target.checked)}
            />
            Unresolved only
          </label>
        </div>
        <div className="mt-4">
          <DataTable
            columns={columns}
            rows={events}
            getRowKey={(r) => String(r.event.id)}
            isLoading={isLoading}
            error={error}
            emptyTitle="No security events recorded"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <section>
          <h2 className="text-h3 text-neutral-950">High-volume accounts (30d)</h2>
          <ul className="mt-3 divide-y divide-neutral-200 rounded-card border border-neutral-200 bg-white">
            {highVolumeAccounts.length === 0 && (
              <li className="p-4 text-supporting text-neutral-600">None.</li>
            )}
            {highVolumeAccounts.map((a) => (
              <li key={a.userId} className="flex items-center justify-between gap-4 px-4 py-3">
                <a
                  href={`/admin/users/${a.userId}`}
                  className="text-body text-brand-700 hover:underline"
                >
                  {a.displayName}
                </a>
                <span className="text-supporting text-neutral-600">{a.scanCount} scans</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-h3 text-neutral-950">Frequently scanned hosts (30d)</h2>
          <ul className="mt-3 divide-y divide-neutral-200 rounded-card border border-neutral-200 bg-white">
            {frequentHosts.length === 0 && (
              <li className="p-4 text-supporting text-neutral-600">None.</li>
            )}
            {frequentHosts.map((h) => (
              <li
                key={h.canonicalOrigin}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <span className="text-body text-neutral-800">{h.canonicalOrigin}</span>
                <span className="text-supporting text-neutral-600">{h.count} scans</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <AdminActionDialog
        open={resolveTarget !== null}
        onOpenChange={(open) => !open && setResolveTarget(null)}
        title="Resolve this security event"
        description="Marks the event as reviewed. The original event record is never modified or deleted."
        confirmLabel="Mark resolved"
        busy={busy}
        onConfirm={resolve}
      />
    </div>
  );
}
