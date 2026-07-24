import { ChevronRight } from "lucide-react";
import { Link } from "./Link";

export type BreadcrumbItem = { label: string; href?: string };

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1.5 text-supporting text-neutral-600">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {item.href && !isLast ? (
                <Link href={item.href} variant="muted">
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={isLast ? "text-neutral-900" : undefined}
                >
                  {item.label}
                </span>
              )}
              {!isLast && <ChevronRight aria-hidden="true" className="size-3.5 text-neutral-400" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
