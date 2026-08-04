#!/usr/bin/env node
// Content-collection quality gate (Phase 7). Read-only, no network access — checks the
// verticals/platforms Markdown content collections (and their cross-references into
// guides/crawlers) for the requirements recorded in docs/content/VERTICAL_PAGE_CONTENT_STANDARD.md
// and docs/content/PLATFORM_GUIDE_CONTENT_STANDARD.md. Astro's own zod schema
// (apps/web/src/content.config.ts) already enforces field presence/types at build time; this
// script catches the content-quality rules zod cannot express (duplicate metadata, broken internal
// references, prohibited hand-maintained sections, missing mandatory body sections, staleness).

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const CONTENT_ROOT = path.join(REPO_ROOT, "apps/web/src/content");

const TODAY = new Date().toISOString().slice(0, 10);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function loadCollection(name) {
  const dir = path.join(CONTENT_ROOT, name);
  const entries = [];
  for (const filename of readdirSync(dir)) {
    if (!filename.endsWith(".md")) continue;
    const id = filename.slice(0, -3);
    const raw = readFileSync(path.join(dir, filename), "utf8");
    const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
    if (!match) {
      throw new Error(`${name}/${filename}: missing or malformed frontmatter block`);
    }
    const data = parseYaml(match[1]);
    const body = match[2];
    entries.push({ id, file: `apps/web/src/content/${name}/${filename}`, data, body });
  }
  return entries;
}

