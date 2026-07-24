import { useState } from "react";
import { Alert, Button } from "@crawlpact/ui";

export function RecoveryCodesPanel() {
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/recovery-codes/generate", { method: "POST" });
      const body = (await response.json()) as {
        ok: boolean;
        data?: { codes: string[] };
        error?: { message: string };
      };
      if (!body.ok || !body.data) {
        setError(body.error?.message ?? "Could not generate recovery codes.");
        return;
      }
      setCodes(body.data.codes);
    } finally {
      setBusy(false);
    }
  }

  function handleDownload() {
    if (!codes) return;
    const blob = new Blob([codes.join("\n") + "\n"], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "crawlpact-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body text-neutral-700">
        Recovery codes let you sign in if you lose access to your passkeys. Generating a new set
        immediately invalidates any codes from before.
      </p>

      {error && (
        <Alert tone="error" title="That didn't work">
          {error}
        </Alert>
      )}

      {codes && (
        <>
          <Alert tone="warning" title="Save these now — they won't be shown again">
            Store them somewhere safe, such as a password manager.
          </Alert>
          <pre className="overflow-x-auto rounded-card border border-neutral-300 bg-neutral-50 p-4 text-body font-mono">
            {codes.join("\n")}
          </pre>
          <Button variant="secondary" className="self-start" onClick={handleDownload}>
            Download codes
          </Button>
        </>
      )}

      <Button className="self-start" isLoading={busy} onClick={() => void handleGenerate()}>
        {codes ? "Regenerate codes" : "Generate recovery codes"}
      </Button>
    </div>
  );
}
