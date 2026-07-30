import { useState } from "react";
import { Menu } from "lucide-react";
import { Drawer, IconButton, Link } from "@crawlpact/ui";

export type NavLink = { label: string; href: string };

/**
 * The only client-side JS on most marketing pages (SRS §9.22: "minimise
 * JavaScript"). Desktop navigation is plain static markup in
 * SiteHeader.astro; this island only handles the mobile collapsible menu
 * (SRS §9.6, §10.15). The `xl:hidden` below must stay the exact mirror of
 * SiteHeader.astro's `xl:block`/`xl:flex` — this project remaps Tailwind's
 * breakpoint scale (see that file's comment), so `xl:` here means 1024px,
 * not Tailwind's stock 1280px.
 */
// "Product" is a homepage anchor, not a distinct section, so it's excluded
// from current-page indication — only real standalone routes are marked
// (mirrors the same rule in SiteHeader.astro's desktop nav).
function isCurrentSection(href: string, currentPath: string): boolean {
  const path = href.split("#")[0] ?? "";
  return path !== "" && path !== "/" && currentPath.startsWith(path);
}

export function MobileNav({
  links,
  ctaHref,
  ctaLabel,
  currentPath,
}: {
  links: NavLink[];
  ctaHref: string;
  ctaLabel: string;
  currentPath: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="xl:hidden">
      <IconButton icon={<Menu />} label="Open menu" onClick={() => setOpen(true)} />
      <Drawer open={open} onOpenChange={setOpen} title="Menu" side="right">
        <nav aria-label="Primary">
          <ul className="flex flex-col gap-1">
            {links.map((link) => {
              const current = isCurrentSection(link.href, currentPath);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={current ? "page" : undefined}
                    className={
                      current
                        ? "block py-2.5 text-body-lg font-medium text-brand-700"
                        : "block py-2.5 text-body-lg text-neutral-800"
                    }
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
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
