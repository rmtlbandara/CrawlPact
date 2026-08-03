import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Asserts on the actual source of `SiteFooter.astro` — Phase 3 requires every public page to
 * provide discoverable links to About, Contact, Privacy, Terms, Security, and Status (among
 * others). No Astro component-rendering harness exists in this repo (see
 * `apps/web/src/lib/robots-txt.test.ts` for the same source-inspection approach used elsewhere),
 * so this guards against the footer regressing to omit a required trust link.
 */
describe("SiteFooter.astro required trust links", () => {
  const footerPath = fileURLToPath(new URL("./SiteFooter.astro", import.meta.url));
  const content = readFileSync(footerPath, "utf-8");

  it.each(["/about", "/contact", "/privacy", "/terms", "/acceptable-use", "/security", "/status"])(
    "links to %s",
    (href) => {
      expect(content).toContain(`href: "${href}"`);
    },
  );
});
