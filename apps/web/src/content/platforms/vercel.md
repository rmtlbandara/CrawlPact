---
title: "AI crawler policy on Vercel"
description: "How Vercel's automatic preview-deployment noindex header, static and generated robots.txt files, and custom headers affect what your site tells AI crawlers — verified against official Vercel and Next.js documentation."
platformName: "Vercel"
platformCategory: "deployment_platform"
summary: "Vercel automatically adds an X-Robots-Tag: noindex header to preview and outdated production deployments, with a documented custom-domain exception — separate from whatever robots.txt your framework serves for production."
officialSources:
  [
    {
      title: "Are Vercel Preview Deployments indexed by search engines?",
      url: "https://vercel.com/kb/guide/are-vercel-preview-deployment-indexed-by-search-engines",
    },
    { title: "System Headers", url: "https://vercel.com/docs/headers" },
    {
      title: "robots.txt — File-system conventions (Next.js)",
      url: "https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots",
    },
  ]
platformDocsVerifiedDate: "2026-08-04"
publishedDate: "2026-08-04"
relatedGuideSlugs:
  ["robots-txt-vs-meta-robots-vs-x-robots-tag", "policy-health-score-dropped-between-scans"]
relatedCrawlerSlugs: []
relatedPlatformSlugs: ["netlify", "cloudflare"]
---

## What CrawlPact can verify

CrawlPact fetches the live, public `robots.txt`, response headers (including `X-Robots-Tag`), and
meta directives for whichever URL you save — the production domain, or a specific preview URL if
you save that instead.

## What CrawlPact cannot verify

CrawlPact cannot see your Vercel project dashboard, environment variables, or `vercel.json`
configuration directly — only the resulting public response for a given URL. It also cannot
determine whether a given deployment is a "Preview," "Production," or "outdated Production"
deployment from Vercel's own internal classification — only what headers that URL actually
returns when fetched.

## Where crawler policy may originate on Vercel

- **A static `app/robots.txt` file**, or a generated `app/robots.ts`/`robots.js` file (Next.js's
  Metadata Routes convention) returning rules, an optional sitemap URL, and an optional host —
  the generated route is cached by default unless it uses a request-time API.
- **Vercel's automatic `X-Robots-Tag: noindex` header** — applied to every Preview Deployment and
  to outdated Production Deployments after a newer deployment is promoted, with no configuration
  required.
- **A custom domain assigned to a non-production branch** — Vercel's documented exception: the
  automatic `noindex` header is _not_ applied in this specific case, since Vercel treats a
  custom-domain-on-a-branch setup as an intentionally indexable environment.
- **Custom headers** configured in `vercel.json`, or set by your framework directly (e.g. a
  Next.js `headers()` function).

## Public signals relevant to Vercel

`robots.txt` (static or generated), the `X-Robots-Tag` response header (both Vercel's own
automatic preview behaviour and anything you set explicitly), and meta robots tags your framework
or application code renders.

## Common conflicts or failure modes

- **Assuming production and preview deployments share the same crawler policy.** They frequently
  don't — Vercel's automatic preview `noindex` header exists specifically so preview URLs aren't
  indexed alongside production, which is a deliberate difference, not a bug, but one worth knowing
  about when interpreting an audit of a non-production URL.
- **A custom domain on a preview/non-production branch unexpectedly becoming indexable.** Since
  Vercel's documented exception removes the automatic `noindex` header in exactly this
  configuration, a team that assumes "all non-production deployments are automatically hidden"
  can be surprised by this specific, documented case.
- **A generated `robots.ts` route silently going stale due to caching**, since Next.js caches the
  route by default unless it explicitly opts into request-time/dynamic behaviour — a value that
  should change per-environment (e.g. based on `VERCEL_ENV`) needs that opt-in to actually vary.
- **Relying on Search Console/crawler behaviour to confirm `noindex` is applied**, rather than
  directly checking the response header — some crawlers and tools have been reported (per
  third-party discussion, not Vercel's own documentation) to still select a deployment URL despite
  a `noindex` header being present; checking the header directly is the authoritative signal.

## How to inspect the current public response

Request the specific URL you care about directly and inspect both `/robots.txt` and the
`X-Robots-Tag` response header — for a preview deployment, confirm whether the automatic `noindex`
header is present or whether the custom-domain exception applies to your setup.

## How to implement or update policy safely

- For production `robots.txt`: use a static `app/robots.txt` for a fixed policy, or `app/robots.ts`
  for a policy that needs to vary by environment or include dynamic values (e.g. an
  environment-conditional sitemap URL).
- To force `noindex` on a custom-domain preview deployment (where Vercel's automatic header does
  not apply): add a framework-level header check (e.g. Next.js `headers()` in `next.config.js`
  testing `process.env.VERCEL_ENV !== 'preview'`), or a `has`-scoped host condition in
  `vercel.json`.
- Never assume the automatic preview `noindex` behaviour covers every non-production case — verify
  it directly for your specific domain/branch combination, especially if you use custom domains on
  preview branches.

## How to verify after deployment

Re-check the `X-Robots-Tag` header and `robots.txt` output for both your production domain and any
preview URLs you specifically care about — particularly after assigning or changing a custom
domain on a non-production branch, given the documented exception above.

## Monitoring and change detection

A saved CrawlPact domain is automatically rechecked on your plan's schedule (Solo: monthly,
Pro/Agency: weekly), catching a change to either a static `robots.txt` file, a generated route's
output, or header configuration — including one introduced by a framework/dependency update.

## Platform-specific limitations

- CrawlPact cannot distinguish "this is a Preview Deployment" from "this is Production" on
  Vercel's own terms — it reports the headers/`robots.txt` actually returned by the URL you save,
  which is the same evidence a real crawler would use.
- CrawlPact cannot read your `vercel.json` or Next.js configuration directly.
- The specific caching behaviour of a generated `robots.ts` route (cached vs. request-time) is a
  Next.js/Vercel implementation detail CrawlPact cannot introspect beyond observing the actual
  served output at audit time.

## Related tools and crawler pages

See [robots.txt vs. meta robots vs. X-Robots-Tag](/guides/robots-txt-vs-meta-robots-vs-x-robots-tag)
for how these signal layers relate, and the [crawler directory](/crawlers) for documented AI
crawler tokens.

## Frequently asked questions

**Will my preview deployments be indexed by AI training crawlers?** Vercel's documented behaviour
adds an `X-Robots-Tag: noindex` header to preview deployments automatically, with one documented
exception (a custom domain assigned to a non-production branch) — check the actual header for your
specific setup rather than assuming either way.

**Does CrawlPact deploy or configure anything on Vercel?** No — CrawlPact audits the public
response your deployment already produces; changing `vercel.json`, environment variables, or
framework configuration happens in your own project.
