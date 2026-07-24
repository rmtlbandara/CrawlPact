import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { startRegistration, WebAuthnError } from "@simplewebauthn/browser";
import { Alert, Button, FormField, Input } from "@crawlpact/ui";

type Passkey = {
  credentialId: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
};

async function postJson<T>(
  url: string,
  body: unknown,
): Promise<{ ok: boolean; data?: T; message?: string }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = (await response.json()) as { ok: boolean; data?: T; error?: { message: string } };
  return { ok: parsed.ok, data: parsed.data, message: parsed.error?.message };
}

export function PasskeysManager() {
  const [passkeys, setPasskeys] = useState<Passkey[] | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const response = await fetch("/api/auth/passkeys");
    const body = (await response.json()) as { ok: boolean; data?: Passkey[] };
    setPasskeys(body.ok ? (body.data ?? []) : []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const begin = await postJson<{
        challengeId: string;
        publicKeyCredentialCreationOptions: Parameters<typeof startRegistration>[0]["optionsJSON"];
      }>("/api/auth/passkeys/begin", { displayName: label });
      if (!begin.ok || !begin.data) {
        setError(begin.message ?? "Could not start passkey registration.");
        return;
      }

      const credential = await startRegistration({
        optionsJSON: begin.data.publicKeyCredentialCreationOptions,
      });
      const finish = await postJson("/api/auth/passkeys/finish", {
        challengeId: begin.data.challengeId,
        credential,
      });
      if (!finish.ok) {
        setError(finish.message ?? "Could not add this passkey.");
        return;
      }
      setLabel("");
      await refresh();
    } catch (err) {
      setError(
        err instanceof WebAuthnError
          ? "The passkey prompt was cancelled or timed out."
          : "Something went wrong.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(credentialId: string) {
    setError(null);
    const response = await fetch(`/api/auth/passkeys/${credentialId}/remove`, { method: "POST" });
    const body = (await response.json()) as { ok: boolean; error?: { message: string } };
    if (!body.ok) {
      setError(body.error?.message ?? "Could not remove this passkey.");
      return;
    }
    await refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body text-neutral-700">
        You're encouraged to register at least two passkeys, so losing one device doesn't lock you
        out.
      </p>

      {error && (
        <Alert tone="error" title="That didn't work">
          {error}
        </Alert>
      )}

      {passkeys && passkeys.length > 0 && (
        <ul className="divide-y divide-neutral-200 rounded-card border border-neutral-200 bg-white">
          {passkeys.map((passkey) => (
            <li
              key={passkey.credentialId}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="text-body font-medium text-neutral-900">{passkey.label}</p>
                <p className="text-supporting text-neutral-600">
                  Added {new Date(passkey.createdAt).toLocaleDateString()}
                  {passkey.lastUsedAt
                    ? ` · Last used ${new Date(passkey.lastUsedAt).toLocaleDateString()}`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                className="text-supporting font-medium text-error underline"
                onClick={() => void handleRemove(passkey.credentialId)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <FormField label="New passkey label" description='e.g. "Work laptop"'>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              maxLength={80}
            />
          </FormField>
        </div>
        <Button type="submit" isLoading={busy} disabled={label.trim().length === 0}>
          Add passkey
        </Button>
      </form>
    </div>
  );
}
