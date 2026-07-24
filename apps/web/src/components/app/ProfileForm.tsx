import { useState } from "react";
import type { FormEvent } from "react";
import { Button, FormField, Input } from "@crawlpact/ui";

export function ProfileForm({ initialDisplayName }: { initialDisplayName: string }) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setSaved(false);
    try {
      await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <FormField label="Display name">
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            maxLength={80}
          />
        </FormField>
      </div>
      <Button type="submit" isLoading={busy} disabled={displayName.trim().length === 0}>
        Save
      </Button>
      {saved && <span className="text-supporting text-success">Saved</span>}
    </form>
  );
}
