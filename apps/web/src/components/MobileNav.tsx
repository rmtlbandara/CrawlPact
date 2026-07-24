import { useState } from "react";
import { Menu } from "lucide-react";
import { Drawer, IconButton, Link } from "@crawlpact/ui";

export type NavLink = { label: string; href: string };

/**
 * The only client-side JS on most marketing pages (SRS §9.22: "minimise
 * JavaScript"). Desktop navigation is plain static markup in
 * SiteHeader.astro; this island only handles the mobile collapsible menu
 * (SRS §9.6, §10.15).
 */
export function MobileNav({
  links,
  ctaHref,
  ctaLabel,
}: {
  links: NavLink[];
  ctaHref: string;
  ctaLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <IconButton icon={<Menu />} label="Open menu" onClick={() => setOpen(true)} />
      <Drawer open={open} onOpenChange={setOpen} title="Menu" side="right">
        <nav aria-label="Primary">
          <ul className="flex flex-col gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="block py-2.5 text-body-lg text-neutral-800">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <a
          href={ctaHref}
          className="mt-6 block rounded-control bg-brand-600 px-4 py-3 text-center text-body font-medium text-white hover:bg-brand-700"
        >
          {ctaLabel}
        </a>
      </Drawer>
    </div>
  );
}
