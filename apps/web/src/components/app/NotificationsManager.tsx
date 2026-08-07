import { useEffect, useState } from "react";
import { Alert, Button, EmptyState, StatusChip } from "@crawlpact/ui";
import { track } from "../../lib/analytics-client";

type NotificationItem = {
  notificationId: string;
  type: string;
  title: string;
  body: string;
  domainId: string | null;
  isRead: boolean;
  createdAt: string;
  groupCount?: number;
  category?: string;
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

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All categories" },
  { value: "policy_changes", label: "Policy changes" },
  { value: "crawler_registry", label: "Crawler registry" },
  { value: "monitoring_health", label: "Monitoring health" },
  { value: "billing_and_account", label: "Billing and account" },
  { value: "report_sharing", label: "Report sharing" },
  { value: "platform_notices", label: "Platform notices" },
];

async function fetchJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url);
  const body = (await response.json()) as { ok: boolean; data?: T };
  return body.ok ? (body.data ?? null) : null;
}

export function NotificationsManager() {
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [category, setCategory] = useState("");
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [feedBusy, setFeedBusy] = useState(false);

  function buildQuery(cursor?: string): string {
    const params = new URLSearchParams();
    if (unreadOnly) params.set("unreadOnly", "true");
    if (category) params.set("category", category);
    if (cursor) params.set("cursor", cursor);
    const query = params.toString();
    return query ? `/api/notifications?${query}` : "/api/notifications";
  }

  async function refresh() {
    const result = await fetchJson<{ items: NotificationItem[]; nextCursor: string | null }>(
      buildQuery(),
    );
    setItems(result?.items ?? []);
    setNextCursor(result?.nextCursor ?? null);
  }

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const result = await fetchJson<{ items: NotificationItem[]; nextCursor: string | null }>(
        buildQuery(nextCursor),
      );
      setItems((current) => [...(current ?? []), ...(result?.items ?? [])]);
      setNextCursor(result?.nextCursor ?? null);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void refresh();
    track("notifications_viewed");
  }, [unreadOnly, category]);

  async function handleMarkRead(id: string) {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationIds: [id] }),
    });
    track("notification_marked_read");
    await refresh();
  }

  async function handleMarkAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    track("notifications_marked_all_read");
    await refresh();
  }

  function handleFilterChange(next: { unreadOnly?: boolean; category?: string }) {
    if (next.unreadOnly !== undefined) setUnreadOnly(next.unreadOnly);
    if (next.category !== undefined) setCategory(next.category);
    track("notification_filter_applied", {
      unreadOnly: next.unreadOnly ?? unreadOnly,
      category: next.category ?? category ?? "all",
    });
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
      <section aria-labelledby="notifications-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="notifications-heading" className="text-h2 text-neutral-950">
            Notifications
          </h2>
          {hasUnread && (
            <Button variant="secondary" size="sm" onClick={() => void handleMarkAllRead()}>
              Mark all as read
            </Button>
          )}
        </div>

        <form
          className="mt-4 flex flex-wrap items-end gap-4"
          aria-label="Filter notifications"
          onSubmit={(event) => event.preventDefault()}
        >
          <label className="flex items-center gap-2 text-supporting text-neutral-700">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(event) => handleFilterChange({ unreadOnly: event.target.checked })}
            />
            Unread only
          </label>
          <label className="flex flex-col gap-1 text-supporting text-neutral-700">
            Category
            <select
              className="rounded-input border border-neutral-300 px-2 py-1"
              value={category}
              onChange={(event) => handleFilterChange({ category: event.target.value })}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </form>

        <div role="status" aria-live="polite" className="sr-only">
          {items === null
            ? "Loading notifications"
            : `${items.length} notification${items.length === 1 ? "" : "s"} shown`}
        </div>

        {items === null ? null : items.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No notifications yet"
              description="Material AI crawler policy changes, monitoring failures, and other account events show up here."
            />
          </div>
        ) : (
          <>
            <ul
              className="mt-4 divide-y divide-neutral-200 rounded-card border border-neutral-200 bg-white"
              aria-label="Notification list"
            >
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
                      <span className="text-supporting text-neutral-500">
                        {item.isRead ? "Read" : "Unread"}
                      </span>
                      {item.groupCount && item.groupCount > 1 && (
                        <span className="text-supporting text-neutral-500">
                          {item.groupCount} occurrences
                        </span>
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
                          onClick={() => track("notification_deep_link_opened")}
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
                      aria-label={`Mark "${item.title}" as read`}
                      onClick={() => void handleMarkRead(item.notificationId)}
                    >
                      Mark read
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {nextCursor && (
              <div className="mt-4 flex justify-center">
                <Button variant="secondary" isLoading={loadingMore} onClick={() => void loadMore()}>
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="atom-feed-heading">
        <h2 id="atom-feed-heading" className="text-h2 text-neutral-950">
          Private Atom feed
        </h2>
        <p className="mt-2 text-body text-neutral-700">
          Get notifications in your feed reader instead of (or alongside) the in-app centre above.
          Anyone with this URL can read your notifications — keep it private, and revoke it if it
          leaks.
        </p>
        {feedError && (
          <div className="mt-3" role="alert">
            <Alert tone="error" title="That didn't work">
              {feedError}
            </Alert>
          </div>
        )}
        {feedUrl && (
          <div className="mt-3">
            <Alert tone="warning" title="Save this URL now">
              Regenerating the feed URL immediately invalidates the previous one, and it won't be
              shown again until you regenerate it.
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
