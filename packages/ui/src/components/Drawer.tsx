import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "../cx";

export type DrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  side?: "left" | "right";
};

/**
 * SRS §10.15 (mobile drawer navigation), §10.31 (contextual evidence
 * drawers). Built on the same Radix Dialog primitive as Modal — a drawer is
 * a dialog anchored to a screen edge, not a different accessibility
 * pattern, so it reuses the same focus-trap/Escape/portal behaviour.
 */
export function Drawer({ open, onOpenChange, title, children, side = "right" }: DrawerProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-drawer bg-neutral-950/40" />
        <RadixDialog.Content
          className={cx(
            "fixed inset-y-0 z-drawer flex w-full max-w-sm flex-col bg-white p-6 shadow-modal focus:outline-none",
            side === "right" ? "right-0" : "left-0",
          )}
        >
          <div className="mb-4 flex items-center justify-between">
            <RadixDialog.Title className="text-h3 text-neutral-950">{title}</RadixDialog.Title>
            <RadixDialog.Close asChild>
              <button
                type="button"
                aria-label="Close panel"
                className="rounded-control p-1 text-neutral-500 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
              >
                <X className="size-5" />
              </button>
            </RadixDialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto text-body text-neutral-800">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
