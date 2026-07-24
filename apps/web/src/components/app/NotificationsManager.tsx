import { useEffect, useState } from "react";
import { Alert, Button, EmptyState, StatusChip } from "@crawlpact/ui";

type NotificationItem = {
  notificationId: string;
  type: string;
  title: string;
  body: string;
  domainId: string | null;
  isRead: boolean;
  createdAt: string;
  groupCount?: number;
};

const TYPE_TONE: Record<string, "error" | "warning" | "info" | "success"> = {
  critical_policy_change: "error",
  high_severity_policy_change: "warning",
  registry_drift: "warning",
  resource_failure: "warning",
  monitoring_paused: "error",
  new_crawler: "info",
  crawler_purpose_change: "info",
  subscription_issue: "error",
  shared_report_expiry: "info",
  platform_notice: "info",
};

async function fetchJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url);
  const body = (await response.json()) as { ok: boolean; data?: T };
  return body.ok ? (body.data ?? null) : null;
}

export function NotificationsManager() {
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [feedBusy, setFeedBusy] = useState(false);

  async function refresh() {
    const result = await fetchJson<{ items: NotificationItem[] }>("/api/notifications");
    setItems(result?.items ?? []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleMarkRead(id: string) {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationIds: [id] }),
    });
    await refresh();
  }

  async function handleMarkAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    await refresh();
  }

  async function handleGenerateFeed() {
    setFeedBusy(true);
    setFeedError(null);
    try {
      const response = await fetch("/api/notifications/feed-token", { method: "POST" });
      const body = (await response.json()) as {
        ok: boolean;
        data?: { feedUrl: string };
        error?: { message: string };
      };
      if (!body.ok || !body.data) {
        setFeedError(body.error?.message ?? "Could not create a feed URL.");
        return;
      }
      setFeedUrl(body.data.feedUrl);
    } finally {
      setFeedBusy(false);
    }
  }

  async function handleRevokeFeed() {
    await fetch("/api/notifications/feed-token", { method: "DELETE" });
    setFeedUrl(null);
  }

  const hasUnread = items?.some((item) => !item.isRead) ?? false;

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-h2 text-neutral-950">Notifications</h2>
          {hasUnread && (
            <Button variant="secondary" size="sm" onClick={() => void handleMarkAllRead()}>
              Mark all as read
            </Button>
          )}
        </div>

        {items === null ? null : items.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No notifications yet"
              description="Material AI crawler policy changes, monitoring failures, and other account events show up here."
            />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-neutral-200 rounded-card border border-neutral-200 bg-white">
            {items.map((item) => (
              <li
                key={item.notificationId}
                className={`flex items-start justify-between gap-4 px-4 py-3 ${item.isRead ? "" : "bg-brand-50/40"}`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <StatusChip
                      tone={TYPE_TONE[item.type] ?? "info"}
                      label={item.type.replace(/_/g, " ")}
                    />
                    {item.groupCount && item.groupCount > 1 && (
                      <span className="text-supporting text-neutral-500">×{item.groupCount}</span>
                    )}
                  </div>
                  <p className="mt-1 text-body font-medium text-neutral-900">{item.title}</p>
                  <p className="text-supporting text-neutral-600">{item.body}</p>
                  <div className="mt-1 flex items-center gap-3 text-supporting text-neutral-500">
                    <span>{new Date(item.createdAt).toLocaleString()}</span>
                    {item.domainId && (
                      <a
                        href={`/app/domains/${item.domainId}`}
                        className="text-brand-700 underline"
                      >
                        View domain
                      </a>
                    )}
                  </div>
                </div>
                {!item.isRead && (
                  <button
                    type="button"
                    className="shrink-0 text-supporting font-medium text-brand-700 underline"
                    onClick={() => void handleMarkRead(item.notificationId)}
                  >
                    Mark read
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-h2 text-neutral-950">Private Atom feed</h2>
        <p className="mt-2 text-body text-neutral-700">
          Get notifications in your feed reader instead of (or alongside) the in-app centre above.
          Anyone with this URL can read your notifications — keep it private, and revoke it if it
          leaks.
        </p>
        {feedError && (
          <div className="mt-3">
            <Alert tone="error" title="That didn't work">
              {feedError}
            </Alert>
          </div>
        )}
        {feedUrl && (
          <div className="mt-3">
            <Alert tone="warning" title="Save this URL now">
              It won't be shown again until you regenerate it.
            </Alert>
            <pre className="mt-2 overflow-x-auto rounded-card border border-neutral-300 bg-neutral-50 p-3 text-supporting">
              {feedUrl}
            </pre>
          </div>
        )}
        <div className="mt-3 flex gap-3">
          <Button isLoading={feedBusy} onClick={() => void handleGenerateFeed()}>
            {feedUrl ? "Regenerate feed URL" : "Create feed URL"}
          </Button>
          <Button variant="secondary" onClick={() => void handleRevokeFeed()}>
            Revoke
          </Button>
        </div>
      </section>
    </div>
  );
}
