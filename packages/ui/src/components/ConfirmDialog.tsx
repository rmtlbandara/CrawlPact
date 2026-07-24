import { useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { Input } from "./Input";

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  /** When set, the user must type this exact value to enable the confirm button (SRS §10.36). */
  requireTypedConfirmation?: string;
  onConfirm: () => void;
};

/** SRS §10.36: destructive/high-risk actions get an explicit, explained confirmation step. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  requireTypedConfirmation,
  onConfirm,
}: ConfirmDialogProps) {
  const [typedValue, setTypedValue] = useState("");
  const canConfirm = !requireTypedConfirmation || typedValue === requireTypedConfirmation;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "primary"}
            disabled={!canConfirm}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {requireTypedConfirmation && (
        <div className="mt-2">
          <label className="mb-1.5 block text-supporting text-neutral-700">
            Type <span className="font-mono">{requireTypedConfirmation}</span> to confirm
          </label>
          <Input value={typedValue} onChange={(event) => setTypedValue(event.target.value)} />
        </div>
      )}
    </Modal>
  );
}
