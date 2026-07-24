import * as RadixTooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

export type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
};

/** SRS §10.53. Keyboard-focusable trigger with a delayed, dismissible tooltip. */
export function Tooltip({ content, children }: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={300}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            sideOffset={6}
            className="z-tooltip max-w-64 rounded-[6px] bg-neutral-950 px-2.5 py-1.5 text-supporting text-white shadow-elevated"
          >
            {content}
            <RadixTooltip.Arrow className="fill-neutral-950" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
