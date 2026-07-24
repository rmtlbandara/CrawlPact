import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  trigger?: ReactNode;
};

/**
 * SRS §10.53, §10.48: Radix Dialog provides focus trapping, Escape-to-close,
 * and focus restoration to the trigger on close, satisfying the keyboard
 * requirements without bespoke focus-management code.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  trigger,
}: ModalProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>}
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-modal bg-neutral-950/40" />
        <RadixDialog.Content className="fixed left-1/2 top-1/2 z-modal w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-panel bg-white p-6 shadow-modal focus:outline-none">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <RadixDialog.Title className="text-h3 text-neutral-950">{title}</RadixDialog.Title>
              {description && (
                <RadixDialog.Description className="mt-1 text-body text-neutral-600">
                  {description}
                </RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close asChild>
              <button
                type="button"
                aria-label="Close dialog"
                className="rounded-control p-1 text-neutral-500 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
              >
                <X className="size-5" />
              </button>
            </RadixDialog.Close>
          </div>
          <div className="text-body text-neutral-800">{children}</div>
          {footer && <div className="mt-6 flex justify-end gap-3">{footer}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
