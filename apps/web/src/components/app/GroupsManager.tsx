import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Alert, Button, EmptyState, FormField, Input } from "@crawlpact/ui";

type Group = { groupId: string; name: string; domainCount: number; createdAt: string };

async function fetchJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url);
  const body = (await response.json()) as { ok: boolean; data?: T };
  return body.ok ? (body.data ?? null) : null;
}

export function GroupsManager() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<Record<string, string>>({});

  async function refresh() {
    setGroups((await fetchJson<Group[]>("/api/groups")) ?? []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = (await response.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) {
        setError(body.error?.message ?? "Could not create this group.");
        return;
      }
      setName("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(groupId: string) {
    const newName = renaming[groupId]?.trim();
    if (!newName) return;
    await fetch(`/api/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    await refresh();
  }

  async function handleDelete(groupId: string) {
    setError(null);
    const response = await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
    const body = (await response.json()) as { ok: boolean; error?: { message: string } };
    if (!body.ok) {
      setError(body.error?.message ?? "Could not delete this group.");
      return;
    }
    await refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleCreate}
        className="flex flex-col gap-3 rounded-card border border-neutral-200 bg-white p-5 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <FormField label="Group name">
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </FormField>
        </div>
        <Button type="submit" isLoading={busy} disabled={name.trim().length === 0}>
          Create group
        </Button>
      </form>

      {error && (
        <Alert tone="error" title="That didn't work">
          {error}
        </Alert>
      )}

      {groups === null ? null : groups.length === 0 ? (
        <EmptyState
          title="No groups yet"
          description="Groups let you organise saved domains — useful when managing several clients or brands."
        />
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-card border border-neutral-200 bg-white">
          {groups.map((group) => (
            <li key={group.groupId} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Input
                value={renaming[group.groupId] ?? group.name}
                onChange={(e) =>
                  setRenaming((prev) => ({ ...prev, [group.groupId]: e.target.value }))
                }
                className="max-w-xs"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleRename(group.groupId)}
              >
                Save name
              </Button>
              <span className="text-supporting text-neutral-600">
                {group.domainCount} domain{group.domainCount === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                className="ml-auto text-supporting font-medium text-error underline"
                onClick={() => void handleDelete(group.groupId)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
