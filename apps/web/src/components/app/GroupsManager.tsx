import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  Alert,
  Button,
  EmptyState,
  FormField,
  Input,
  Modal,
  Select,
  Textarea,
} from "@crawlpact/ui";

type Group = {
  groupId: string;
  name: string;
  description: string | null;
  domainCount: number;
  createdAt: string;
};

async function fetchJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url);
  const body = (await response.json()) as { ok: boolean; data?: T };
  return body.ok ? (body.data ?? null) : null;
}

export function GroupsManager() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<Record<string, string>>({});

  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const [destinationGroupId, setDestinationGroupId] = useState<string>("");
  const [deleteBusy, setDeleteBusy] = useState(false);

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
        body: JSON.stringify({ name, description: description.trim() || undefined }),
      });
      const body = (await response.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) {
        setError(body.error?.message ?? "Could not create this group.");
        return;
      }
      setName("");
      setDescription("");
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

  function openDeleteDialog(group: Group) {
    setError(null);
    setDestinationGroupId("");
    setDeleteTarget(group);
  }

  async function confirmDelete() {
    if (!deleteTarget || deleteBusy) return;
    setDeleteBusy(true);
    try {
      const response = await fetch(`/api/groups/${deleteTarget.groupId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinationGroupId: destinationGroupId || null }),
      });
      const body = (await response.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) {
        setError(body.error?.message ?? "Could not delete this group.");
        return;
      }
      setDeleteTarget(null);
      await refresh();
    } finally {
      setDeleteBusy(false);
    }
  }

  const destinationOptions = (groups ?? [])
    .filter((g) => g.groupId !== deleteTarget?.groupId)
    .map((g) => ({ value: g.groupId, label: g.name }));

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleCreate}
        className="flex flex-col gap-3 rounded-card border border-neutral-200 bg-white p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <FormField label="Group name">
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </FormField>
          </div>
          <Button type="submit" isLoading={busy} disabled={name.trim().length === 0}>
            Create group
          </Button>
        </div>
        <FormField
          label="Internal note"
          description="Optional, private to your account — never shown to clients or included in exports."
        >
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={500}
          />
        </FormField>
      </form>

      {error && !deleteTarget && (
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
                aria-label={`Group name for ${group.name}`}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleRename(group.groupId)}
              >
                Save name
              </Button>
              <a
                href={`/app/groups/${group.groupId}`}
                className="text-supporting font-medium text-brand-700 underline"
              >
                View
              </a>
              <span className="text-supporting text-neutral-600">
                {group.domainCount} domain{group.domainCount === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                className="ml-auto text-supporting font-medium text-error underline"
                onClick={() => openDeleteDialog(group)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={deleteTarget !== null}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.name}"?`}
        description={
          deleteTarget && deleteTarget.domainCount > 0
            ? `${deleteTarget.domainCount} domain${deleteTarget.domainCount === 1 ? "" : "s"} in this group will be moved — the domains, their history, and their monitoring state are not affected.`
            : "This group has no domains in it."
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleteBusy}>
              Cancel
            </Button>
            <Button isLoading={deleteBusy} onClick={() => void confirmDelete()}>
              Delete group
            </Button>
          </>
        }
      >
        {error && (
          <Alert tone="error" title="Could not delete this group">
            {error}
          </Alert>
        )}
        {deleteTarget && deleteTarget.domainCount > 0 && (
          <FormField label="Move domains to" description="Leave blank to move them to Ungrouped.">
            <Select
              value={destinationGroupId}
              onValueChange={setDestinationGroupId}
              placeholder="Ungrouped"
              options={destinationOptions}
            />
          </FormField>
        )}
      </Modal>
    </div>
  );
}
