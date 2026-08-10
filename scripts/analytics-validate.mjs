#!/usr/bin/env node
// Analytics privacy regression validator (Phase 13,
// docs/analytics/GOOGLE_ANALYTICS_SCOPE_POLICY.md). Read-only, no network access. Checks that
// Google Analytics stays confined to MarketingLayout.astro, that the consent control exists and
// is wired in, that the privacy policy no longer carries the pre-Phase-13 "no consent control"
// statement, and that the product-event registry doc stays in sync with the real event list.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const errors = [];
const warnings = [];

function walk(dir, extensions) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (/\/node_modules\//.test(full)) continue;
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walk(full, extensions));
    } else if (extensions.some((ext) => full.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

// --- 1. GA (GoogleAnalytics component / raw gtag/googletagmanager references) only in
// MarketingLayout.astro and the consent island that mirrors its loader ---

const ALLOWED_GA_FILES = new Set([
  "apps/web/src/components/GoogleAnalytics.astro",
  "apps/web/src/components/AnalyticsConsent.tsx",
  "apps/web/src/layouts/MarketingLayout.astro",
  // Declares which Google domains CSP *permits* — not a load site itself.
  "apps/web/src/lib/security-headers.ts",
]);

const layoutAndComponentFiles = walk(path.join(REPO_ROOT, "apps/web/src"), [
  ".astro",
  ".tsx",
  ".ts",
]);
for (const file of layoutAndComponentFiles) {
  const rel = path.relative(REPO_ROOT, file).split(path.sep).join("/");
  if (rel.endsWith(".test.ts") || rel.endsWith(".test.tsx")) continue;
  if (ALLOWED_GA_FILES.has(rel)) continue;
  const content = readFileSync(file, "utf8");
  if (/googletagmanager\.com|google-analytics\.com|\bgtag\(/.test(content)) {
    errors.push(
      `${rel}: references Google Analytics (gtag/googletagmanager) outside the allowed files. GA must only ever load from GoogleAnalytics.astro/AnalyticsConsent.tsx, gated by consent + route eligibility, and only rendered by MarketingLayout.astro.`,
    );
  }
}

// Explicit negative check: AppLayout/AdminLayout must never import GoogleAnalytics.
for (const layoutRel of [
  "apps/web/src/layouts/AppLayout.astro",
  "apps/web/src/layouts/AdminLayout.astro",
]) {
  const full = path.join(REPO_ROOT, layoutRel);
  if (!existsSync(full)) continue;
  const content = readFileSync(full, "utf8");
  if (/GoogleAnalytics|gtag|googletagmanager/i.test(content)) {
    errors.push(
      `${layoutRel}: must never reference Google Analytics — this is an authenticated layout.`,
    );
  }
}

// --- 2. Consent control exists and is wired into MarketingLayout ---

const consentLibPath = path.join(REPO_ROOT, "apps/web/src/lib/consent.ts");
if (!existsSync(consentLibPath)) {
  errors.push(
    "apps/web/src/lib/consent.ts is missing — the consent architecture's shared source of truth.",
  );
}
const consentComponentPath = path.join(REPO_ROOT, "apps/web/src/components/AnalyticsConsent.tsx");
if (!existsSync(consentComponentPath)) {
  errors.push("apps/web/src/components/AnalyticsConsent.tsx is missing.");
}
const marketingLayoutPath = path.join(REPO_ROOT, "apps/web/src/layouts/MarketingLayout.astro");
if (existsSync(marketingLayoutPath)) {
  const content = readFileSync(marketingLayoutPath, "utf8");
  if (!content.includes("AnalyticsConsent")) {
    errors.push(
      "MarketingLayout.astro no longer renders <AnalyticsConsent /> — the consent control must be present on every public marketing page.",
    );
  }
  if (!content.includes("isGaEligibleRoute")) {
    errors.push(
      "MarketingLayout.astro no longer computes GA route eligibility via isGaEligibleRoute — the route allowlist may have been bypassed.",
    );
  }
}

// --- 3. Privacy policy no longer carries the pre-Phase-13 "no consent control" statement ---

const privacyPath = path.join(REPO_ROOT, "apps/web/src/pages/privacy.astro");
if (existsSync(privacyPath)) {
  const content = readFileSync(privacyPath, "utf8");
  if (/does not currently offer a cookie-consent/i.test(content)) {
    errors.push(
      "apps/web/src/pages/privacy.astro still contains the obsolete 'does not currently offer a cookie-consent control' statement — this must be removed now that Phase 13's consent control exists.",
    );
  }
  if (!content.includes("crawlpact_analytics_consent")) {
    warnings.push(
      "apps/web/src/pages/privacy.astro does not mention the analytics consent cookie by name.",
    );
  }
}

// --- 4. Product-event registry doc references every current event name ---

const analyticsLibPath = path.join(REPO_ROOT, "apps/web/src/lib/analytics.ts");
const registryDocPath = path.join(REPO_ROOT, "docs/analytics/PRODUCT_EVENT_REGISTRY.md");
if (existsSync(analyticsLibPath) && existsSync(registryDocPath)) {
  const libContent = readFileSync(analyticsLibPath, "utf8");
  const registryContent = readFileSync(registryDocPath, "utf8");
  const eventNameMatches = [...libContent.matchAll(/"([a-z][a-z0-9_]*)"/g)]
    .map((m) => m[1])
    .filter((name) => name.includes("_") || /^[a-z]+$/.test(name));
  // Only check names that look like real event identifiers (contain an underscore or are a
  // single lowercase word) inside the PRODUCT_EVENT_NAMES array specifically.
  const arrayMatch = libContent.match(/PRODUCT_EVENT_NAMES = \[([\s\S]*?)\] as const/);
  const namesInArray = arrayMatch
    ? [...arrayMatch[1].matchAll(/"([a-z0-9_]+)"/g)].map((m) => m[1])
    : eventNameMatches;
  const missingFromDoc = namesInArray.filter((name) => !registryContent.includes(name));
  if (missingFromDoc.length > 0) {
    warnings.push(
      `docs/analytics/PRODUCT_EVENT_REGISTRY.md is missing ${missingFromDoc.length} event name(s) present in analytics.ts: ${missingFromDoc.slice(0, 10).join(", ")}${missingFromDoc.length > 10 ? "…" : ""}`,
    );
  }
} else {
  errors.push("Missing apps/web/src/lib/analytics.ts or docs/analytics/PRODUCT_EVENT_REGISTRY.md.");
}

// --- Report ---

if (warnings.length > 0) {
  console.warn(`\n${warnings.length} warning(s):`);
  for (const w of warnings) console.warn(`  - ${w}`);
}
if (errors.length > 0) {
  console.error(`\n${errors.length} error(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error("\nanalytics:validate: FAILED");
  process.exit(1);
}

console.log(
  `analytics:validate: PASSED (${layoutAndComponentFiles.length} files checked for GA scope, consent wiring, privacy policy, event registry sync)`,
);
