import { useEffect, useState } from "react";

export function NotificationBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await fetch("/api/notifications/unread-count");
      const body = (await response.json()) as { ok: boolean; data?: { count: number } };
      if (!cancelled && body.ok && body.data) setCount(body.data.count);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (count === 0) return null;

  return (
    <span className="ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-pill bg-error px-1.5 py-0.5 text-metadata font-medium text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}
