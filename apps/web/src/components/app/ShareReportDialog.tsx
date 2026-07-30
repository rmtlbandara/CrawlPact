import { useRef, useState } from "react";
import { Alert, Button, Checkbox, FormField, Input, Modal, Textarea } from "@crawlpact/ui";
import type { ShareSummary } from "@crawlpact/core";

type Props = {
  auditId: string;
  /** Only agency-plan customers may attach branding (SRS §29) — gated server-side too. */
  agencyBrandingAllowed: boolean;
};

/**
 * Creates a private, revocable share link for a completed report (SRS §23),
 * optionally with agency branding (SRS §29). The branding fields never
 * remove or replace CrawlPact's own methodology/limitations/evidence — see
 * `AuditReportView`, which renders those unconditionally.
 */
export function ShareReportDialog({ auditId, agencyBrandingAllowed }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [share, setShare] = useState<ShareSummary | null>(null);
  const [copied, setCopied] = useState(false);

  const [expiresInDays, setExpiresInDays] = useState("30");
  const [addBranding, setAddBranding] = useState(false);
  const [agencyName, setAgencyName] = useState("");
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [introText, setIntroText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setError(null);
    setShare(null);
    setCopied(false);
    setLogoPath(null);
    setLogoError(null);
  }

  async function handleLogoSelected(file: File | undefined) {
    if (!file) return;
    setLogoError(null);
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/agency-branding/logo", {
        method: "POST",
        body: formData,
      });
      const body = (await response.json()) as {
        ok: boolean;
        data?: { logoUrl: string };
        error?: { message: string };
      };
      if (!body.ok || !body.data) {
        setLogoError(body.error?.message ?? "Could not upload this logo.");
        return;
      }
      setLogoPath(body.data.logoUrl);
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleCreate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const agencyBranding =
        addBranding && agencyBrandingAllowed
          ? {
              agencyName: agencyName.trim() || undefined,
              logoUrl: logoPath ?? undefined,
              clientName: clientName.trim() || undefined,
              introText: introText.trim() || undefined,
            }
          : undefined;

      const response = await fetch(`/api/audit/${auditId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expiresInDays: expiresInDays ? Number(expiresInDays) : undefined,
          agencyBranding,
        }),
      });
      const body = (await response.json()) as {
        ok: boolean;
        data?: ShareSummary;
        error?: { message: string };
      };
      if (!body.ok || !body.data) {
        setError(body.error?.message ?? "Could not create a share link.");
        return;
      }
      setShare(body.data);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        Share report
      </Button>
      <Modal
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
        title="Share this report"
        description="Anyone with this link can view a read-only copy of this report until it expires or you revoke it."
        footer={
          share ? (
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Done
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button isLoading={busy} onClick={() => void handleCreate()}>
                Create link
              </Button>
            </>
          )
        }
      >
        {error && (
          <Alert tone="error" title="Could not create a share link">
            {error}
          </Alert>
        )}

        {share ? (
          <div className="flex flex-col gap-3">
            <FormField label="Share link" description="This link works without an account.">
              <Input readOnly value={share.url} onFocus={(e) => e.currentTarget.select()} />
            </FormField>
            <Button
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(share.url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Copied" : "Copy link"}
            </Button>
            <p className="text-supporting text-neutral-600">
              {share.expiresAt
                ? `Expires ${new Date(share.expiresAt).toLocaleDateString()}.`
                : "This link does not expire."}{" "}
              You can revoke it from the report's share history at any time.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <FormField
              label="Link expires after"
              description="Leave blank for a link that never expires."
            >
              <Input
                type="number"
                min={1}
                max={90}
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
              />
            </FormField>

            {agencyBrandingAllowed && (
              <Checkbox
                checked={addBranding}
                onCheckedChange={(checked) => setAddBranding(checked === true)}
                label="Add my agency's branding to this report"
              />
            )}

            {agencyBrandingAllowed && addBranding && (
              <div className="flex flex-col gap-4 rounded-card border border-neutral-200 p-4">
                <FormField label="Agency name" description="Shown at the top of the report.">
                  <Input
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    maxLength={120}
                  />
                </FormField>
                <FormField
                  label="Logo"
                  description="PNG, JPEG, GIF, or WebP, up to 1 MB."
                  error={logoError ?? undefined}
                >
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    disabled={logoUploading}
                    onChange={(e) => void handleLogoSelected(e.target.files?.[0])}
                  />
                </FormField>
                {logoPath && (
                  <div className="flex items-center gap-3">
                    <img
                      src={logoPath}
                      alt="Logo preview"
                      className="h-10 max-w-[120px] object-contain"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setLogoPath(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                )}
                <FormField label="Client name" description="Who this report is prepared for.">
                  <Input
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    maxLength={120}
                  />
                </FormField>
                <FormField
                  label="Introductory note"
                  description="A short paragraph shown above the report."
                >
                  <Textarea
                    value={introText}
                    onChange={(e) => setIntroText(e.target.value)}
                    rows={3}
                    maxLength={1000}
                  />
                </FormField>
                <p className="text-supporting text-neutral-600">
                  CrawlPact's methodology, evidence, limitations, and registry/ruleset version
                  always remain visible on the report — branding cannot remove them.
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
