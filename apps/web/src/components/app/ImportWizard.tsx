import { useEffect, useRef, useState } from "react";
import { Alert, Button, FormField, Select } from "@crawlpact/ui";

type PreviewRow = {
  rowNumber: number;
  domain: string;
  groupName: string | null;
  result: string;
};

type PreviewResponse = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  unsupportedColumns: string[];
  rows: PreviewRow[];
  batchImportLimit: number;
  remainingCapacity: number;
};

type ConfirmResponse = {
  jobId: string;
  status: string;
  totalRows: number;
  createdDomains: number;
  failedDomains: number;
  rows: { rowNumber: number; domain: string; result: string; domainId?: string }[];
};

type Group = { groupId: string; name: string };

const RESULT_LABEL: Record<string, string> = {
  created: "Ready to import",
  duplicate_in_file: "Duplicate in this file",
  already_saved: "Already saved to your account",
  invalid_domain: "Not a valid domain",
  private_target: "Private or unsafe target",
  group_not_found: "Group not found",
  monitoring_unavailable: "Monitoring not available on your plan",
  limit_exceeded: "Saved-domain limit reached",
  batch_limit_exceeded: "Batch limit exceeded",
  field_too_long: "A field is too long",
  unsupported_field: "Unsupported column",
};

export function ImportWizard({ domainGroupsEnabled }: { domainGroupsEnabled: boolean }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState("");
  const [applyMonitoring, setApplyMonitoring] = useState(true);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [result, setResult] = useState<ConfirmResponse | null>(null);
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    async function loadGroups() {
      const response = await fetch("/api/groups");
      const body = (await response.json()) as { ok: boolean; data?: Group[] };
      setGroups(body.data ?? []);
    }
    void loadGroups();
  }, []);

  async function handleFileSelected(file: File | undefined) {
    if (!file) return;
    setPreviewError(null);
    setPreview(null);
    setResult(null);
    setPreviewBusy(true);
    try {
      const text = await file.text();
      setCsvText(text);
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/workspace/import/preview", {
        method: "POST",
        body: formData,
      });
      const body = (await response.json()) as {
        ok: boolean;
        data?: PreviewResponse;
        error?: { message: string };
      };
      if (!body.ok || !body.data) {
        setPreviewError(body.error?.message ?? "Could not read this file.");
        return;
      }
      setPreview(body.data);
    } finally {
      setPreviewBusy(false);
    }
  }

  async function handleConfirm() {
    if (!csvText || confirmBusy) return;
    setConfirmBusy(true);
    setConfirmError(null);
    try {
      const response = await fetch("/api/workspace/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvContent: csvText,
          groupId: groupId || undefined,
          applyMonitoring,
          idempotencyKey: idempotencyKeyRef.current,
        }),
      });
      const body = (await response.json()) as {
        ok: boolean;
        data?: ConfirmResponse;
        error?: { message: string };
      };
      if (!body.ok || !body.data) {
        setConfirmError(body.error?.message ?? "Could not complete this import.");
        return;
      }
      setResult(body.data);
    } finally {
      setConfirmBusy(false);
    }
  }

  function startOver() {
    setCsvText(null);
    setPreview(null);
    setPreviewError(null);
    setResult(null);
    setConfirmError(null);
    idempotencyKeyRef.current = crypto.randomUUID();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (result) {
    return (
      <div className="flex flex-col gap-4">
        <Alert
          tone={result.failedDomains === 0 ? "success" : "warning"}
          title={`Created ${result.createdDomains} of ${result.totalRows} domains`}
        >
          {result.failedDomains > 0 && "Review the rows below for details on what wasn't imported."}
        </Alert>
        <div className="max-h-96 overflow-y-auto rounded-card border border-neutral-200">
          <table className="w-full text-left text-supporting">
            <tbody className="divide-y divide-neutral-200">
              {result.rows.map((row) => (
                <tr key={row.rowNumber}>
                  <td className="px-3 py-2 font-mono text-neutral-800">{row.domain}</td>
                  <td className="px-3 py-2">{RESULT_LABEL[row.result] ?? row.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-3">
          <a
            href="/app/workspace/domains"
            className="rounded-control bg-brand-600 px-5 py-3 text-body font-medium text-white hover:bg-brand-700"
          >
            View imported domains
          </a>
          <Button variant="secondary" onClick={startOver}>
            Import another file
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-card border border-neutral-200 bg-white p-5">
        <FormField
          label="CSV file"
          description="One domain per row. Required column: domain. Optional: display_name, group, notes, monitoring."
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => void handleFileSelected(e.target.files?.[0])}
            className="block w-full text-body"
          />
        </FormField>
        <a
          href="/api/workspace/import/template.csv"
          className="mt-2 inline-block text-supporting text-brand-700 underline"
        >
          Download a template
        </a>
      </div>

      {previewBusy && <p className="text-supporting text-neutral-600">Reading file…</p>}
      {previewError && (
        <Alert tone="error" title="Could not read this file">
          {previewError}
        </Alert>
      )}

      {preview && (
        <div className="flex flex-col gap-4">
          <Alert
            tone={preview.invalidRows === 0 ? "success" : "warning"}
            title={`${preview.validRows} of ${preview.totalRows} rows are ready to import`}
          >
            {preview.remainingCapacity < preview.validRows &&
              `Your account has room for ${preview.remainingCapacity} more domains — some rows will be marked over the limit.`}
          </Alert>
          {preview.unsupportedColumns.length > 0 && (
            <p className="text-supporting text-neutral-600">
              Ignored columns: {preview.unsupportedColumns.join(", ")}
            </p>
          )}
          <div className="max-h-64 overflow-y-auto rounded-card border border-neutral-200">
            <table className="w-full text-left text-supporting">
              <tbody className="divide-y divide-neutral-200">
                {preview.rows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td className="px-3 py-2 font-mono text-neutral-800">{row.domain}</td>
                    <td className="px-3 py-2">{RESULT_LABEL[row.result] ?? row.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {domainGroupsEnabled && (
            <FormField label="Group" description="Optional — add every imported domain to a group.">
              <Select
                value={groupId}
                onValueChange={setGroupId}
                placeholder="No group"
                options={groups.map((g) => ({ value: g.groupId, label: g.name }))}
              />
            </FormField>
          )}
          <label className="flex items-center gap-2 text-supporting text-neutral-700">
            <input
              type="checkbox"
              checked={applyMonitoring}
              onChange={(e) => setApplyMonitoring(e.target.checked)}
              className="size-4"
            />
            Enable monitoring for imported domains (where your plan includes it)
          </label>

          {confirmError && (
            <Alert tone="error" title="Could not complete this import">
              {confirmError}
            </Alert>
          )}

          <div className="flex gap-3">
            <Button
              isLoading={confirmBusy}
              disabled={preview.validRows === 0}
              onClick={() => void handleConfirm()}
            >
              Import {preview.validRows} domain{preview.validRows === 1 ? "" : "s"}
            </Button>
            <Button variant="secondary" onClick={startOver}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
