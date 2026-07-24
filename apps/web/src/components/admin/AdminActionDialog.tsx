import { useState } from "react";
import type { ReactNode } from "react";
import { Modal, Button, Textarea, FormField } from "@crawlpact/ui";

export type AdminActionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: (reason: string) => void | Promise<void>;
  /** Extra form fields rendered above the reason field (e.g. entitlement grant's plan/expiry inputs). */
  children?: ReactNode;
};

/**
 * The client-side counterpart to `lib/auth/require-admin.ts`'s
 * `requireAdminAction`: every sensitive Super Admin mutation across every
 * admin section (users, domains, registry, security, ...) collects a reason
 * through this one dialog, so the requirement is impossible to forget when
 * wiring up a new action — reused rather than re-implemented per page.
 */
export function AdminActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  busy = false,
  onConfirm,
  children,
}: AdminActionDialogProps) {
  const [reason, setReason] = useState("");
  const canConfirm = reason.trim().length >= 3 && !busy;

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) setReason("");
        onOpenChange(next);
      }}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "primary"}
            disabled={!canConfirm}
            isLoading={busy}
            onClick={() => onConfirm(reason.trim())}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
      <FormField label="Reason" description="Recorded in the administrative audit log.">
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          maxLength={500}
        />
      </FormField>
    </Modal>
  );
}
