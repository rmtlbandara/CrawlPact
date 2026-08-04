/**
 * Single source for the plan cards/table shown on `/pricing` and the homepage pricing preview —
 * extracted Phase 4 so the two surfaces read one array instead of two independently hand-typed
 * copies (found duplicated, with identical values, during the Phase 4 homepage baseline review).
 *
 * This is still a source-file constant, not the `plans` database table — reconciling the two
 * remains explicitly Phase 6's scope (see `docs/roadmap/CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md`
 * Phase 6, "pricing.astro's hard-coded plan array (SRS §8 violation)"). No price, limit, or
 * entitlement value here was changed from what both pages already displayed.
 */
export type Plan = {
  id: "free" | "solo" | "pro" | "agency";
  name: string;
  audience: string;
  price: string;
  domains: number;
  monitoring: "None" | "Monthly" | "Weekly";
  history: string;
  rescans: number;
  groups: boolean;
  csv: boolean;
  feed: boolean;
  batch: number;
  branding: boolean;
  cta: string;
  recommended: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    audience: "For a one-time check on a single site.",
    price: "USD 0",
    domains: 1,
    monitoring: "None",
    history: "30 days",
    rescans: 2,
    groups: false,
    csv: false,
    feed: false,
    batch: 0,
    branding: false,
    cta: "Start free",
    recommended: false,
  },
  {
    id: "solo",
    name: "Solo",
    audience: "For individual site owners tracking one project.",
    price: "USD 79",
    domains: 5,
    monitoring: "Monthly",
    history: "12 months",
    rescans: 5,
    groups: false,
    csv: false,
    feed: true,
    batch: 0,
    branding: false,
    cta: "Choose Solo",
    recommended: false,
  },
  {
    id: "pro",
    name: "Pro",
    audience: "For growing portfolios that need weekly monitoring.",
    price: "USD 179",
    domains: 25,
    monitoring: "Weekly",
    history: "24 months",
    rescans: 10,
    groups: true,
    csv: true,
    feed: true,
    batch: 10,
    branding: false,
    cta: "Choose Pro",
    recommended: true,
  },
  {
    id: "agency",
    name: "Agency",
    audience: "For agencies managing many client domains.",
    price: "USD 399",
    domains: 100,
    monitoring: "Weekly",
    history: "36 months",
    rescans: 20,
    groups: true,
    csv: true,
    feed: true,
    batch: 100,
    branding: true,
    cta: "Choose Agency",
    recommended: false,
  },
];
