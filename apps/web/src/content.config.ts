import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/**
 * Content collections back the crawler directory and guides index (SRS
 * §11, Step 10: "Content may initially be sourced from structured Markdown
 * or content collections. Do not create a complex CMS."). Super Admin
 * registry management (SRS §28.11) operates on the database, not these
 * files — these collections are the public-facing reference content, kept
 * in sync with the registry manually until that admin tooling exists.
 */
const crawlers = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/crawlers" }),
  schema: z.object({
    name: z.string(),
    operator: z.string(),
    userAgentToken: z.string(),
    purpose: z.enum([
      "search",
      "training",
      "user_triggered",
      "agent",
      "advertising_validation",
      "research",
      "mixed",
      "unknown",
    ]),
    lifecycleStatus: z.enum(["active", "deprecated", "replaced", "unverified", "retired"]),
    officialSourceUrl: z.string().url(),
    lastVerified: z.string(),
    summary: z.string(),
  }),
});

const guides = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/guides" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.enum(["decision", "implementation", "troubleshooting"]),
    publishedDate: z.string(),
    updatedDate: z.string().optional(),
    // Explicit, source-of-truth link to the crawler-reference pages this
    // guide discusses by name — lets a crawler page show "related guides"
    // without fragile keyword-matching against guide body text.
    relatedCrawlerSlugs: z.array(z.string()).optional(),
  }),
});

/**
 * Phase 7 (Vertical Landing Pages and Platform SEO Architecture). Audience-specific landing
 * pages served at /for/<slug> — see docs/seo/SEARCH_INTENT_AND_PAGE_MAP.md for the search-intent
 * rationale behind each entry and docs/content/VERTICAL_PAGE_CONTENT_STANDARD.md for the
 * content requirements each entry must meet before publication.
 */
const verticals = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/verticals" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    audience: z.string(),
    primaryProblem: z.string(),
    // Entitlement-model plan this audience most commonly needs — never a forced upsell; see
    // docs/billing/APPROVED_PRICING_AND_ENTITLEMENT_MATRIX.md for the entitlement source this
    // must stay consistent with (read at page-render time via getPlanCatalog, never duplicated).
    recommendedPlan: z.enum(["solo", "pro", "agency"]),
    relatedPlatformSlugs: z.array(z.string()).optional(),
    relatedGuideSlugs: z.array(z.string()).optional(),
    relatedCrawlerSlugs: z.array(z.string()).optional(),
    publishedDate: z.string(),
    updatedDate: z.string().optional(),
  }),
});

/**
 * Phase 7. Verified, source-cited platform implementation guides served at /platforms/<slug> —
 * see docs/seo/PLATFORM_CLAIM_SOURCE_REGISTER.md for the per-claim source evidence behind every
 * published entry and docs/content/PLATFORM_GUIDE_CONTENT_STANDARD.md for the content
 * requirements (official sources, verification date, limitations section are all mandatory,
 * enforced by scripts/content-validate.mjs).
 */
const platforms = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/platforms" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    platformName: z.string(),
    platformCategory: z.enum([
      "managed_cdn",
      "hosted_application",
      "deployment_platform",
      "web_server",
    ]),
    summary: z.string(),
    officialSources: z
      .array(z.object({ title: z.string(), url: z.string().url() }))
      .min(1, "Every platform guide must cite at least one official source."),
    // The date this guide's technical claims were last actually rechecked against the official
    // sources above — distinct from publishedDate/updatedDate, and never bumped without a real
    // recheck (see docs/seo/CONTENT_FRESHNESS_AND_REVIEW_POLICY.md).
    platformDocsVerifiedDate: z.string(),
    publishedDate: z.string(),
    updatedDate: z.string().optional(),
    relatedGuideSlugs: z.array(z.string()).optional(),
    relatedCrawlerSlugs: z.array(z.string()).optional(),
    relatedPlatformSlugs: z.array(z.string()).optional(),
  }),
});

export const collections = { crawlers, guides, verticals, platforms };
