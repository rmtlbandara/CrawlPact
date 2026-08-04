# Search-intent and page map (Phase 7)

Every vertical and platform page planned for Phase 7, with its search intent, funnel role, and
internal-link position, decided before any page was written (per the phase prompt's "Do not
publish a large content set before Stage 7A passes" rule). Intent categories used below:
**informational**, **diagnostic**, **implementation**, **commercial investigation**,
**transactional**. No **product comparison** pages are planned this phase (not approved — see the
phase prompt §7.2/§10's explicit comparison-content restrictions).

## Vertical pages (`/for/*`)

| Page                          | Primary audience                                                         | Primary user problem                                                                                                       | Primary intent                           | Primary query theme                         | Secondary query themes                                                        | Funnel stage                   | Main CTA                   | Secondary CTA        | Recommended plan | Link parents                   | Link children                                                                    |
| ----------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------ | -------------------------- | -------------------- | ---------------- | ------------------------------ | -------------------------------------------------------------------------------- |
| `/for/agencies`               | Agencies, web/SEO agencies, technical consultants, multi-client teams    | Understanding, explaining, and monitoring crawler-policy state across many client websites                                 | Commercial investigation                 | "AI crawler policy for agencies"            | "monitor client websites AI crawlers", "AI crawler audit for clients"         | Consideration → commercial     | Audit a client domain      | View a sample report | Agency           | Homepage, footer, platform hub | `/platforms/*` (all), `/crawlers`, `/pricing`, `/sample-report`, relevant guides |
| `/for/publishers`             | News/editorial/content publishers, membership-content operators          | Search vs. training crawler decisions differ; public policy can be inconsistent; deployment changes can silently alter it  | Informational → commercial investigation | "AI crawler policy for publishers"          | "block AI training crawlers publisher", "search vs training crawler access"   | Awareness → consideration      | Audit a domain free        | View a sample report | Pro              | Homepage, footer, platform hub | `/guides` (search-vs-training), `/crawlers`, `/methodology`                      |
| `/for/saas-and-documentation` | SaaS companies, product/developer documentation teams, API doc teams     | Documentation discoverability decisions; deployment/CDN-driven policy drift; multiple domains/subdomains                   | Informational → implementation           | "AI crawler policy for documentation sites" | "AI crawler access to developer docs", "robots.txt for SaaS documentation"    | Awareness → consideration      | Audit a domain free        | View a sample report | Pro              | Homepage, footer, platform hub | `/platforms/vercel`, `/platforms/netlify`, `/platforms/cloudflare`, `/guides`    |
| `/for/web-developers`         | Freelance/agency developers, DevOps/platform engineers, site maintainers | Intended crawler policy may differ from the deployed response; frameworks/hosting/CDNs can generate or modify public files | Implementation → diagnostic              | "verify robots.txt after deployment"        | "framework generated robots.txt", "AI crawler policy deployment verification" | Consideration → implementation | Audit your deployed policy | View a sample report | Solo             | Homepage, footer, platform hub | `/platforms/*` (all), `/guides`, `/scanner`                                      |

**Existing page overlap / cannibalisation**: none of the four verticals compete with an existing
page for the same primary query — `/crawlers`, `/guides`, and `/methodology` are all
_reference_-intent pages (informational, "what does token X do" / "how does directive Y work"),
while the four vertical pages are _audience_-intent pages ("how does someone in role X approach
this problem"). Cross-linking (above) is deliberate specifically to avoid cannibalisation: each
vertical page sends informational-intent traffic on to the reference pages rather than duplicating
their content. All four are net-new publication priority 1 (highest) — required by the phase
prompt, no partial set permitted.

## Platform hub and guides (`/platforms`, `/platforms/*`)

| Page                    | Primary audience                 | Primary user problem                                                                                | Primary intent              | Primary query theme             | Secondary query themes                                                     | Funnel stage                   | Main CTA                   | Link parents                                                       | Link children                        |
| ----------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------- | -------------------------------------------------------------------------- | ------------------------------ | -------------------------- | ------------------------------------------------------------------ | ------------------------------------ |
| `/platforms` (hub)      | All technical audiences          | Which implementation guide is relevant to my stack                                                  | Diagnostic                  | "AI crawler policy by platform" | —                                                                          | Awareness                      | Audit a domain free        | Homepage, footer, all 4 verticals                                  | Every published `/platforms/*` guide |
| `/platforms/cloudflare` | Developers/DevOps on Cloudflare  | How Cloudflare's edge/AI Crawl Control features interact with public crawler-policy signals         | Implementation → diagnostic | "Cloudflare AI crawler policy"  | "Cloudflare robots.txt edge rules", "Cloudflare AI Crawl Control"          | Consideration → implementation | Audit your deployed policy | Platform hub, `/for/web-developers`, `/for/agencies`               | Relevant guides, `/crawlers`         |
| `/platforms/wordpress`  | WordPress site owners/developers | Dynamic vs. physical robots.txt, plugin/theme/caching interactions                                  | Implementation → diagnostic | "WordPress AI crawler policy"   | "WordPress robots.txt AI crawlers", "WordPress site visibility setting AI" | Consideration → implementation | Audit your deployed policy | Platform hub, `/for/web-developers`, `/for/publishers`             | Relevant guides, `/crawlers`         |
| `/platforms/shopify`    | Shopify merchants/developers     | Shopify's managed robots.txt customisation mechanism and its limits                                 | Implementation → diagnostic | "Shopify AI crawler policy"     | "Shopify robots.txt customization", "Shopify theme crawler rules"          | Consideration → implementation | Audit your deployed policy | Platform hub, `/for/web-developers`                                | Relevant guides, `/crawlers`         |
| `/platforms/vercel`     | Developers deploying on Vercel   | Static files vs. framework-generated routes, preview vs. production, middleware-generated responses | Implementation → diagnostic | "Vercel AI crawler policy"      | "Vercel robots.txt deployment", "Next.js robots.txt Vercel"                | Consideration → implementation | Audit your deployed policy | Platform hub, `/for/web-developers`, `/for/saas-and-documentation` | Relevant guides, `/crawlers`         |
| `/platforms/netlify`    | Developers deploying on Netlify  | Static files, headers/redirects config, deploy contexts (preview vs. production)                    | Implementation → diagnostic | "Netlify AI crawler policy"     | "Netlify robots.txt headers", "Netlify deploy preview robots.txt"          | Consideration → implementation | Audit your deployed policy | Platform hub, `/for/web-developers`, `/for/saas-and-documentation` | Relevant guides, `/crawlers`         |

**Existing page overlap / cannibalisation**: none — no existing page addresses platform-specific
implementation detail; `/methodology` and `/scanner` describe CrawlPact's own evaluation process,
not third-party platform behaviour. All 5 priority guides are publication priority 1. Stage 7D
(nginx, apache, fastly, akamai, GitHub Pages) is publication priority 2, contingent on the same
official-source research bar being met — see the Phase 7 completion report for the actual
publish/defer decision made once that research was carried out.

## Why trivial keyword variations were rejected

Per the phase prompt's explicit example, no separate pages were planned for "AI crawler checker
for agencies" / "AI bot checker for agencies" / "AI robots checker for agencies" — a single
`/for/agencies` page addresses that intent. The same discipline was applied throughout: one page
per genuinely distinct audience or platform, never a template with one noun swapped.
