import type { CrawlerPurpose, LifecycleStatus } from "@crawlpact/registry";
import type { CrawlerResultValue, PolicyPreset } from "./presets";
import type {
  ContentSignalsResult,
  HtmlSignals,
  RslDeclaration,
  SitemapValidation,
} from "@crawlpact/scanner";

export type CrawlerEvaluation = {
  crawlerId: string;
  crawlerName: string;
  operatorName: string;
  userAgentToken: string;
  purpose: CrawlerPurpose;
  lifecycleStatus: LifecycleStatus;
  replacementCrawlerId: string | null;
  result: CrawlerResultValue;
  matchedRule: string | null;
  matchedLineNumber: number | null;
};

export type RobotsSignalStatus = {
  fetched: boolean;
  statusCode: number | null;
  issueCodes: string[];
  hasDuplicateGroups: boolean;
  hasBroadWildcardBlock: boolean;
};

export type SignalBundle = {
  robots: RobotsSignalStatus;
  contentSignals: ContentSignalsResult | null;
  rsl: RslDeclaration | null;
  html: HtmlSignals | null;
  sitemap: SitemapValidation | null;
  xRobotsTag: string[];
};

export type PolicyEvaluationInput = {
  preset: PolicyPreset;
  crawlerEvaluations: CrawlerEvaluation[];
  signals: SignalBundle;
  rulesetVersion: string;
};
