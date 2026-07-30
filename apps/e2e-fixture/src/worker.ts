/**
 * A deliberately tiny, static scan target — see wrangler.jsonc's comment
 * for why this exists. Fixed content only, no dynamic behaviour, no
 * bindings, nothing CrawlPact's own product code ever references.
 */

const ROBOTS_TXT = `User-agent: *
Allow: /

User-agent: GPTBot
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: Google-Extended
Allow: /
`;

const LLMS_TXT = `# CrawlPact E2E Fixture

> A minimal, version-controlled test fixture site used by CrawlPact's own
> end-to-end test suite. Not a real product, service, or customer.

This origin exists solely so CrawlPact's automated tests have a stable,
real HTTP target to scan — content is intentionally minimal and only
changes alongside the test suite that depends on it.
`;

const HOMEPAGE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>CrawlPact e2e fixture</title>
    <meta name="robots" content="noindex, nofollow" />
  </head>
  <body>
    <h1>CrawlPact e2e fixture</h1>
    <p>
      This is a minimal, version-controlled test fixture used by CrawlPact's own automated test
      suite. It is not a real product, service, or customer site.
    </p>
  </body>
</html>
`;

export default {
  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/robots.txt") {
      return new Response(ROBOTS_TXT, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    if (pathname === "/llms.txt") {
      return new Response(LLMS_TXT, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    if (pathname === "/") {
      return new Response(HOMEPAGE_HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler;
