import * as RadixPopover from "@radix-ui/react-popover";
import type { ReactNode } from "react";
import { cx } from "../cx";

export type PopoverProps = {
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Popover({ trigger, children, className }: PopoverProps) {
  return (
    <RadixPopover.Root>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          sideOffset={6}
          className={cx(
            "z-dropdown rounded-card border border-neutral-200 bg-white p-4 shadow-elevated focus:outline-none",
            className,
          )}
        >
          {children}
          <RadixPopover.Arrow className="fill-white" />
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
