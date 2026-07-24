import { expect, test } from "@playwright/test";

/**
 * Automated technical SEO validation (SRS §30.3, Part 3 Step 16). Drives
 * the route list from the site's own live `/sitemap.xml` rather than a
 * hand-maintained list in the test — the sitemap is the actual source of
 * truth for "what CrawlPact says is a reviewed public page," so this test
 * always covers exactly what's really indexable, including every guide and
 * crawler page as the content collections grow.
 */

function extractLocs(sitemapXml: string): string[] {
  return [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]!);
}

function extractTag(html: string, pattern: RegExp): string | null {
  return pattern.exec(html)?.[1] ?? null;
}

function countH1(html: string): number {
  return (html.match(/<h1[\s>]/g) ?? []).length;
}

test.describe("Sitemap-listed pages carry correct, unique SEO metadata", () => {
  test("every indexable page has exactly one H1, a canonical tag, unique title/description, and Open Graph tags — none are noindex", async ({
    request,
  }) => {
    const sitemapResponse = await request.get("/sitemap.xml");
    expect(sitemapResponse.ok()).toBe(true);
    const locs = extractLocs(await sitemapResponse.text());
    expect(locs.length).toBeGreaterThan(40); // sanity check the sitemap itself isn't empty/broken

    const seenTitles = new Map<string, string>();
    const seenDescriptions = new Map<string, string>();
    const failures: string[] = [];

    for (const loc of locs) {
      const path = new URL(loc).pathname;
      const response = await request.get(path);
      if (!response.ok()) {
        failures.push(`${path}: HTTP ${response.status()}`);
        continue;
      }
      const html = await response.text();

      const title = extractTag(html, /<title>([^<]*)<\/title>/);
      const description = extractTag(html, /<meta name="description" content="([^"]*)"/);
      const canonical = extractTag(html, /<link rel="canonical" href="([^"]*)"/);
      const ogTitle = extractTag(html, /<meta property="og:title" content="([^"]*)"/);
      const ogImage = extractTag(html, /<meta property="og:image" content="([^"]*)"/);
      const isNoindex = /<meta name="robots" content="noindex/.test(html);
      const h1Count = countH1(html);

      if (!title) failures.push(`${path}: missing <title>`);
      if (!description) failures.push(`${path}: missing meta description`);
      if (!canonical) failures.push(`${path}: missing canonical link`);
      if (!ogTitle) failures.push(`${path}: missing og:title`);
      if (!ogImage) failures.push(`${path}: missing og:image`);
      if (isNoindex) failures.push(`${path}: is noindex but listed in the public sitemap`);
      if (h1Count !== 1) failures.push(`${path}: has ${h1Count} <h1> elements, expected exactly 1`);

      if (canonical) {
        // The dev server's baseURL may differ from the site's configured
        // production origin — compare paths, not full origins.
        const canonicalPath = new URL(canonical).pathname;
        if (canonicalPath !== path) {
          failures.push(`${path}: canonical points to "${canonicalPath}", expected "${path}"`);
        }
      }

      if (title) {
        const existing = seenTitles.get(title);
        if (existing) failures.push(`Duplicate <title> "${title}": ${existing} and ${path}`);
        seenTitles.set(title, path);
      }
      if (description) {
        const existing = seenDescriptions.get(description);
        if (existing) {
          failures.push(`Duplicate meta description on ${path} (also used by ${existing})`);
        }
        seenDescriptions.set(description, path);
      }
    }

    expect(failures, `${failures.length} SEO issue(s) found:\n${failures.join("\n")}`).toEqual([]);
  });
});

test.describe("Non-indexable routes are genuinely excluded", () => {
  test("sign-in, an audit report, and admin routes are all noindex — via meta tag or X-Robots-Tag header", async ({
    request,
  }) => {
    const signIn = await request.get("/sign-in");
    expect(await signIn.text()).toContain('content="noindex');

    // /admin has no session in this test (redirects to sign-in) — the
    // X-Robots-Tag header must still be present on that response, since
    // it's a content-type-independent guarantee applied to every response
    // under the path, authenticated or not (see middleware.ts).
    const admin = await request.get("/admin", { maxRedirects: 0 });
    expect(admin.headers()["x-robots-tag"] ?? "").toContain("noindex");

    // A nonexistent audit id 404s at the data layer but the page itself
    // still renders noindex (see pages/audit/[auditId].astro) — and the
    // X-Robots-Tag header applies regardless, from the middleware path
    // match on /audit/*.
    const report = await request.get("/audit/nonexistent-id-for-seo-test");
    expect(report.headers()["x-robots-tag"] ?? "").toContain("noindex");
  });

  test("the 404 page itself is noindex and returns real content", async ({ request }) => {
    const response = await request.get("/this-route-does-not-exist");
    const html = await response.text();
    expect(html).toContain("Page not found");
    expect(html).toContain('content="noindex');
  });
});
