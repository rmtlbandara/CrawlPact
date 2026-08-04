# Content review checklist (Phase 7)

Human/agent checklist run against every new or materially changed `/for/*` or `/platforms/*` page
before it is committed. Automatable items are also enforced by `pnpm content:validate`; the
checklist exists because some items (uniqueness of value, accuracy of source interpretation)
cannot be fully automated.

## Frontmatter

- [ ] Required fields present and non-empty (see the relevant content standard).
- [ ] `title`/`description` unique across the whole site, not just within the collection.
- [ ] Dates are real (ISO `YYYY-MM-DD`), not placeholder or future-dated.
- [ ] `platformDocsVerifiedDate` (platform guides) reflects an actual recheck performed this
      session, not copied from a template.

## Sources (platform guides)

- [ ] Every technical claim traces to a `docs/seo/PLATFORM_CLAIM_SOURCE_REGISTER.md` entry.
- [ ] Every source was actually fetched and read this session (not remembered/assumed).
- [ ] `officialSources` frontmatter matches the visible "Official references" section exactly.
- [ ] No claim contradicts another already-published CrawlPact page.

## Content

- [ ] Every required section (per the content standard) is present and non-generic.
- [ ] No prohibited claim (see the content standard's "Do not claim" list).
- [ ] No fabricated statistic, testimonial, author, or credential.
- [ ] No public country, jurisdiction, address, registration number, tax ID, or phone number.
- [ ] Pricing/plan references read from the live catalog, never hard-coded.
- [ ] Page is substantively unique versus every sibling page in the same collection.

## Technical SEO

- [ ] `canonicalPath` set, self-referencing, matches the actual route.
- [ ] `breadcrumbs` prop set and matches the visible hierarchy.
- [ ] Exactly one `<h1>`.
- [ ] CTA routes resolve (audit, sample report, pricing).
- [ ] Page added to `apps/web/src/pages/sitemap.xml.ts`'s relevant `getCollection()` call (should
      already be automatic once the content collection entry exists — verify it actually appears
      in a local sitemap build).

## Accessibility and responsive

- [ ] Passes `pnpm test:a11y` for this route.
- [ ] No horizontal overflow at 360/768/1280px (responsive-smoke suite).

## Sign-off

- [ ] Reviewed and approved for publication by the responsible human product owner (see
      `docs/seo/AI_ASSISTED_CONTENT_GOVERNANCE.md`'s "Reviewer responsibility") — recorded via the
      pull request review, not a separate sign-off document.
