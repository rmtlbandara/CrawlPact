import * as RadixAccordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export type AccordionItemDef = { value: string; title: string; content: ReactNode };

export type AccordionProps = {
  items: AccordionItemDef[];
  type?: "single" | "multiple";
};

/** SRS §9.17 (FAQ), §10.53. `type="multiple"` allows more than one panel open at once. */
export function Accordion({ items, type = "single" }: AccordionProps) {
  return (
    <RadixAccordion.Root
      type={type as "single"}
      collapsible
      className="divide-y divide-neutral-200"
    >
      {items.map((item) => (
        <RadixAccordion.Item key={item.value} value={item.value}>
          <RadixAccordion.Header>
            <RadixAccordion.Trigger className="group flex w-full items-center justify-between gap-4 py-4 text-left text-h3 text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
              {item.title}
              <ChevronDown className="size-5 shrink-0 text-neutral-500 transition-transform duration-quick group-data-[state=open]:rotate-180" />
            </RadixAccordion.Trigger>
          </RadixAccordion.Header>
          <RadixAccordion.Content className="overflow-hidden pb-4 text-body text-neutral-700 data-[state=closed]:animate-none">
            {item.content}
          </RadixAccordion.Content>
        </RadixAccordion.Item>
      ))}
    </RadixAccordion.Root>
  );
}
