import { useState } from "react";
import { Alert, Button, Card, StatusChip, Textarea } from "@crawlpact/ui";
import { AdminActionDialog } from "./AdminActionDialog";

type UserDetail = {
  user: {
    id: string;
    displayName: string;
    status: "active" | "suspended" | "pending_deletion";
    planId: string;
    isAdmin: boolean;
    createdAt: string;
    deletionRequestedAt: string | null;
  };
  passkeyCount: number;
  activeSessionCount: number;
  savedDomainCount: number;
  monitoredDomainCount: number;
  manualScansThisMonth: number;
  billingCustomer: { paddleCustomerId: string } | null;
  subscription: { status: string; paddleSubscriptionId: string; planId: string } | null;
  domains: {
    id: string;
    canonicalOrigin: string;
    monitoringState: string;
    currentScore: number | null;
  }[];
  recentNotifications: { id: string; title: string; createdAt: string }[];
  internalNotes: { note: { note: string; createdAt: string }; authorName: string | null }[];
};

type ActionKind =
  | "suspend"
  | "restore"
  | "revoke-sessions"
  | "pause-monitoring"
  | "revoke-feed-tokens"
  | "revoke-shared-reports"
  | "begin-deletion"
  | "cancel-deletion";

const ACTION_CONFIG: Record<
  ActionKind,
  { title: string; description: string; confirmLabel: string; destructive?: boolean }
> = {
  suspend: {
    title: "Suspend this account",
    description: "Immediately revokes all sessions and blocks sign-in until restored.",
    confirmLabel: "Suspend account",
    destructive: true,
  },
  restore: {
    title: "Restore this account",
    description: "Allows sign-in again.",
    confirmLabel: "Restore account",
  },
  "revoke-sessions": {
    title: "Revoke all sessions",
    description: "Signs this user out everywhere immediately.",
    confirmLabel: "Revoke sessions",
    destructive: true,
  },
  "pause-monitoring": {
    title: "Pause monitoring",
    description: "Pauses scheduled monitoring on every domain this user owns.",
    confirmLabel: "Pause monitoring",
  },
  "revoke-feed-tokens": {
    title: "Revoke Atom feed tokens",
    description: "Invalidates this user's private notification feed URL.",
    confirmLabel: "Revoke feed tokens",
    destructive: true,
  },
  "revoke-shared-reports": {
    title: "Revoke shared reports",
    description: "Invalidates every public share link this user has created.",
    confirmLabel: "Revoke shared reports",
    destructive: true,
  },
  "begin-deletion": {
    title: "Begin account deletion",
    description: "Starts the standard 30-day cancellable deletion grace period.",
    confirmLabel: "Begin deletion",
    destructive: true,
  },
  "cancel-deletion": {
    title: "Cancel pending deletion",
    description: "Restores the account to active status.",
    confirmLabel: "Cancel deletion",
  },
};

const ACTION_ENDPOINT: Record<ActionKind, string> = {
  suspend: "suspend",
  restore: "restore",
  "revoke-sessions": "revoke-sessions",
  "pause-monitoring": "pause-monitoring",
  "revoke-feed-tokens": "revoke-feed-tokens",
  "revoke-shared-reports": "revoke-shared-reports",
  "begin-deletion": "begin-deletion",
  "cancel-deletion": "cancel-deletion",
};

