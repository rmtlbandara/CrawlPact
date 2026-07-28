import { useEffect, useState } from "react";
import { DataTable, SearchField, Select, StatusChip } from "@crawlpact/ui";
import type { DataTableColumn } from "@crawlpact/ui";

type UserRow = {
  id: string;
  displayName: string;
  status: "active" | "suspended" | "pending_deletion";
  planId: string;
  isAdmin: boolean;
  createdAt: string;
};

const STATUS_TONE = {
  active: "success",
  suspended: "error",
  pending_deletion: "warning",
} as const;

/** SRS §28.3: user search by ID/name/Paddle IDs/domain, plus plan/status filters. */
export function UsersManager() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("any");
  const [rows, setRows] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (status !== "any") params.set("status", status);

    fetch(`/api/admin/users?${params.toString()}`, { signal: controller.signal })
      .then(
        (res) =>
          res.json() as Promise<{ ok: boolean; data?: UserRow[]; error?: { message: string } }>,
      )
      .then((body) => {
        if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
        setRows(body.data ?? []);
        setError(undefined);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [query, status]);

  const columns: DataTableColumn<UserRow>[] = [
    {
      key: "displayName",
      header: "User",
      render: (row) => (
        <a href={`/admin/users/${row.id}`} className="font-medium text-brand-700 hover:underline">
          {row.displayName}
        </a>
      ),
    },
    {
      key: "id",
      header: "User ID",
      render: (row) => <span className="font-mono text-supporting">{row.id}</span>,
      hideBelow: "md",
    },
    { key: "plan", header: "Plan", render: (row) => row.planId, hideBelow: "sm" },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <StatusChip tone={STATUS_TONE[row.status]} label={row.status.replace("_", " ")} />
      ),
    },
    {
      key: "admin",
      header: "Admin",
      render: (row) => (row.isAdmin ? <StatusChip tone="info" label="Admin" /> : "—"),
      hideBelow: "lg",
    },
    {
      key: "createdAt",
      header: "Created",
      render: (row) => new Date(row.createdAt).toLocaleDateString(),
      hideBelow: "lg",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="max-w-md flex-1">
          <SearchField
            label="Search users"
            placeholder="Search by ID, name, Paddle ID, or domain"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="w-48">
          <Select
            ariaLabel="Filter users by status"
            options={[
              { value: "any", label: "Any status" },
              { value: "active", label: "Active" },
              { value: "suspended", label: "Suspended" },
              { value: "pending_deletion", label: "Pending deletion" },
            ]}
            value={status}
            onValueChange={setStatus}
          />
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="No users match this search"
        emptyDescription="Try a different search term or status filter."
      />
    </div>
  );
}
