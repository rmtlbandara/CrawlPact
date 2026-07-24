import { useEffect, useState } from "react";
import { Button, StatusChip } from "@crawlpact/ui";

type SessionSummary = {
  sessionId: string;
  createdAt: string;
  lastSeenAt: string;
  userAgent: string | null;
  isCurrent: boolean;
};

export function SessionsManager() {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);

  async function refresh() {
    const response = await fetch("/api/auth/sessions");
    const body = (await response.json()) as { ok: boolean; data?: SessionSummary[] };
    setSessions(body.ok ? (body.data ?? []) : []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleRevoke(sessionId: string) {
    await fetch(`/api/auth/sessions/${sessionId}/revoke`, { method: "POST" });
    await refresh();
  }

  async function handleRevokeAll() {
    await fetch("/api/auth/sessions/revoke-all", { method: "POST" });
    window.location.href = "/sign-in";
  }

  return (
    <div className="flex flex-col gap-4">
      {sessions && sessions.length > 0 && (
        <ul className="divide-y divide-neutral-200 rounded-card border border-neutral-200 bg-white">
          {sessions.map((session) => (
            <li
              key={session.sessionId}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="text-body text-neutral-900">
                  {session.userAgent ?? "Unknown device"}
                </p>
                <p className="text-supporting text-neutral-600">
                  Last active {new Date(session.lastSeenAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {session.isCurrent && <StatusChip tone="info" label="This device" />}
                {!session.isCurrent && (
                  <button
                    type="button"
                    className="text-supporting font-medium text-error underline"
                    onClick={() => void handleRevoke(session.sessionId)}
                  >
                    Sign out
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Button variant="destructive" className="self-start" onClick={() => void handleRevokeAll()}>
        Sign out of all sessions
      </Button>
    </div>
  );
}
