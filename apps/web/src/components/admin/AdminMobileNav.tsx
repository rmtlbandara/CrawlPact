import { useState } from "react";
import { Menu } from "lucide-react";
import { Drawer, IconButton } from "@crawlpact/ui";

export type AdminNavGroup = {
  heading: string;
  links: { label: string; href: string }[];
};

/**
 * Below `lg` the desktop sidebar in AdminNav.astro is hidden entirely with
 * no replacement — an admin had no way to reach any of the 20 admin
 * sections from a phone or tablet. This mirrors the public site's
 * MobileNav pattern (same Drawer/IconButton primitives) so an admin can
 * still act (e.g. pause the scheduler, resolve a security event) from a
 * smaller screen. Note: this project remaps Tailwind's breakpoint scale
 * (packages/ui/src/tokens/tokens.css) — `lg:` here means 768px, not
 * Tailwind's stock 1024px (a stale version of this comment previously said
 * 1024px).
 */
export function AdminMobileNav({
  groups,
  currentPath,
}: {
  groups: AdminNavGroup[];
  currentPath: string;
}) {
  const [open, setOpen] = useState(false);

  function isActive(href: string): boolean {
    return href === "/admin" ? currentPath === "/admin" : currentPath.startsWith(href);
  }

  return (
    <div className="lg:hidden">
      <IconButton icon={<Menu />} label="Open admin menu" onClick={() => setOpen(true)} />
      <Drawer open={open} onOpenChange={setOpen} title="Admin menu" side="left">
        <nav aria-label="Super Admin navigation">
          {groups.map((group) => (
            <div key={group.heading} className="mb-5">
              <p className="text-caption font-semibold uppercase tracking-wide text-neutral-500">
                {group.heading}
              </p>
              <ul className="mt-1.5 flex flex-col gap-0.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      aria-current={isActive(link.href) ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className={
                        isActive(link.href)
                          ? "block rounded-control bg-brand-50 px-2.5 py-1.5 text-supporting font-medium text-brand-800"
                          : "block rounded-control px-2.5 py-1.5 text-supporting font-medium text-neutral-700 hover:bg-neutral-100"
                      }
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </Drawer>
    </div>
  );
}
