import { useEffect, useState } from "react";
import { DataTable, StatusChip } from "@crawlpact/ui";
import type { DataTableColumn } from "@crawlpact/ui";

type TransactionRow = {
  transaction: {
    id: string;
    paddleTransactionId: string;
    currency: string;
    grossAmountCents: number;
    taxAmountCents: number | null;
    status: string;
    occurredAt: string;
    refundStatus: string | null;
    chargebackStatus: string | null;
  };
  // null once the owning account has been deleted (Phase 11, RISK-009) — the
  // transaction record itself is never deleted, only the user link.
  user: { id: string; displayName: string } | null;
  subscription: { id: string; planId: string } | null;
};

/** SRS §28.6: only fields Paddle actually sends — never a fabricated fee/net figure. */
export function TransactionsManager() {
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    fetch("/api/admin/transactions")
      .then(
        (res) =>
          res.json() as Promise<{
            ok: boolean;
            data?: TransactionRow[];
            error?: { message: string };
          }>,
      )
      .then((body) => {
        if (!body.ok) throw new Error(body.error?.message ?? "Request failed");
        setRows(body.data ?? []);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setIsLoading(false));
  }, []);

  function formatMoney(cents: number, currency: string): string {
    return (cents / 100).toLocaleString("en-US", { style: "currency", currency });
  }

  const columns: DataTableColumn<TransactionRow>[] = [
    {
      key: "user",
      header: "User",
      render: (row) =>
        row.user ? (
          <a
            href={`/admin/users/${row.user.id}`}
            className="font-medium text-brand-700 hover:underline"
          >
            {row.user.displayName}
          </a>
        ) : (
          <span className="text-neutral-500 italic">Deleted account</span>
        ),
    },
    {
      key: "plan",
      header: "Plan",
      render: (row) => row.subscription?.planId ?? "—",
      hideBelow: "sm",
    },
    {
      key: "gross",
      header: "Gross",
      render: (row) => formatMoney(row.transaction.grossAmountCents, row.transaction.currency),
    },
    {
      key: "tax",
      header: "Tax",
      render: (row) =>
        row.transaction.taxAmountCents !== null
          ? formatMoney(row.transaction.taxAmountCents, row.transaction.currency)
          : "—",
      hideBelow: "md",
    },
    { key: "status", header: "Status", render: (row) => row.transaction.status },
    {
      key: "flags",
      header: "Flags",
      render: (row) => (
        <div className="flex gap-1.5">
          {row.transaction.refundStatus && <StatusChip tone="warning" label="Refunded" />}
          {row.transaction.chargebackStatus && <StatusChip tone="error" label="Chargeback" />}
        </div>
      ),
    },
    {
      key: "date",
      header: "Date",
      render: (row) => new Date(row.transaction.occurredAt).toLocaleDateString(),
      hideBelow: "lg",
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.transaction.id}
      isLoading={isLoading}
      error={error}
      emptyTitle="No transactions recorded"
      emptyDescription="Transactions arrive via processed Paddle webhook events."
    />
  );
}