export function UserDetailManager({ initial }: { initial: UserDetail }) {
  const [detail, setDetail] = useState(initial);
  const [activeAction, setActiveAction] = useState<ActionKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [note, setNote] = useState("");

  async function readBody<T>(
    res: Response,
  ): Promise<{ ok: boolean; data?: T; error?: { message: string } }> {
    return res.json() as Promise<{ ok: boolean; data?: T; error?: { message: string } }>;
  }

  async function refresh() {
    const res = await fetch(`/api/admin/users/${detail.user.id}`);
    const body = await readBody<UserDetail>(res);
    if (body.ok && body.data) setDetail(body.data);
  }

  async function runAction(action: ActionKind, reason: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${detail.user.id}/${ACTION_ENDPOINT[action]}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = await readBody<unknown>(res);
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setBanner({ tone: "success", message: `${ACTION_CONFIG[action].confirmLabel} succeeded.` });
      setActiveAction(null);
      await refresh();
    } catch (err) {
      setBanner({ tone: "error", message: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function submitNote() {
    if (note.trim().length < 3) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${detail.user.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() }),
      });
      const body = await readBody<unknown>(res);
      if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
      setNote("");
      await refresh();
    } catch (err) {
      setBanner({ tone: "error", message: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const u = detail.user;

  return (
    <div className="flex flex-col gap-6">
      {banner && (
        <Alert
          tone={banner.tone}
          title={banner.tone === "success" ? "Done" : "Something went wrong"}
        >
          {banner.message}
        </Alert>
      )}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-h3 text-neutral-950">{u.displayName}</h2>
            <p className="mt-1 font-mono text-supporting text-neutral-600">{u.id}</p>
            <p className="mt-1 text-supporting text-neutral-600">
              Created {new Date(u.createdAt).toLocaleDateString()} · Plan {u.planId}
            </p>
          </div>
          <StatusChip
            tone={
              u.status === "active" ? "success" : u.status === "suspended" ? "error" : "warning"
            }
            label={u.status.replace("_", " ")}
          />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricTile label="Passkeys" value={detail.passkeyCount} />
        <MetricTile label="Active sessions" value={detail.activeSessionCount} />
        <MetricTile label="Saved domains" value={detail.savedDomainCount} />
        <MetricTile label="Monitored domains" value={detail.monitoredDomainCount} />
        <MetricTile label="Manual scans this month" value={detail.manualScansThisMonth} />
        <MetricTile
          label="Subscription"
          value={detail.subscription ? detail.subscription.status : "none"}
        />
      </div>

      <section>
        <h3 className="text-h3 text-neutral-950">Controlled actions</h3>
        <p className="mt-1 text-supporting text-neutral-600">
          Every action requires a reason and is recorded in the audit log.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {u.status === "active" && (
            <Button variant="destructive" onClick={() => setActiveAction("suspend")}>
              Suspend
            </Button>
          )}
          {u.status === "suspended" && (
            <Button onClick={() => setActiveAction("restore")}>Restore</Button>
          )}
          <Button variant="secondary" onClick={() => setActiveAction("revoke-sessions")}>
            Revoke sessions
          </Button>
          <Button variant="secondary" onClick={() => setActiveAction("pause-monitoring")}>
            Pause monitoring
          </Button>
          <Button variant="secondary" onClick={() => setActiveAction("revoke-feed-tokens")}>
            Revoke feed tokens
          </Button>
          <Button variant="secondary" onClick={() => setActiveAction("revoke-shared-reports")}>
            Revoke shared reports
          </Button>
          {u.status !== "pending_deletion" && (
            <Button variant="destructive" onClick={() => setActiveAction("begin-deletion")}>
              Begin deletion
            </Button>
          )}
          {u.status === "pending_deletion" && (
            <Button onClick={() => setActiveAction("cancel-deletion")}>Cancel deletion</Button>
          )}
        </div>
      </section>

      <section>
        <h3 className="text-h3 text-neutral-950">Saved domains ({detail.domains.length})</h3>
        <ul className="mt-3 divide-y divide-neutral-200 rounded-card border border-neutral-200 bg-white">
          {detail.domains.length === 0 && (
            <li className="p-4 text-supporting text-neutral-600">None.</li>
          )}
          {detail.domains.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="text-body text-neutral-800">{d.canonicalOrigin}</span>
              <span className="text-supporting text-neutral-600">
                {d.monitoringState} · score {d.currentScore ?? "—"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-h3 text-neutral-950">Internal notes</h3>
        <div className="mt-3 flex flex-col gap-3">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add an internal note visible only to administrators…"
            rows={2}
          />
          <Button
            onClick={submitNote}
            disabled={note.trim().length < 3 || busy}
            className="self-start"
          >
            Add note
          </Button>
        </div>
        <ul className="mt-4 flex flex-col gap-3">
          {detail.internalNotes.length === 0 && (
            <li className="text-supporting text-neutral-600">No notes yet.</li>
          )}
          {detail.internalNotes.map((n, i) => (
            <li key={i} className="rounded-card border border-neutral-200 bg-white p-3">
              <p className="text-body text-neutral-800">{n.note.note}</p>
              <p className="mt-1 text-supporting text-neutral-500">
                {n.authorName ?? "Unknown"} · {new Date(n.note.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {(Object.keys(ACTION_CONFIG) as ActionKind[]).map((action) => (
        <AdminActionDialog
          key={action}
          open={activeAction === action}
          onOpenChange={(open) => setActiveAction(open ? action : null)}
          title={ACTION_CONFIG[action].title}
          description={ACTION_CONFIG[action].description}
          confirmLabel={ACTION_CONFIG[action].confirmLabel}
          destructive={ACTION_CONFIG[action].destructive}
          busy={busy}
          onConfirm={(reason) => runAction(action, reason)}
        />
      ))}
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-card border border-neutral-200 bg-white p-4">
      <p className="text-supporting text-neutral-600">{label}</p>
      <p className="mt-1 text-h3 text-neutral-950">{value}</p>
    </div>
  );
}
