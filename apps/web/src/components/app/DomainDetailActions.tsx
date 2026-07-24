import { useState } from "react";
import { Alert, Button, ConfirmDialog, FormField, Select, Switch, Textarea } from "@crawlpact/ui";

const PRESET_OPTIONS = [
  { value: "maximum_ai_visibility", label: "Maximum AI visibility" },
  { value: "allow_search_block_training", label: "Allow search, block training" },
  { value: "publisher_protection", label: "Publisher protection" },
  { value: "block_known_ai_crawlers", label: "Block known AI crawlers" },
];

export type DomainDetailActionsProps = {
  domainId: string;
  preset: string;
  monitoringState: "active" | "paused";
  notes: string | null;
};

export function DomainDetailActions({
  domainId,
  preset: initialPreset,
  monitoringState: initialMonitoringState,
  notes: initialNotes,
}: DomainDetailActionsProps) {
  const [preset, setPreset] = useState(initialPreset);
  const [monitoringState, setMonitoringState] = useState(initialMonitoringState);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [rescanning, setRescanning] = useState(false);
  const [rescanMessage, setRescanMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function patch(body: Record<string, unknown>) {
    await fetch(`/api/domains/${domainId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function handlePresetChange(value: string) {
    setPreset(value);
    await patch({ preset: value });
    window.location.reload();
  }

  async function handleMonitoringToggle() {
    const next = monitoringState === "active" ? "paused" : "active";
    setMonitoringState(next);
    await patch({ monitoringState: next });
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    try {
      await patch({ notes: notes.trim().length === 0 ? null : notes });
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleRescan() {
    setRescanning(true);
    setRescanMessage(null);
    try {
      const response = await fetch(`/api/domains/${domainId}/scan`, { method: "POST" });
      const body = (await response.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) {
        setRescanMessage({
          tone: "error",
          text: body.error?.message ?? "Could not start a re-scan.",
        });
        return;
      }
      window.location.reload();
    } finally {
      setRescanning(false);
    }
  }

  async function handleDelete() {
    await fetch(`/api/domains/${domainId}`, { method: "DELETE" });
    window.location.href = "/app/domains";
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-card border border-neutral-200 bg-white p-5">
        <FormField label="Policy preset">
          <Select
            options={PRESET_OPTIONS}
            value={preset}
            onValueChange={(v) => void handlePresetChange(v)}
          />
        </FormField>
      </div>

      <div className="rounded-card border border-neutral-200 bg-white p-5">
        <Switch
          label="Scheduled monitoring"
          description="Automatically re-scan this domain on your plan's monitoring frequency."
          checked={monitoringState === "active"}
          onCheckedChange={() => void handleMonitoringToggle()}
        />
      </div>

      <div className="rounded-card border border-neutral-200 bg-white p-5">
        <FormField label="Notes" description="Private notes only visible to you.">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
        </FormField>
        <Button
          variant="secondary"
          className="mt-3"
          isLoading={savingNotes}
          onClick={() => void handleSaveNotes()}
        >
          Save notes
        </Button>
      </div>

      <div className="rounded-card border border-neutral-200 bg-white p-5">
        <h3 className="text-card-heading text-neutral-950">Manual re-scan</h3>
        <p className="mt-1 text-supporting text-neutral-600">
          Manual re-scans are limited per month by your plan; scheduled monitoring runs separately.
        </p>
        {rescanMessage && (
          <div className="mt-3">
            <Alert
              tone={rescanMessage.tone}
              title={rescanMessage.tone === "error" ? "Re-scan not started" : "Re-scan started"}
            >
              {rescanMessage.text}
            </Alert>
          </div>
        )}
        <Button className="mt-3" isLoading={rescanning} onClick={() => void handleRescan()}>
          Re-scan now
        </Button>
      </div>

      <div className="rounded-card border border-error/30 bg-error-bg p-5">
        <h3 className="text-card-heading text-error">Danger zone</h3>
        <p className="mt-1 text-supporting text-neutral-700">
          Stop tracking this domain. Historical reports are kept but the domain is removed from your
          dashboard.
        </p>
        <Button variant="destructive" className="mt-3" onClick={() => setConfirmDelete(true)}>
          Remove domain
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Remove this domain?"
        description="This stops monitoring and removes the domain from your dashboard. Past reports remain accessible by direct link."
        confirmLabel="Remove domain"
        destructive
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
