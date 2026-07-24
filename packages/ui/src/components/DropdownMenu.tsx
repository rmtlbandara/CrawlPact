import * as RadixDropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { cx } from "../cx";

export type DropdownMenuItemDef = {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

export type DropdownMenuProps = {
  trigger: ReactNode;
  items: DropdownMenuItemDef[];
};

/** SRS §10.53. Full keyboard support (arrow keys, Home/End, Escape) via Radix. */
export function DropdownMenu({ trigger, items }: DropdownMenuProps) {
  return (
    <RadixDropdownMenu.Root>
      <RadixDropdownMenu.Trigger asChild>{trigger}</RadixDropdownMenu.Trigger>
      <RadixDropdownMenu.Portal>
        <RadixDropdownMenu.Content
          sideOffset={4}
          align="end"
          className="z-dropdown min-w-48 rounded-card border border-neutral-200 bg-white p-1 shadow-elevated"
        >
          {items.map((item) => (
            <RadixDropdownMenu.Item
              key={item.label}
              disabled={item.disabled}
              onSelect={item.onSelect}
              className={cx(
                "cursor-pointer rounded-[6px] px-3 py-2 text-body text-neutral-800 outline-none",
                "data-[highlighted]:bg-brand-50 data-[highlighted]:text-brand-800",
                "data-[disabled]:cursor-not-allowed data-[disabled]:text-neutral-400",
                item.destructive &&
                  "text-error data-[highlighted]:bg-error-bg data-[highlighted]:text-error",
              )}
            >
              {item.label}
            </RadixDropdownMenu.Item>
          ))}
        </RadixDropdownMenu.Content>
      </RadixDropdownMenu.Portal>
    </RadixDropdownMenu.Root>
  );
}
