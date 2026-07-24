/**
 * Shared crawler-purpose vocabulary (SRS §17, FR-REG-003) used by the
 * landing page's crawler directory preview and, later, the full crawler
 * matrix. Keeping the label/description copy here means the marketing site
 * and the authenticated app never drift into inconsistent terminology
 * (SRS §10.50).
 */
export const CRAWLER_PURPOSES = [
  "search",
  "training",
  "user_triggered",
  "agent",
  "advertising_validation",
  "research",
  "mixed",
  "unknown",
] as const;

export type CrawlerPurpose = (typeof CRAWLER_PURPOSES)[number];

export const CRAWLER_PURPOSE_LABELS: Record<CrawlerPurpose, string> = {
  search: "Search",
  training: "Training",
  user_triggered: "User-triggered",
  agent: "Agent / action",
  advertising_validation: "Advertising / validation",
  research: "Research",
  mixed: "Mixed",
  unknown: "Unknown",
};

export const CRAWLER_PURPOSE_DESCRIPTIONS: Record<CrawlerPurpose, string> = {
  search: "Indexes pages to answer search queries.",
  training: "Collects content that may be used to train future models.",
  user_triggered: "Fetches a page in direct response to a specific user request.",
  agent: "Performs automated actions or multi-step tasks on a user's behalf.",
  advertising_validation: "Verifies ads, links, or other automated validation tasks.",
  research: "Builds open datasets or corpora reused by third parties.",
  mixed: "Combines more than one of the purposes above.",
  unknown: "Purpose has not yet been verified against an official source.",
};

export const LIFECYCLE_STATUSES = [
  "active",
  "deprecated",
  "replaced",
  "unverified",
  "retired",
] as const;
export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];
