# Internal link architecture (Phase 7)

The full set of internal links Phase 7 adds, and the rules that keep them from creating orphans,
loops, or an overloaded primary navigation. See `docs/seo/SEARCH_INTENT_AND_PAGE_MAP.md` for the
per-page parent/child link plan this document implements.

## Homepage

Adds one new homepage section (`apps/web/src/components/homepage/VerticalsSection.astro`) linking
to all four vertical pages and the platform hub — placed after `CrawlerPurposeSection`, before
`AgencySection`, matching the existing homepage's audience-progression order (general crawler
education → audience-specific fit → agency-specific deep dive). Does not add all 4 vertical pages
plus 5+ platform guides individually into the primary header nav (would overload it, per the phase
prompt's explicit "Do not create a crowded header" rule); the header nav gains exactly one new
top-level entry, "Platforms" (→ `/platforms` hub, itself linking to every published guide) — see
`apps/web/src/components/SiteHeader.astro`. The four vertical pages are not linked from the header
at all; they're reachable via the homepage's new section (below) and the footer's new "Solutions"
column, both audited for reachability by the orphan-page check described below. A dropdown/menu
for "Use cases" was considered and deliberately not built this phase — a new interactive nav
component adds real accessibility surface (keyboard nav, focus management) for a discoverability
problem the homepage section and footer already solve without it; revisit only if traffic data
later shows the header entry point is actually needed.

## Vertical pages (`/for/*`)

Each links to:

- The platform hub (`/platforms`) and any specifically relevant platform guides (see the map).
- Relevant crawler-directory entries (`relatedCrawlerSlugs` frontmatter field).
- Relevant guides (`relatedGuideSlugs` frontmatter field).
- `/sample-report`, `/methodology`, `/pricing`, `/audit` — the same core conversion surfaces every
  other marketing page links to.

## Platform guides (`/platforms/*`)

Each links to:

- The platform hub (parent).
- Any verticals that specifically reference this platform (e.g. `/platforms/vercel` ↔
  `/for/saas-and-documentation`).
- Relevant guides and crawler-directory entries.
- `/audit` (the platform-specific CTA, "Audit your deployed policy").

## Platform hub (`/platforms`)

Links to every published platform guide (never a guide that hasn't actually been published — see
`docs/seo/CONTENT_FRESHNESS_AND_REVIEW_POLICY.md`'s status vocabulary; a `deferred`-status platform
never gets a hub link) and back to the 4 vertical pages.

## Crawler directory and guides

Existing pages (`/crawlers`, `/crawlers/[slug]`, `/guides`, `/guides/[slug]`) gain platform-guide
links only where genuinely relevant — e.g. a guide specifically about a CDN-generated
`robots.txt` quirk may link to the matching `/platforms/*` guide via a manually-curated
`relatedPlatformSlugs`-equivalent addition, not an automatic keyword match. No blanket "see also:
all platforms" block was added to unrelated pages.

## Reports (private/anonymous)

No SEO links were added to `/audit/[auditId]` or `/shared/[token]` — both remain `noindex` and
receive no internal-link changes from this phase, per the phase prompt's explicit rule.

## Link-text rule

Every link added by this phase uses descriptive anchor text (e.g. "Cloudflare AI crawler policy
guide", never "click here" or bare "read more"). Confirmed by `pnpm content:validate`'s link-text
check (see `docs/seo/SEO_CONTENT_GOVERNANCE.md`'s Phase 7 addendum).

## Orphan-page prevention

Every new page has at least one inbound link from an already-indexed page (the homepage's new
verticals section, the header nav, and the footer's new links collectively guarantee this for all
4 verticals and the platform hub; each platform guide is additionally linked from the hub and from
at least one vertical page per the map above). `apps/web/tests/e2e/seo-metadata.spec.ts` is
extended this phase to assert every sitemap-listed Phase 7 route is reachable via at least one
internal link from the homepage's link graph (breadth-first, depth ≤ 3) — see the Phase 7
completion report's test-evidence section.

## Footer

`apps/web/src/components/SiteFooter.astro` gains a fifth column ("Solutions") with links to all
four vertical pages plus the platform hub — see the phase prompt's explicit footer requirement.
The footer's grid (`md:grid-cols-[1.2fr_1fr_1fr_1fr]`, 4 columns) becomes
`md:grid-cols-[1.1fr_1fr_1fr_1fr_1fr]` (5 columns) to accommodate this without shrinking existing
columns disproportionately — verified at 768px/1024px/1280px+ per the phase's responsive
requirements.