function main() {
  const errors = [];
  const warnings = [];

  const verticals = loadCollection("verticals");
  const platforms = loadCollection("platforms");
  const guides = loadCollection("guides");
  const crawlers = loadCollection("crawlers");

  const guideIds = new Set(guides.map((g) => g.id));
  const crawlerIds = new Set(crawlers.map((c) => c.id));
  const platformIds = new Set(platforms.map((p) => p.id));
  const verticalIds = new Set(verticals.map((v) => v.id));

  // Duplicate slugs within a collection (readdirSync already guarantees unique filenames on a
  // case-sensitive filesystem, but guard against case-only collisions, which would 404 on some
  // deploy targets while looking fine locally).
  for (const [name, entries] of [
    ["verticals", verticals],
    ["platforms", platforms],
  ]) {
    const seen = new Map();
    for (const entry of entries) {
      const lower = entry.id.toLowerCase();
      if (seen.has(lower)) {
        errors.push(`${name}: case-colliding slugs "${seen.get(lower)}" and "${entry.id}"`);
      }
      seen.set(lower, entry.id);
    }
  }

  // Title/description uniqueness across every Phase 7 page plus every existing guide/crawler page
  // (catches duplication before it ever reaches the live sitemap check in seo-metadata.spec.ts).
  const titles = new Map();
  const descriptions = new Map();
  for (const entry of [...verticals, ...platforms, ...guides]) {
    const title = entry.data.title;
    const description = entry.data.description;
    if (titles.has(title)) {
      errors.push(`${entry.file}: title duplicates ${titles.get(title)} ("${title}")`);
    } else {
      titles.set(title, entry.file);
    }
    if (descriptions.has(description)) {
      errors.push(`${entry.file}: description duplicates ${descriptions.get(description)}`);
    } else {
      descriptions.set(description, entry.file);
    }
  }

  function checkDate(entry, field, { requirePast = true } = {}) {
    const value = entry.data[field];
    if (value === undefined) return;
    if (!DATE_PATTERN.test(value)) {
      errors.push(`${entry.file}: ${field} "${value}" is not an ISO YYYY-MM-DD date`);
      return;
    }
    if (requirePast && value > TODAY) {
      errors.push(`${entry.file}: ${field} "${value}" is in the future`);
    }
  }

  function checkRelated(entry, field, validIds, label) {
    const slugs = entry.data[field];
    if (!slugs) return;
    for (const slug of slugs) {
      if (!validIds.has(slug)) {
        errors.push(`${entry.file}: ${field} references unknown ${label} "${slug}"`);
      }
    }
  }

  for (const entry of verticals) {
    checkDate(entry, "publishedDate");
    checkDate(entry, "updatedDate");
    if (
      entry.data.updatedDate &&
      DATE_PATTERN.test(entry.data.updatedDate) &&
      DATE_PATTERN.test(entry.data.publishedDate) &&
      entry.data.updatedDate < entry.data.publishedDate
    ) {
      errors.push(`${entry.file}: updatedDate is before publishedDate`);
    }
    checkRelated(entry, "relatedPlatformSlugs", platformIds, "platform");
    checkRelated(entry, "relatedGuideSlugs", guideIds, "guide");
    checkRelated(entry, "relatedCrawlerSlugs", crawlerIds, "crawler");

    // Pricing must always come from the live getPlanCatalog() call in for/[slug].astro, never a
    // hard-coded figure that can drift from the real Paddle catalog (docs/seo/
    // VERTICAL_PAGE_CONTENT_STANDARD.md rule 6). A literal "$<digit>" in the body is exactly the
    // regression this content type is most at risk of.
    if (/\$\d/.test(entry.body)) {
      errors.push(
        `${entry.file}: body contains a literal "$<number>" — pricing must only render from live getPlanCatalog() data, never hard-coded content`,
      );
    }

    // Every vertical page must state what it does not do/include (content standard requirement).
    if (!/^##\s+what\b.*\bdoes not\b/im.test(entry.body)) {
      errors.push(
        `${entry.file}: missing a "What ... does not ..." limitations section (required by docs/content/VERTICAL_PAGE_CONTENT_STANDARD.md)`,
      );
    }
  }

  for (const entry of platforms) {
    checkDate(entry, "publishedDate");
    checkDate(entry, "updatedDate");
    checkDate(entry, "platformDocsVerifiedDate");
    if (
      entry.data.updatedDate &&
      DATE_PATTERN.test(entry.data.updatedDate) &&
      DATE_PATTERN.test(entry.data.publishedDate) &&
      entry.data.updatedDate < entry.data.publishedDate
    ) {
      errors.push(`${entry.file}: updatedDate is before publishedDate`);
    }
    checkRelated(entry, "relatedPlatformSlugs", platformIds, "platform");
    checkRelated(entry, "relatedGuideSlugs", guideIds, "guide");
    checkRelated(entry, "relatedCrawlerSlugs", crawlerIds, "crawler");

    const sources = entry.data.officialSources ?? [];
    if (sources.length === 0) {
      errors.push(`${entry.file}: officialSources is empty — every claim must trace to a source`);
    }
    for (const source of sources) {
      if (!/^https:\/\//.test(source.url)) {
        errors.push(`${entry.file}: officialSources url "${source.url}" is not https`);
      }
    }

    // Mandatory, never-omitted section (content standard rule 12).
    if (!/^##\s+Platform-specific limitations\s*$/im.test(entry.body)) {
      errors.push(
        `${entry.file}: missing the mandatory "## Platform-specific limitations" section`,
      );
    }

    // Regression guard: "Official references" must be template-generated from officialSources in
    // platforms/[slug].astro, never a hand-authored section in the Markdown body (this exact
    // mistake was made and reverted during Phase 7 authoring — see the phase completion report).
    if (/^##\s+Official references\s*$/im.test(entry.body)) {
      errors.push(
        `${entry.file}: contains a hand-written "## Official references" section — this must only be rendered from the officialSources frontmatter by platforms/[slug].astro`,
      );
    }

    // platformDocsVerifiedDate staleness relative to the 90-day review cadence
    // (docs/seo/CONTENT_FRESHNESS_AND_REVIEW_POLICY.md) — warning only, not a publish blocker.
    if (DATE_PATTERN.test(entry.data.platformDocsVerifiedDate)) {
      const verifiedMs = Date.parse(entry.data.platformDocsVerifiedDate);
      const ageDays = (Date.parse(TODAY) - verifiedMs) / 86_400_000;
      if (ageDays > 90) {
        warnings.push(
          `${entry.file}: platformDocsVerifiedDate is ${Math.round(ageDays)} days old (90-day review cadence) — due for recheck`,
        );
      }
    }
  }

  // Generic placeholder/filler text that has no legitimate reason to appear in published content.
  const PLACEHOLDER_PATTERNS = [
    /lorem ipsum/i,
    /\bTODO\b/,
    /\bTBD\b/,
    /\[Platform Name\]/i,
    /\[Audience\]/i,
    /example@example\.com/i,
  ];
  for (const entry of [...verticals, ...platforms]) {
    for (const pattern of PLACEHOLDER_PATTERNS) {
      if (pattern.test(entry.body)) {
        errors.push(`${entry.file}: contains placeholder text (matches ${pattern})`);
      }
    }
  }

  // Thin-template-similarity warning: within a collection, two entries whose bodies share an
  // unusually high proportion of distinct words are worth a human look — not a hard failure,
  // since technical platform guides legitimately reuse a lot of shared vocabulary
  // ("robots.txt", "CrawlPact", "public response"), but a near-total overlap suggests a
  // find-and-replace template rather than genuinely distinct content.
  function wordSet(body) {
    return new Set(
      body
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 4),
    );
  }
  for (const [name, entries] of [
    ["verticals", verticals],
    ["platforms", platforms],
  ]) {
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = wordSet(entries[i].body);
        const b = wordSet(entries[j].body);
        const intersection = [...a].filter((w) => b.has(w)).length;
        const union = new Set([...a, ...b]).size;
        const similarity = union === 0 ? 0 : intersection / union;
        if (similarity > 0.6) {
          warnings.push(
            `${name}: "${entries[i].id}" and "${entries[j].id}" share ${Math.round(similarity * 100)}% distinct-word overlap — verify they are genuinely distinct content, not a template`,
          );
        }
      }
    }
  }

  // Every vertical/platform must be reachable from at least one other content entry or the static
  // nav/footer/homepage (checked structurally: relatedPlatformSlugs/relatedGuideSlugs are optional
  // per-entry, but each platform should be linked from at least one vertical and vice versa, per
  // docs/seo/INTERNAL_LINK_ARCHITECTURE.md's "no orphaned page" rule).
  const linkedPlatforms = new Set(verticals.flatMap((v) => v.data.relatedPlatformSlugs ?? []));
  for (const platform of platforms) {
    if (!linkedPlatforms.has(platform.id)) {
      warnings.push(
        `platforms/${platform.id}.md: not referenced by relatedPlatformSlugs on any vertical page — check it isn't orphaned outside the hub`,
      );
    }
  }
  const linkedVerticals = new Set(
    verticals.filter((v) => (v.data.relatedPlatformSlugs?.length ?? 0) > 0).map((v) => v.id),
  );
  if (linkedVerticals.size === 0 && verticals.length > 0) {
    warnings.push("verticals: no vertical page links to any platform guide");
  }
  void verticalIds; // reserved for future cross-collection checks

  if (warnings.length > 0) {
    console.warn(`\n${warnings.length} warning(s):`);
    for (const w of warnings) console.warn(`  - ${w}`);
  }
  if (errors.length > 0) {
    console.error(`\n${errors.length} error(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    console.error("\ncontent:validate: FAILED");
    process.exit(1);
  }

  console.log(
    `content:validate: PASSED (${verticals.length} verticals, ${platforms.length} platforms checked)`,
  );
}

main();
