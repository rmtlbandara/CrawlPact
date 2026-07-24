import type { CrawlerPurpose, LifecycleStatus } from "./purpose";

/** Read-model shape for a single crawler record (SRS §17, FR-REG-002). */
export type CrawlerRecord = {
  id: string;
  operatorId: string;
  operatorName: string;
  name: string;
  userAgentToken: string;
  alternativeTokens: string[];
  purpose: CrawlerPurpose;
  description: string;
  officialSourceUrl: string;
  lifecycleStatus: LifecycleStatus;
  firstVerifiedAt: string | null;
  lastVerifiedAt: string | null;
};

export type RegistryVersionSummary = {
  id: string;
  versionLabel: string;
  changelog: string;
  publishedAt: string | null;
  crawlerCount: number;
};
