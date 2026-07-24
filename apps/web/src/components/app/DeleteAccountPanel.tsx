import { useState } from "react";
import { Alert, Button, ConfirmDialog } from "@crawlpact/ui";

export function DeleteAccountPanel({ pendingDeletion }: { pendingDeletion: boolean }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [status, setStatus] = useState(pendingDeletion);
  const [error, setError] = useState<string | null>(null);

  async function handleRequestDeletion() {
    setError(null);
    const response = await fetch("/api/account/deletion", { method: "POST" });
    const body = (await response.json()) as { ok: boolean; error?: { message: string } };
    if (!body.ok) {
      setError(body.error?.message ?? "Could not request account deletion.");
      return;
    }
    setStatus(true);
  }

  async function handleCancel() {
    await fetch("/api/account/deletion", { method: "DELETE" });
    setStatus(false);
  }

  if (status) {
    return (
      <div className="flex flex-col gap-3">
        <Alert tone="warning" title="Account deletion requested">
          Your account is scheduled for deletion. You can still sign in and use CrawlPact — cancel
          any time before the deletion is processed.
        </Alert>
        <Button variant="secondary" className="self-start" onClick={() => void handleCancel()}>
          Cancel deletion
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <Alert tone="error" title="That didn't work">
          {error}
        </Alert>
      )}
      <p className="text-body text-neutral-700">
        Deleting your account removes access to your saved domains, monitoring, and billing. This
        requires recent sign-in — if you're asked to sign in again, that's expected.
      </p>
      <Button variant="destructive" className="self-start" onClick={() => setConfirmOpen(true)}>
        Delete account
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete your CrawlPact account?"
        description="This can be cancelled any time before the deletion is processed."
        confirmLabel="Request deletion"
        destructive
        requireTypedConfirmation="DELETE"
        onConfirm={() => void handleRequestDeletion()}
      />
    </div>
  );
}
