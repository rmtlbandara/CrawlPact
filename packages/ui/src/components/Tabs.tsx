import * as RadixTabs from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import { cx } from "../cx";

export type TabDef = { value: string; label: string; content: ReactNode };

export type TabsProps = {
  tabs: TabDef[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
};

/** SRS §10.31: domain-detail tabs maintain URL state via the `value`/`onValueChange` props. */
export function Tabs({ tabs, defaultValue, value, onValueChange }: TabsProps) {
  return (
    <RadixTabs.Root
      defaultValue={defaultValue ?? tabs[0]?.value}
      value={value}
      onValueChange={onValueChange}
    >
      <RadixTabs.List className="flex gap-1 border-b border-neutral-200" aria-label="Sections">
        {tabs.map((tab) => (
          <RadixTabs.Trigger
            key={tab.value}
            value={tab.value}
            className={cx(
              "px-3 py-2.5 text-body font-medium text-neutral-600 border-b-2 border-transparent -mb-px",
              "hover:text-neutral-900",
              "data-[state=active]:border-brand-600 data-[state=active]:text-brand-700",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
            )}
          >
            {tab.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {tabs.map((tab) => (
        <RadixTabs.Content key={tab.value} value={tab.value} className="pt-4">
          {tab.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
