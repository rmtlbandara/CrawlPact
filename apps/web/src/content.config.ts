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
  }),
});

export const collections = { crawlers, guides };
