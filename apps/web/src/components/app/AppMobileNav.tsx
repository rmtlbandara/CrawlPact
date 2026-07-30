import { useState } from "react";
import { Menu } from "lucide-react";
import { Drawer, IconButton, Link } from "@crawlpact/ui";

export type AppNavLink = { label: string; href: string };

/**
 * Below `xl` (1024px) AppNav.astro's desktop link list is hidden entirely
 * with no replacement — confirmed a real, genuine horizontal-overflow bug
 * (516px at 360px width, see docs/status/KNOWN_RISKS.md) since a customer
 * had no way to reach any dashboard section from a phone or tablet. Mirrors
 * SiteHeader.astro's MobileNav / AdminNav.astro's AdminMobileNav pattern
 * (same Drawer/IconButton primitives, same complementary xl:hidden /
 * hidden xl:flex split) rather than inventing a new collapse mechanism.
 */
export function AppMobileNav({ links, currentPath }: { links: AppNavLink[]; currentPath: string }) {
  const [open, setOpen] = useState(false);

  function isActive(href: string): boolean {
    return href === "/app" ? currentPath === "/app" : currentPath.startsWith(href);
  }

  return (
    <div className="xl:hidden">
      <IconButton icon={<Menu />} label="Open menu" onClick={() => setOpen(true)} />
      <Drawer open={open} onOpenChange={setOpen} title="Menu" side="right">
        <nav aria-label="Dashboard navigation">
          <ul className="flex flex-col gap-1">
            {links.map((link) => {
              const current = isActive(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={current ? "page" : undefined}
                    onClick={() => setOpen(false)}
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
      </Drawer>
    </div>
  );
}
