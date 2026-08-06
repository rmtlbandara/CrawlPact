import { useEffect, useRef, useState } from "react";
import { Alert, Button, FormField, Input } from "@crawlpact/ui";

type Profile = { agencyName: string | null; logoUrl: string | null };

async function fetchJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url);
  const body = (await response.json()) as { ok: boolean; data?: T };
  return body.ok ? (body.data ?? null) : null;
}

export function AgencyBrandingSettings() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [agencyName, setAgencyName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetchJson<Profile>("/api/agency-branding/profile").then((p) => {
      setProfile(p);
      setAgencyName(p?.agencyName ?? "");
      setLogoUrl(p?.logoUrl ?? null);
    });
  }, []);

  async function handleLogoSelected(file: File | undefined) {
    if (!file) return;
    setError(null);
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/agency-branding/logo", { method: "POST", body: formData });
      const body = (await response.json()) as {
        ok: boolean;
        data?: { logoUrl: string };
        error?: { message: string };
      };
      if (!body.ok || !body.data) {
        setError(body.error?.message ?? "Could not upload this logo.");
        return;
      }
      setLogoUrl(body.data.logoUrl);
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleSave() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/agency-branding/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agencyName: agencyName.trim() || null,
          logoUrl: logoUrl ?? null,
        }),
      });
      const body = (await response.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) {
        setError(body.error?.message ?? "Could not save your branding profile.");
        return;
      }
      setSaved(true);
      setProfile({ agencyName: agencyName.trim() || null, logoUrl });
    } finally {
      setBusy(false);
    }
  }

  if (profile === null) {
    return <div className="h-48 animate-pulse rounded-card bg-neutral-100" aria-hidden="true" />;
  }

  return (
    <div className="flex flex-col gap-4 rounded-card border border-neutral-200 bg-white p-5">
      {error && (
        <Alert tone="error" title="Could not save this change">
          {error}
        </Alert>
      )}
      {saved && (
        <Alert tone="success" title="Saved">
          These defaults will be pre-filled the next time you share a report.
        </Alert>
      )}
      <FormField label="Agency name" description="Shown on your branded reports.">
        <Input value={agencyName} onChange={(e) => setAgencyName(e.target.value)} maxLength={120} />
      </FormField>
      <FormField label="Logo" description="PNG, JPEG, GIF, or WebP, up to 1 MB.">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          disabled={logoUploading}
          onChange={(e) => void handleLogoSelected(e.target.files?.[0])}
        />
      </FormField>
      {logoUrl && (
        <div className="flex items-center gap-3">
          <img
            src={logoUrl}
            alt={agencyName || "Agency logo"}
            className="h-10 max-w-[120px] object-contain"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setLogoUrl(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          >
            Remove
          </Button>
        </div>
      )}
      <p className="text-supporting text-neutral-600">
        CrawlPact's methodology, evidence, limitations, and registry/ruleset version always remain
        visible on shared reports — branding cannot remove them.
      </p>
      <div>
        <Button isLoading={busy} onClick={() => void handleSave()}>
          Save branding defaults
        </Button>
      </div>
    </div>
  );
}
