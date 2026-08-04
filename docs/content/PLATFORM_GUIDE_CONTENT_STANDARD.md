# Platform guide content standard

Requirements every entry in the `platforms` content collection (`apps/web/src/content/platforms/*.md`,
served at `/platforms/<slug>`) must meet before publication. Enforced by `pnpm content:validate`
where automatable.

## Required frontmatter (`apps/web/src/content.config.ts`)

`title`, `description`, `platformName`, `platformCategory` (`managed_cdn` | `hosted_application` |
`deployment_platform` | `web_server`), `summary`, `officialSources` (≥1, each `{title, url}`),
`platformDocsVerifiedDate`, `publishedDate`, optional `updatedDate`/`relatedGuideSlugs`/
`relatedCrawlerSlugs`/`relatedPlatformSlugs`.

## Required sections (body content)

Per the phase prompt §19's standard structure:

1. Platform-specific hero.
2. What CrawlPact can verify (for this platform).
3. What CrawlPact cannot verify.
4. Where crawler policy may originate on this platform.
5. Public signals relevant to the platform.
6. Common conflicts or failure modes.
7. How to inspect the current public response.
8. How to implement or update policy safely.
9. How to verify after deployment.
10. Example configuration, where genuinely appropriate (see "Code examples" below) — omitted
    entirely where the platform's own official model makes an example inappropriate or unsafe
    (e.g. a managed platform with no user-editable server config).
11. Monitoring and change detection.
12. **Platform-specific limitations — mandatory, never omitted.** A guide with no limitations
    section fails `pnpm content:validate`.
13. **Official references — mandatory, visible section**, generated directly from the
    `officialSources` frontmatter array (never a separately hand-maintained list).
14. Related CrawlPact tools and crawler pages.
15. Audit CTA ("Audit your deployed policy").

## Code examples

Where included: current official syntax only (verified against the fetched official source, not
remembered); smallest useful example; no destructive commands; no assumption of root access; no
secrets; `example.com` only, never a real customer domain; explain how to verify the deployed
result and how to roll back.

## Prohibited content

- A claim of official partnership, integration, or endorsement that wasn't actually confirmed by
  the platform's own documentation.
- A claim that CrawlPact directly edits, deploys to, or controls the platform's configuration —
  CrawlPact audits the public response only.
- An unsupported or untested configuration instruction.
- Copied text from official documentation (summarise and cite instead — see
  `docs/seo/EDITORIAL_SOURCE_AND_CONTENT_POLICY.md`).
- A platform-name-substitution page — each guide's "Platform-specific uniqueness" fields
  (configuration locations, deployment behaviour, caching, CDN/edge behaviour, failure modes,
  verification steps, example code, sources, limitations — per the phase prompt §19) must be
  genuinely distinct per platform.

## Publication gate

See `docs/seo/AI_ASSISTED_CONTENT_GOVERNANCE.md`'s "Publication gate" section — a platform guide
is only committed once every technical claim in it has a corresponding
`docs/seo/PLATFORM_CLAIM_SOURCE_REGISTER.md` entry.

## Review

See `docs/seo/CONTENT_FRESHNESS_AND_REVIEW_POLICY.md` — platform guides: every 90 days or after a
material platform change.
