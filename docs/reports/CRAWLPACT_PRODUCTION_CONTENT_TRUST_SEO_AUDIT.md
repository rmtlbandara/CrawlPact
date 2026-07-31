# CrawlPact Production Content, Trust, SEO and SaaS Authority — Phase 1 Audit

**Scope of this report:** originally Phase 1 (baseline + fresh production audit + official-source
research) only, per an explicit scoping decision made with the product owner on 2026-07-30. After
this audit was written and reviewed, the product owner approved proceeding with the P0/P1 action
list below (excluding the legal-identity gap, which stays an explicit blocker, and the Cloudflare
AI-bot-blocking `robots.txt` question, which stays a separate pending decision). **§17
("Implementation log") records exactly what was subsequently changed and verified; everything
above §17 is the original as-audited findings and is left as originally written except for one
correction noted inline where a finding turned out to be inaccurate (§4 item 2 / §8).**

Audit date: 2026-07-30. Method: automated read-only research across three parallel passes —
(1) repository/documentation inspection, (2) live HTTP crawl of `https://crawlpact.com/`,
(3) cross-check of the crawler registry against each operator's own current documentation.

---

## 1. Executive summary

CrawlPact's public site is substantially more mature than a typical early-stage SaaS: the legal,
security, methodology, and scoring pages contain real, specific, non-boilerplate prose; the
crawler and guide content is genuinely differentiated per page rather than templated; security
headers and host canonicalization are implemented correctly; and the crawler registry is,
overall, accurate against primary sources (20 of 21 entries verified clean). The core problems
found are not "the product is thin" — they are specific, fixable inconsistencies between what the
site _says_ about itself and what is _actually_ true or _actually_ implemented:

- A literal **"Draft — not yet reviewed by a lawyer"** banner is still live on the privacy policy
  — one of the exact phrases the originating task brief calls out as never to publish.
- The public `/status` page lists **"Super Admin Control Center"** as a capability-availability
  row — an internal admin surface exposed on a customer-facing trust page — and has no incident
  history or component-level health model at all; it is a feature checklist, not a status page.
- **No legal entity, registered address, jurisdiction, or support contact channel exists anywhere**
  in the repository — confirmed as a genuine gap, not an oversight in this audit's search. Per the
  product owner's direction, this is recorded below as a **release blocker**, not filled in with
  invented details.
- Three genuine leaks of internal requirement-ID language (`SRS FR-REG-005`, `SRS FR-REC-004`,
  `SRS §28.20`) reach user-facing surfaces: a homepage FAQ entry (also baked into its `FAQPage`
  JSON-LD, so search engines see it too), a public guide, and an admin-facing error string.
- **RESOLVED (2026-07-31, see §24):** CrawlPact's own production `robots.txt` previously
  disallowed GPTBot, ClaudeBot, Google-Extended, CCBot, Applebot-Extended, Amazonbot, Bytespider,
  and `meta-externalagent` from crawling `crawlpact.com` itself, via a Cloudflare-managed
  "Managed content" injection — a company whose entire product is about auditing exactly this
  kind of policy was blocking the exact crawlers it covers from its own marketing and guide
  content. The product owner disabled Cloudflare's Managed robots.txt / AI-bot-blocking feature
  directly in the dashboard; independently re-verified by fetching live production `robots.txt`,
  which now contains only the site's own source-controlled directives.
- A real, mechanical **SEO defect**: canonical tags on roughly 39 of the site's 62 sitemap URLs
  (every individual crawler and guide detail page) point at a non-trailing-slash URL that itself
  307-redirects to the trailing-slash URL that actually serves the page — a self-referencing
  canonical that isn't actually self-referencing.
- Google Analytics is confirmed **intentional** (product-owner decision, reaffirmed in this
  session after an earlier same-day decline was superseded by the actual merge to production).
  It is accurately disclosed in `privacy.astro`. The open item is narrower than "should GA be
  there": it sets tracking cookies (`_ga`, `_ga_*`) sitewide with **no cookie-consent mechanism
  anywhere in the codebase**, which the repository's own `docs/status/KNOWN_RISKS.md` already
  flags honestly.
- The crawler registry is in good shape: 20/21 entries verified against primary sources, one dead
  citation URL (Google-Extended), and one concrete content gap (Amazon's `Amzn-SearchBot` /
  `Amzn-User` tokens, documented by Amazon but not yet in CrawlPact's registry).

Nothing found in this audit requires walking back CrawlPact's core concept, its deterministic
evaluation model, or its non-negotiable product principles. The findings are about accuracy,
consistency, and a small number of exposed internals — not about the underlying product being
wrong.

---

## 2. Repository / production commit comparison

| Reference point                                          | Commit                                       | Status                                                                                                                                                                              |
| -------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local checkout (`feat/google-analytics-marketing-pages`) | `9f50403`                                    | Working tree clean                                                                                                                                                                  |
| `origin/main` (fetched fresh)                            | `fa50595` (merge of PR #56)                  | Contains `9f50403`'s change set                                                                                                                                                     |
| "Reference commit" cited in the originating task brief   | `fa50595`                                    | **Identical** to current `origin/main` HEAD                                                                                                                                         |
| Production (`https://crawlpact.com/`)                    | Not directly queryable (no version endpoint) | Behaviorally consistent with `fa50595` — confirmed via live CSP headers already allowing `googletagmanager.com`/`google-analytics.com`, matching the GA feature merged in `fa50595` |

**No drift found.** Local, remote `main`, the task brief's reference commit, and the deployed
production site are all at the same effective state. This means the task brief was prepared
against exactly today's `main`, and Phase 1's "compare local vs. remote vs. production vs.
reference" step resolves to: they match.

---

## 3. Route inventory

### Public/marketing (all indexable unless noted; `MarketingLayout`)

| Route                                | Exists                                                 | Production status                       | Canonical correctness                  | Notes                                                                |
| ------------------------------------ | ------------------------------------------------------ | --------------------------------------- | -------------------------------------- | -------------------------------------------------------------------- |
| `/`                                  | Yes                                                    | 200                                     | Correct                                | 12-H2 homepage, FAQ + `FAQPage` JSON-LD                              |
| `/about`                             | Yes (not in SRS §11's route list, but present in code) | 200 (via 307→`/about/`)                 | Correct                                | Short, positioning-statement style                                   |
| `/audit`                             | Yes                                                    | 200 (via 307)                           | Correct                                | Free-audit funnel landing page                                       |
| `/audit/:id`                         | Yes                                                    | noindex (SSR report)                    | n/a                                    | Correctly excluded from sitemap/index                                |
| `/pricing`                           | Yes                                                    | 200 (via 307)                           | Correct                                | 4 tiers                                                              |
| `/tools` + 5 tool pages              | Yes                                                    | 200 (via 307)                           | Correct                                | See §7                                                               |
| `/crawlers` + `/crawlers/{slug}` ×20 | Yes                                                    | 200 (hub via 307; detail pages via 307) | **Detail pages: broken (see §8 P1-1)** |                                                                      |
| `/guides` + `/guides/{slug}` ×19–20  | Yes                                                    | 200 (hub via 307; detail pages via 307) | **Detail pages: broken (see §8 P1-1)** |                                                                      |
| `/methodology`                       | Yes                                                    | 200 (via 307)                           | Correct                                | Genuine depth                                                        |
| `/scoring`                           | Yes                                                    | 200 (via 307)                           | Correct                                |                                                                      |
| `/scanner`                           | Yes                                                    | 200 (no redirect)                       | Correct                                | Discloses scanner boundaries plainly                                 |
| `/security`                          | Yes                                                    | 200 (via 307)                           | Correct                                | Real, specific content                                               |
| `/privacy`                           | Yes                                                    | 200 (via 307)                           | Correct URL, **content problem**       | See §5 P0-1                                                          |
| `/terms`                             | Yes                                                    | 200 (via 307)                           | Correct                                | No visible effective date, see §5                                    |
| `/acceptable-use`                    | Yes                                                    | 200 (via 307)                           | Correct                                | No visible effective date                                            |
| `/limitations`                       | Yes                                                    | 200 (via 307)                           | Correct                                |                                                                      |
| `/status`                            | Yes                                                    | 200 (no redirect)                       | Correct URL, **content problem**       | See §6                                                               |
| `/changelog`                         | Yes                                                    | 200 (no redirect)                       | Correct                                | Real dated entries                                                   |
| `/trust`                             | **Does not exist**                                     | 404 (clean, correct 404 template)       | n/a                                    | No internal links point to it — not an orphaned link, simply unbuilt |
| `/sign-in`                           | Yes                                                    | 200, correctly `noindex,nofollow`       | Correct                                | Passkey/WebAuthn, no password/email                                  |
| `/shared/[token]`                    | Yes                                                    | noindex                                 | n/a                                    | Correct                                                              |
| `/robots.txt`                        | Yes (static file)                                      | 200                                     | —                                      | See §9 for content concerns                                          |
| `/sitemap.xml`                       | Yes (generated)                                        | 200, 62 URLs                            | —                                      | See §8                                                               |
| `/llms.txt`                          | **Does not exist**                                     | 404 (clean)                             | n/a                                    | On-brand gap given product subject matter                            |
| `/.well-known/security.txt`          | **Does not exist**                                     | 404 (clean)                             | n/a                                    | On-brand gap; task brief explicitly asks for this                    |

### Authenticated app (`AppLayout`, all correctly `noindex`)

`app/`, `app/account`, `app/billing`, `app/domains` (+ `[domainId]`), `app/groups`,
`app/notifications` — not in scope for public trust/SEO work, confirmed correctly non-indexable.

### Admin (`AdminLayout`, ~24 pages, all correctly `noindex`)

Dashboard, audit-logs, blocked-targets, domains, entitlements, findings, health, jobs, notices,
plans, registry/{crawlers,operators,releases,rulesets}, scans, security, settings, shared-reports,
subscriptions, transactions, users. One confirmed user-facing copy leak inside this surface, see
§10.

### API (`pages/api/`, ~90 files)

Correctly non-indexable throughout (blocked by both `robots.txt` `Disallow: /api/` and
`X-Robots-Tag`). Includes `api/test-only/*` fixture endpoints (rate-limit clear, grant-super-admin,
seed-failed-webhook) — these are test infrastructure, not customer-facing, and out of scope for
this content/trust audit.

---

## 4. SEO findings

1. **P1 — Canonical/redirect mismatch on ~39 crawler and guide detail pages.** All crawler and
   guide detail URLs (e.g. `/crawlers/gptbot`) `307`-redirect to a trailing-slash form
   (`/crawlers/gptbot/`), but the page's own `<link rel="canonical">` points at the **non-slash**
   URL — the one that immediately redirects rather than serving content. The sitemap also lists
   these URLs without trailing slashes, consistent with the (wrong) canonical but still one hop
   away from where the content actually renders. Top-level pages (`/about`, `/pricing`, etc.) get
   this right — their canonical matches the slash-form URL that actually serves `200`. Tool pages
   also get it right. Net effect: crawlers take an extra redirect hop on ~44 of 62 sitemap URLs,
   and ~39 of those additionally have a canonical tag pointing somewhere other than the page that's
   actually served. **Files likely involved:** the shared layout/prop wiring between
   `apps/web/src/pages/crawlers/[slug].astro`, `apps/web/src/pages/guides/[slug].astro`, and
   whatever computes the `canonicalPath` passed into `BaseLayout.astro`/`MarketingLayout.astro`.
2. **Correction (this finding was wrong):** the original pass here reported "no `Article`/
   `BreadcrumbList` JSON-LD on crawler or guide detail pages," based on the production-crawl
   agent's external fetch plus a stale line in `docs/seo/STRUCTURED_DATA.md`. Direct inspection of
   `apps/web/src/layouts/BaseLayout.astro` and a fresh local build (§17) showed `Article` and
   `BreadcrumbList` JSON-LD were **already correctly implemented and already live in production**
   — confirmed via a direct `curl` of `https://crawlpact.com/crawlers/gptbot/` showing both types
   in the `@graph`. What genuinely was missing (verified by inspecting actual build output, not by
   re-trusting the earlier claim): `SoftwareApplication`/`WebApplication` schema anywhere on the
   site, and `HowTo` schema on the guides that are genuinely step-numbered. Both gaps are now
   closed — see §17.
3. **P2 — Single static OG image** (`/og-image.svg`) reused across every page type (homepage,
   pricing, individual crawler pages, individual guide pages, legal pages) — no per-page or
   per-category social preview differentiation.
4. **P1 — Tool pages have near-zero static/indexable body content.** All 5 `/tools/*` pages have
   zero `<h2>` elements and near-identical body sizes (~16.5–16.8KB) in the raw HTML response,
   suggesting the actual validator UI is a client-hydrated island with little server-rendered
   unique text. If these pages are meant to rank individually for tool-intent queries ("robots.txt
   AI validator", "llms.txt validator"), a crawler that doesn't execute JavaScript will see very
   little differentiating content per tool today.
5. **P2 — robots.txt has two separate `User-agent: *` groups** — one Cloudflare-injected
   ("Managed content", which also sets the site's `Content-Signal` header default), one authored
   by the site itself (`Disallow: /api/`, `/audit/*`, `/app`, `/sign-in`, `/dev/`). Modern crawlers
   merge same-token groups per RFC 9309, so this isn't a functional break, but it's an unusual
   structure for a product whose entire pitch is "we tell you if your robots.txt is doing what you
   think it's doing."
6. Host canonicalization (http/https/www/non-www → `https://crawlpact.com/`) is implemented
   correctly with no redirect chains — no action needed.
7. Security response headers (HSTS 2yr+preload, `X-Frame-Options: DENY`,
   `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`) are strong;
   `script-src`/`style-src` retain `'unsafe-inline'` with no nonce, a disclosed, known limitation
   (already recorded in the codebase's own middleware comments) rather than a new finding.

---

## 5. Legal and privacy gaps

1. **P0 — `apps/web/src/pages/privacy.astro:13`** still renders: _"Draft — not yet reviewed by a
   lawyer. This page describes CrawlPact's actual technical data practices as implemented."_ This
   is a direct, verbatim match to a phrase the originating task brief explicitly forbids
   publishing. The factual content of the page (it does accurately disclose GA, Cloudflare,
   Paddle, and the "no third-party email/SMS/push/AI-API/auth provider" claim — see §11) is fine;
   only the draft/review-status framing needs to go.
2. **P0 — No legal entity, registered address, jurisdiction, or support/legal contact channel
   exists anywhere in the repository.** Searched `package.json`, `wrangler.jsonc`,
   `privacy.astro`, `terms.astro`, `acceptable-use.astro`, and `SiteFooter.astro` — none contain a
   company name/suffix (Inc./Ltd/LLC), address, registration number, or contact email. The footer
   renders only `© {year} CrawlPact` with no legal suffix. **Per the product owner's explicit
   direction in this session, this is recorded as a release blocker, not filled in with invented
   details.** Everything downstream that depends on it — terms' governing-law clause, privacy's
   data-controller identity, a verified security-contact address, `/.well-known/security.txt` — is
   correspondingly blocked until this is supplied.
3. **No visible effective/last-updated date on `/terms`, `/privacy`, or `/acceptable-use`.**
   `/changelog` does show real dates; the three legal pages do not, which is a common and
   meaningful trust-signal gap (neither a user nor a crawler can tell how current the policy is).
4. **Cookie consent gap.** GA (`gtag.js`) sets `_ga`/`_ga_*` cookies sitewide on every marketing
   page including `/sign-in` and the 404 template. No cookie-consent banner or mechanism exists
   anywhere in the codebase. This is already honestly disclosed in
   `docs/status/KNOWN_RISKS.md`. Whether consent is _legally required_ depends on the operator's
   jurisdiction and visitor mix — which cannot be determined until item 2 above (legal
   entity/jurisdiction) is resolved. This is flagged as an open item, not resolved by this audit.
5. Terms/acceptable-use/privacy content itself (once the draft banner and dates are fixed) reads
   as unusually specific and non-boilerplate for a SaaS at this stage — named third parties
   (Cloudflare, Paddle, Google Analytics), specific technical claims (SSRF protections, webhook
   signature verification) rather than generic legal filler. This is a genuine strength worth
   preserving, not diluting, in any rewrite.

---

## 6. Status-page gaps

`apps/web/src/pages/status.astro` is confirmed to be **a feature-availability checklist, not a
real uptime/incident status page**. It renders a static list — "Public website", "Free audit (real
scan)", "Account registration (passkeys)", "Saved domains and monitoring", "Paddle billing", and
**"Super Admin Control Center"** — each showing "Available" / "Disabled in this environment" / "Not
configured in this environment", sourced from `getEnv().AUDIT_ENGINE_ENABLED` and
`getAdminEnvironment().paddleBillingConfigured`.

Problems:

- **P0 — "Super Admin Control Center" is listed as a public capability-availability row.** This is
  an internal admin surface being described, by name, on a customer-facing trust page — exactly
  the pattern the originating task brief warns against.
- No component-level health history, no incident log, no uptime percentage, no "last checked"
  timestamp — this is architecturally a feature list, not a status page. The database schema
  confirms there is **no `incidents`/`status_events` table anywhere** — a real historical status
  page would need new, additive schema (a genuine implementation task, not a copy fix).
- The page does self-disclose honest intent ("this page states plainly what is and is not enabled
  right now, rather than implying capabilities that do not exist yet") and links to
  `docs/status/IMPLEMENTATION_STATUS.md` — the honesty framing is good; the actual page concept
  is the wrong one for what a "status page" should be.

---

## 7. Free-tool findings

Five tools exist and are all reachable and correctly metadata-tagged (unique titles/descriptions,
correct self-referencing canonicals — this is the one page type where canonicalization is fully
correct): AI crawler checker, robots.txt AI validator, RSL validator, llms.txt validator, Content
Signals checker.

- **P1** — as noted in §4, all five have effectively zero static/server-rendered body content
  (0 `<h2>`s, ~16.5–16.8KB near-identical bodies) — the interactive widget appears to be entirely
  client-hydrated with no meaningful static explanatory copy alongside it. The task brief calls for
  "what this checks" / "what this does not check" / supported-input examples / output
  interpretation / related crawlers-guides-tools sections on each tool page — none of that appears
  to exist as indexable static content today, though it may exist and simply not render without JS
  (a real limitation of this audit's non-browser method, noted honestly rather than assumed).
- `/tools` hub itself renders correctly as a navigational hub linking to all five.
- Tool output correctness against the shared parser (packages/policy, packages/robots) was **not**
  verified in this pass — that requires exercising the tools' actual JS-driven validation logic,
  which is an implementation/testing-phase concern, not a static-content audit concern.

---

## 8. Crawler-directory / guide-quality findings

**Crawler directory (`/crawlers`):** hub page groups by 8 purpose categories (Search, Training,
User-triggered, Agent/action, Advertising/validation, Research, Mixed, Unknown) — good taxonomy.
20 detail pages sampled/spot-checked are genuinely distinct (~18.5–19.4KB bodies each, not
templated boilerplate with a name swapped in), each citing an official source URL and referencing
"the last-verified date" in prose (though not in a structured, machine-readable format — see §4
item 2 on missing `Article` schema, which would be the natural place for `dateModified`).

**Guides (`/guides`):** 19–20 guide pages, query-shaped titles ("GPTBot vs. OAI-SearchBot vs.
ChatGPT-User: which should you block?"), genuine step-numbered how-to depth in at least one sample
("How to publish an llms.txt file" — 7 H2s, Steps 1–5 plus a "What this doesn't do" caveat
section), and consistent "Related guides" internal linking. No padding/filler observed in the
sampled pages.

**Registry accuracy (full findings in the standalone registry-verification pass):**

| Finding                              | Priority           | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------ | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google-Extended citation URL is dead | P1                 | `.../search/docs/crawling-indexing/google-extended` now 404s; live content moved to `.../search/docs/crawling-indexing/google-common-crawlers` (confirmed current, updated 2026-07-14)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Amazon token gap                     | P1                 | Amazon's own docs separately publish `Amzn-SearchBot` (search) and `Amzn-User` (user-triggered), distinct from the single `Amazonbot` ("mixed") CrawlPact currently registers — inconsistent with how every other multi-token operator (OpenAI, Anthropic, Perplexity, Meta) is already split out                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Google doc-platform migration risk   | P2                 | A second, parallel `developers.google.com/crawling/...` doc tree now exists alongside the older `search/docs/crawling-indexing/...` tree — a near-term staleness risk for all 4 Google registry entries; recommend re-verifying within 1–2 registry cycles                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Bingbot unverifiable                 | P2 (already known) | JS-rendered official page; this audit hit the same wall the repo's own `docs/registry/SOURCE_VERIFICATION_POLICY.md` already discloses. No new fix available without headless-fetch tooling                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Meta-ExternalAgent casing            | P2                 | Meta's own docs render the token lowercase (`meta-externalagent`); functionally irrelevant since UA matching is case-insensitive per RFC 9309 §2.3, cosmetic only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Everything else (18 of 21 entries)   | —                  | Verified accurate — exact token match, correct purpose classification, live official source, high confidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Standards-maturity language risk     | P1                 | RFC 9309 is a genuine IETF Proposed Standard. **llms.txt is an informal community proposal with no standards-body backing at all.** RSL 1.0 is a real, versioned, industry-consortium-governed spec (not IETF/W3C). **Content Signals is a single vendor's (Cloudflare's) September-2025 proposal that Google's own Search Advocate has publicly said has "no effect whatsoever" on real crawlers today** — a competing, more formal IETF effort (AIPREF, targeting IESG submission ~August 2026) exists in parallel. Any CrawlPact copy calling llms.txt/RSL/Content Signals a "standard" without qualification should be checked and, if found, tightened — this was **not** checked at the string level in this pass and should be a specific grep task before any content-language cleanup phase. |

---

## 9. CrawlPact's own crawler policy (self-consistency)

The originating task brief specifically calls for CrawlPact to audit its own declared crawler
policy, since the product's credibility partly rests on practicing what it audits. This surfaced
the single most notable finding of this pass:

- **P0 — CrawlPact's own production `robots.txt` blocks the exact crawlers its product is about.**
  The Cloudflare-managed block in `robots.txt` (see full text below) disallows `Amazonbot`,
  `Applebot-Extended`, `Bytespider`, `CCBot`, `ClaudeBot`, `CloudflareBrowserRenderingCrawler`,
  `Google-Extended`, `GPTBot`, and `meta-externalagent` from crawling `crawlpact.com` at all —
  including its marketing pages, its crawler-reference pages, and its guides.

  ```
  User-agent: *
  Content-Signal: search=yes,ai-train=no,use=reference
  Allow: /

  User-agent: Amazonbot
  Disallow: /
  User-agent: Applebot-Extended
  Disallow: /
  User-agent: Bytespider
  Disallow: /
  User-agent: CCBot
  Disallow: /
  User-agent: ClaudeBot
  Disallow: /
  User-agent: CloudflareBrowserRenderingCrawler
  Disallow: /
  User-agent: Google-Extended
  Disallow: /
  User-agent: GPTBot
  Disallow: /
  User-agent: meta-externalagent
  Disallow: /
  ```

  This block is auto-injected by Cloudflare (likely via a dashboard-level "Block AI bots" toggle
  or similar managed feature, not something authored in `apps/web/public/robots.txt` directly —
  the site's own authored block only contains the `/api/`, `/audit/*`, `/app`, `/sign-in`, `/dev/`
  rules). Whether this was a deliberate choice or an unexamined Cloudflare default was **not**
  determined in this pass and needs a decision from the product owner: a company whose product is
  "audit and monitor your AI crawler policy" blocking exactly those crawlers from its own
  guides/crawler-reference content will reduce its own visibility in AI-native
  search/answer/training surfaces, which directly cuts against the SEO/content-authority goal this
  whole workstream is for.

- No `/llms.txt` exists for CrawlPact's own domain (the product validates _other_ sites' llms.txt
  files but doesn't publish its own) — an on-brand, low-cost addition if the product owner wants
  to lead by example, though not a defect.
- No `/.well-known/security.txt` exists — the originating task brief explicitly asks for this;
  currently a clean gap, not implemented.

---

## 10. Admin-copy / internal-language leakage findings

`rg -n 'SRS|§[0-9]|FR-[0-9]|NFR-[0-9]|implementation step|Part [0-9]' apps/web/src` returned 269
matches. The overwhelming majority are in code comments (JSDoc, `//`, frontmatter) — a documented,
intentional project convention of citing SRS sections in comments, which is fine and out of scope
to change. **Three matches reach an actual rendered, user-facing string:**

1. **`apps/web/src/pages/index.astro:54`** — a homepage FAQ entry's visible text ends with
   "**(SRS FR-REG-005)**." This string is also baked verbatim into the page's `FAQPage` JSON-LD
   (per `docs/seo/STRUCTURED_DATA.md`, the schema is generated from the same array the visible FAQ
   renders), so the internal requirement ID reaches search-engine structured-data consumers, not
   just human visitors reading the FAQ accordion.
2. **`apps/web/src/content/guides/robots-txt-syntax-basics.md:28`** — public guide content ends a
   sentence with "**(SRS FR-REC-004)**."
3. **`apps/web/src/pages/api/auth/passkeys/[credentialId]/remove.ts:41`** — an API error message
   shown to an authenticated admin user reads: "Administrator accounts must keep at least two
   registered passkeys **(SRS §28.20)**. Add another one first." This is admin-facing rather than
   public, but still a rendered UI string, not a comment.

All three are small, mechanical fixes (delete the parenthetical citation, keep the substantive
sentence) — no content meaning is lost by removing the internal reference.

---

## 11. Analytics / cookie findings

- Google Analytics (`gtag.js`, measurement ID `G-1W5HP7S561`) is confirmed **intentional**. Timeline:
  declined earlier the same day it was ultimately added (2026-07-30), then merged to production as
  PR #56 later that day, then reaffirmed explicitly by the product owner in this session — the
  SRS §6.2 "no external analytics vendors" provision is superseded specifically for this case, not
  generally repealed (a new _different_ third-party tracker request would still warrant the same
  conversation).
- The integration is well-contained: `apps/web/src/components/GoogleAnalytics.astro`, included only
  from `MarketingLayout.astro` gated on `PUBLIC_APP_ENV === "production"` — never on
  `AppLayout`/`AdminLayout`, never in local/preview. The component's own comment correctly
  documents this as a disclosed SRS §6.2 deviation.
- `privacy.astro` already accurately discloses GA's presence and scope (quoted in §5) — this is
  **not** a stale/inaccurate claim, contrary to what might be assumed from the "no third-party
  analytics" framing elsewhere in the product's history.
- **Open item, not resolved by this audit:** no cookie-consent mechanism exists anywhere, and GA
  sets tracking cookies on every marketing-page visit including `/sign-in` and the 404 page. This
  is already honestly recorded in `docs/status/KNOWN_RISKS.md`. Resolving it correctly requires
  knowing the operating jurisdiction (see §5 item 2, the legal-entity blocker) — it is not
  something this audit can respond to with a specific mechanism recommendation until that's known.
- Cloudflare's own Web Analytics beacon (`static.cloudflareinsights.com`) is independently blocked
  by the current CSP and can't be enabled without a further CSP change — a separate, already
  disclosed, unresolved decision point (per `docs/status/KNOWN_RISKS.md`), distinct from the GA
  situation.
- CSP hand-sync risk: `middleware.ts` and `apps/web/public/_headers` both define security headers
  independently ("keep both in sync by hand; there's no single source both read from," per the
  middleware's own comment) — a real drift risk if one is edited without the other, worth
  addressing structurally in a later implementation pass.

---

## 12. Security and privacy concerns

No new security defects were found in this pass (this was a content/trust/SEO audit, not a
security audit — `docs/security/THREAT_MODEL.md` was last touched 2026-07-30 and a dedicated
security review would need its own pass). Relevant observations that intersect with trust/content:

- Security headers are strong overall (see §4 item 7).
- `/security` page content is specific and credible (SSRF protections, Paddle webhook signature
  verification named explicitly) — a genuine trust asset, not filler, and should be preserved.
- No secrets, credentials, or exploitable implementation detail were exposed in any of the fetched
  public pages.
- The admin-facing passkey-removal error string leaking `SRS §28.20` (§10 above) is a minor
  information-disclosure-adjacent issue (reveals internal spec-numbering convention to an
  authenticated admin, not a security boundary in itself) rather than a security defect.

---

## 13. Artwork recommendation (not implemented in this phase)

The originating task brief calls for an original homepage artwork ("Policy Evidence Map" concept:
a website node feeding bounded public resources — robots.txt, HTTP headers, meta directives,
llms.txt, RSL, Content Signals — into four purpose lanes (Search/Training/User-triggered/Agents)
resolving into Evidence/Findings/Recommendations/Monitoring history).

**Recommendation, pending product-owner approval to proceed to implementation:** build this as an
inline, locally-stored SVG/CSS illustration (no image-generation service, no R2 asset) —
consistent with the task brief's own preference and with this repo's existing pattern of
componentized, source-controlled UI (`packages/ui`). Fixed aspect ratio to avoid layout shift,
`aria-hidden="true"` with nearby explanatory HTML text, CSS-only motion (disabled under
`prefers-reduced-motion`), no cartoon/anthropomorphic imagery. This is scoped as **future work**
— not built as part of this Phase 1 audit.

---

## 14. Prioritized action list

### P0 — should be resolved before calling the public site "trustworthy" in the sense this workstream targets

1. Remove the "Draft — not yet reviewed by a lawyer" banner from `apps/web/src/pages/privacy.astro:13`.
2. Resolve the missing legal-entity/address/jurisdiction/contact-channel gap — **currently
   recorded as a release blocker per product-owner direction**, not fabricated. (§5 item 2)
3. Remove "Super Admin Control Center" from the public `/status` page's capability list;
   `apps/web/src/pages/status.astro`. (§6)
4. Remove the three internal-requirement-ID leaks: `index.astro:54` (+ its `FAQPage` JSON-LD),
   `content/guides/robots-txt-syntax-basics.md:28`, `pages/api/auth/passkeys/[credentialId]/remove.ts:41`. (§10)
5. ~~Get an explicit product-owner decision on whether CrawlPact's own `robots.txt` should
   continue blocking GPTBot/ClaudeBot/Google-Extended/CCBot/Applebot-Extended/Amazonbot/
   Bytespider/meta-externalagent from crawling `crawlpact.com`~~ — **RESOLVED 2026-07-31**: the
   product owner disabled the Cloudflare feature responsible; independently re-verified against
   live production. See §24. (§9)

### P1 — real defects worth fixing in the implementation phase

6. Fix the canonical/redirect mismatch on crawler and guide detail pages (~39 URLs). (§4 item 1)
7. Add visible effective/last-updated dates to `/terms`, `/privacy`, `/acceptable-use`. (§5 item 3)
8. ~~Add `Article`/`HowTo`/`BreadcrumbList` structured data to crawler and guide detail pages.~~
   `Article`/`BreadcrumbList` were already present (original finding was wrong, see §4 item 2
   correction); `WebApplication` and `HowTo` were genuinely missing and have been added — done,
   see §17.
9. Investigate whether `/tools/*` pages need server-rendered static explanatory content alongside
   the client-hydrated validator widgets, for both SEO and the task brief's "what this checks /
   doesn't check" requirement. (§7)
10. Fix the dead Google-Extended registry citation URL. (§8)
11. Add `Amzn-SearchBot` / `Amzn-User` as separate registry entries, consistent with how other
    multi-token operators are modeled. (§8)
12. Grep all public copy for unqualified "standard" claims about llms.txt / RSL / Content Signals
    and tighten language where found (not yet checked at the string level). (§8)
13. Decide on and implement a cookie-consent mechanism for GA, once legal jurisdiction (P0-2) is known. (§11)
14. Structurally unify CSP/security-header definitions (`middleware.ts` vs. `public/_headers`) to
    remove the hand-sync drift risk. (§11)
15. Re-verify all four Google registry entries again within 1–2 registry cycles given Google's
    documentation-platform migration. (§8)

### P2 — polish, lower priority

16. Add `/.well-known/security.txt` and consider a `/llms.txt` for CrawlPact's own domain. (§9)
17. Diversify the single reused `/og-image.svg` across page types/categories. (§4 item 3)
18. Consider consolidating the two `User-agent: *` groups in `robots.txt` for clarity. (§4 item 5)
19. Minor copy fix: near-duplicate "Related crawler"/"Related crawlers" heading text on at least
    one crawler page (PerplexityBot). (§8)
20. Evaluate whether a `/trust` page/section adds value beyond what `/security`, `/privacy`,
    `/status`, `/methodology` already cover, per the task brief's "only if it improves navigation"
    guidance. (§3)
21. If a real historical status page (component health + incident log) is later approved, it will
    need new, additive database schema (`incidents`/`status_events` — none exists today). (§6)

---

## 15. Evidence index / files affected (for implementation-phase reference)

- `apps/web/src/pages/privacy.astro` (draft banner, line 13)
- `apps/web/src/pages/status.astro` (Super Admin Control Center row)
- `apps/web/src/pages/index.astro` (line 54, FAQ + FAQPage JSON-LD)
- `apps/web/src/content/guides/robots-txt-syntax-basics.md` (line 28)
- `apps/web/src/pages/api/auth/passkeys/[credentialId]/remove.ts` (line 41)
- `apps/web/public/robots.txt` and Cloudflare dashboard-level bot-blocking configuration (source of the Cloudflare-managed block — not in this repo)
- `apps/web/src/pages/crawlers/[slug].astro`, `apps/web/src/pages/guides/[slug].astro`, and shared canonical-URL wiring in `BaseLayout.astro`/`MarketingLayout.astro`
- `apps/web/src/pages/sitemap.xml.ts`
- `packages/database/seed/reference-data.sql` (Google-Extended citation URL, Amazon token gap)
- `apps/web/src/middleware.ts` and `apps/web/public/_headers` (CSP hand-sync risk)
- `apps/web/src/pages/terms.astro`, `apps/web/src/pages/acceptable-use.astro` (missing effective dates)
- `apps/web/src/pages/tools/*.astro` (thin static content)
- `apps/web/src/components/SiteFooter.astro` (no legal entity/contact info)

---

## 16. What §1–§15 originally covered

Everything above this point is the original Phase 1 audit as first delivered: read-only research,
no repository changes. The product owner then reviewed it and approved proceeding with the P0/P1
list (excluding the two items noted in §17), which is what §17 records.

---

## 17. Implementation log (post-audit, same session)

Following product-owner approval to proceed ("don't block anything... go ahead," with two
explicit carve-outs kept as blockers: the legal-entity/jurisdiction gap, and the Cloudflare
AI-bot-blocking `robots.txt` question — both require the product owner's own input/decision and
were correctly not resolved unilaterally), the following changes were made, verified, and are
reflected in the working tree:

**P0 fixes:**

- Removed "Draft — not yet reviewed by a lawyer" from all three pages that had it — `privacy.astro`
  (the only one the original audit caught), plus `terms.astro` and `acceptable-use.astro` (found
  during implementation via a repo-wide grep the original audit hadn't run for this exact phrase).
- Removed "Super Admin Control Center" from the public `/status` capability list
  (`status.astro`).
- Removed all three internal `SRS FR-xxx`/`§xx` leaks from user-facing strings: the homepage FAQ
  entry + its auto-generated `FAQPage` JSON-LD (`index.astro`), the public guide
  (`robots-txt-syntax-basics.md`), and the admin-facing passkey-removal error string (`remove.ts`).

**P1 fixes:**

- Fixed the canonical/redirect mismatch: `canonicalPath` in `crawlers/[slug].astro` and
  `guides/[slug].astro` now includes the trailing slash that matches the URL Cloudflare actually
  serves (verified by rebuilding and inspecting output HTML: canonical now reads
  `https://crawlpact.com/crawlers/gptbot/`, matching the served path exactly). `sitemap.xml.ts`
  updated to match. Internal "Related guides"/"Related crawlers" links and the hub-page links in
  `guides/index.astro`/`crawlers/index.astro` were also updated to the trailing-slash form, so
  internal navigation no longer takes an unnecessary extra redirect hop either.
- Added a visible "Effective and last updated: 30 July 2026" line to `/privacy`, `/terms`, and
  `/acceptable-use`. Removed `terms.astro`'s "once the product reaches general availability"
  hedge on its Changes section, since a real date is now shown.
- Fixed the dead `Google-Extended` citation URL (both in `packages/database/seed/reference-data.sql`
  and the corresponding `apps/web/src/content/crawlers/google-extended.md`) — now points at
  `.../google-common-crawlers`, confirmed live.
- Added `Amzn-SearchBot` and `Amzn-User` as separate registry entries (`reference-data.sql`) and
  matching public crawler pages (`content/crawlers/amzn-searchbot.md`,
  `content/crawlers/amzn-user.md`), consistent with how OpenAI/Anthropic/Perplexity/Meta are
  already split by purpose. Source URL for both (`developer.amazon.com/amazonbot`) was verified
  directly by fetching the page and confirming it documents all three Amazon tokens, rather than
  assumed. **This corrects the live seed/reference data and the public content pages, but does
  not by itself update the already-seeded production database** — `reference-data.sql` is
  `INSERT OR IGNORE`, so it has no effect on rows that already exist there. Per the registry's own
  immutable-release model, making this the active registry release requires a proper publish
  action (a new version, e.g. `2026.07.4`) through the registry-manager workflow, not a raw SQL
  edit — noted as a manual follow-up in `docs/registry/CRAWLER_REGISTRY_GOVERNANCE.md` rather than
  done unilaterally, since it means changing what a live production database considers "active."
- Checked public guide/crawler copy for unqualified "standard" claims about `llms.txt`/RSL/Content
  Signals (the audit's own suggested follow-up). **No fix was needed** — existing copy already
  hedges accurately ("community-proposed convention (not an IETF or W3C standard)" for llms.txt,
  "emerging... specification" for RSL, "emerging convention" for Content Signals). All "standard"
  occurrences found refer correctly to "standard `robots.txt` disallow rules," which is accurate.
- Added `Article`/`HowTo`/`BreadcrumbList`/`WebApplication` structured data — with a correction to
  the original finding: `Article` and `BreadcrumbList` turned out to already exist (see §4 item 2
  correction above). What was genuinely added: a `WebApplication` node on `/pricing`, built
  directly from the same `plans` array the visible pricing table already renders (no separate,
  driftable copy of pricing data — offers reflect the real Free/Solo/Pro/Agency prices), and a
  `HowTo` node on guides that have genuine `Step N:` headings (4 guides qualified; guides without
  real step structure correctly get no `HowTo` node rather than a fabricated one). Required adding
  an `extraJsonLd` prop threaded through `MarketingLayout.astro` → `BaseLayout.astro`, since no
  extension point existed before.

**Verification:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:unit` (215/215),
`pnpm test:integration` (141/141, including the passkey-removal test whose error string changed),
`pnpm db:validate`, and `pnpm build` all passed after every change.

`pnpm test:a11y:chromium` was run three times across this session, surfacing a pre-existing
environment issue unrelated to any of these changes: this Astro version's `astro dev` daemonizes
into a detached background process (its own `pid`, with `astro dev stop`/`status`/`logs`
subcommands) rather than staying attached to the invoking shell. Playwright's `webServer` config
(`reuseExistingServer: true`, spawning `pnpm --filter @crawlpact/web dev`) sometimes races against
that daemonization and fails to detect the server as ready, producing `ERR_CONNECTION_REFUSED` on
every test rather than a real accessibility failure — confirmed by inspecting the actual error
text, not assumed. First run (early P0 fixes only): 76/80 passed, 4 failed on an unrelated
WebAuthn virtual-authenticator timeout, confirmed identical on the unmodified tree via
`git stash`. Second run (after the layout/structured-data changes): all 82 tests failed with
`ERR_CONNECTION_REFUSED`, diagnosed as the daemon-race above via a manual `astro dev` start (which
worked fine — the app itself had no runtime error). Third run, against a manually pre-started
dev server so `reuseExistingServer` had something real to attach to: **all 82 tests passed.**
Net result: no genuine accessibility regression from this work; the failure modes seen were either
pre-existing (WebAuthn timeout) or test-infrastructure flakiness (dev-server daemon race), never a
real WCAG violation introduced by these changes.

**Deliberately not done, and why:**

- **Legal-entity/address/jurisdiction/contact channel** — still not fabricated. Still a release
  blocker per the product owner's own explicit instruction. Everything downstream of it (terms'
  governing-law clause, a real `security.txt`, a verified privacy contact) is still blocked.
- **CrawlPact's own `robots.txt` blocking GPTBot/ClaudeBot/Google-Extended/etc.** — not touched.
  This is a Cloudflare-managed injection (confirmed: `apps/web/public/robots.txt` in this repo
  only contains the site's own `/api/`, `/audit/*`, `/app`, `/sign-in`, `/dev/` rules — the
  AI-bot-blocking block is added by Cloudflare at the zone/account level, outside this repository).
  Changing it means changing live Cloudflare configuration, which CLAUDE.md requires explicit,
  in-the-moment permission for regardless of other approvals — raised separately, not resolved
  here.
- **Publishing the registry correction as a new active release** — the seed/content-file fix is
  done, but flipping which release is "active" in the live production database is a production
  data-mutation action outside a content-correction task's scope; left as a documented manual
  follow-up rather than done via ad hoc SQL.
- Remaining P1/P2 items not yet addressed at the time of §17: CSP/`_headers` hand-sync
  unification, tool-page static content depth, re-verifying the four Google registry entries
  again in 1–2 cycles, `security.txt` (blocked on legal contact info), `og-image.svg`
  diversification, and the `/trust` page decision. §18 covers what happened to these.

---

## 18. Implementation log, round 2 (Cloudflare investigation + remaining P1/P2 items)

Following the product owner's instruction to address the Cloudflare AI-bot-blocking question and
the remaining P1/P2 list before moving on:

**Cloudflare AI-bot block — investigated, not resolved.** Used the Cloudflare API (via the
connected MCP tools) to trace the exact mechanism: the zone's Bot Management configuration has an
`ai_bots_protection` setting (enum: `block` / `disabled` / `only_on_ad_pages`) that, combined with
`is_robots_txt_managed`, produces the "BEGIN Cloudflare Managed content" block found in
production's `robots.txt`. **Could not read or change this via API** — both
`GET /zones/{id}/bot_management` and `GET /zones/{id}/ai-audit/robots` returned an authentication
error, while basic zone lookups succeeded, indicating the connected API token has zone
`read`/`edit` scope but not the Bot Management permission group. This needs either broader token
permissions or a manual change in the Cloudflare dashboard (Security → Bots → "AI Scrapers and
Crawlers", set to `disabled` to stop blocking GPTBot/ClaudeBot/Google-Extended/CCBot/
Applebot-Extended/Amazonbot/Bytespider/`meta-externalagent`). No zone configuration was changed.

**CSP/`_headers` hand-sync unification — done.** Extracted the CSP and other security header
values into `apps/web/src/lib/security-headers.ts`, imported by `middleware.ts`. Since
`apps/web/public/_headers` is a static file Cloudflare reads directly and can't import that
module, added `apps/web/src/lib/security-headers.test.ts`, which reads `_headers` from disk and
asserts it matches the shared constants — turning future drift into a failing unit test rather
than a silent gap.

**Tool-page content depth — done.** All 5 `/tools/*` pages previously had only a hero paragraph
and the audit form. Added, per page: a "What this checks" list, a "What this doesn't check"
paragraph linking to `/limitations`, a "Related" list linking to the specific guides/crawlers/
methodology relevant to that tool (not generic boilerplate — e.g. the RSL validator links to the
RSL publishing guide and the RSL-vs-Content-Signals-vs-robots.txt comparison guide, not to
unrelated content), and a "Run the full audit" CTA — grounded in the actual mechanism (`AuditForm`
deep-links into `/audit/:id?focus=...`, i.e. every tool runs the same full scan and highlights one
section, which the new copy states honestly rather than implying five independent narrow tools).

**`og-image.svg` diversification — scope expanded after a real finding.** Investigating "why is
there only one OG image" surfaced a more significant problem than diversity: **Facebook, X,
LinkedIn, Slack, Discord, WhatsApp, and iMessage do not reliably render SVG for `og:image`** —
confirmed via current documentation, not assumed. This means the site's social-preview image was
likely broken (showing no image) on every platform for every page share, not merely undiversified.
Fixed by:

- Creating 4 source SVGs (`scripts/og-image-sources/*.svg`) in the existing brand style: a default
  (homepage/pricing/legal), and one each for the crawler directory, guides, and tools sections.
- Adding `scripts/generate-og-images.mjs`, which uses Playwright (already a project dependency for
  e2e/a11y tests — no new dependency, no image-generation service) to render each SVG in a real
  browser at exactly 1200×630 and screenshot it to a PNG. Run once; output committed like any
  other static asset (`apps/web/public/og/*.png`), not regenerated on every build.
- Adding an `ogImage` prop threaded through `MarketingLayout.astro` → `BaseLayout.astro` (default
  `/og/default.png`), and setting the category-specific image on the crawler/guide/tool hub pages
  and their detail pages.
- Adding `og:image:type` (`image/png`) to the meta tags.

**`/trust` page — decided against building one, no code change.** The footer's existing
"Resources" (methodology, scoring, scanner) and "Company and legal" (about, privacy, terms,
acceptable-use, security, limitations, status) columns already link every page a `/trust` hub
would summarize, on every page of the site. A new page would either duplicate those same links
with no unique content — the exact "thin/duplicate-intent" pattern flagged elsewhere in this
audit — or require building genuinely new content (a public editorial/source-governance page, a
public registry-release history beyond `/changelog`) that's out of scope for a navigation
decision. This matches the task brief's own stated fallback: "a well-designed 'Trust and
transparency' section in the footer," which was already in place.

**Verification:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck` (0 errors), `pnpm test:unit`
(221/221, up from 215 — 6 new tests for the security-headers drift check), `pnpm db:validate`, and
`pnpm build` all passed. `pnpm test:integration` showed one failure on the first run
(`billing-webhook.integration.test.ts`, a concurrent-race-condition test asserting exact webhook
ordering) — confirmed unrelated: no billing/webhook/Paddle file was touched this round, the test
passed in isolation immediately after (12/12), and the full suite passed clean on a second run
(141/141), consistent with a timing-sensitive test flaking under load from concurrent builds/tests
rather than a real regression. `pnpm test:a11y:chromium` passed 82/82 (dev server pre-started per
the daemon-race workaround documented in §17).

**Also updated:** `docs/seo/STRUCTURED_DATA.md` (corrected the stale "not yet added" notes for
`BreadcrumbList`/`Article`, added the new `WebApplication`/`HowTo` rows) and `CHANGELOG.md`.

---

## 19. Implementation log, round 3 (crawler directory, tools hub, methodology, about — Phase 7/8/10 gaps)

Continuing past the P0/P1/P2 list into the originating task brief's Phase 7 (free tools), Phase 8
(crawler directory), and Phase 10 (methodology/about) checklists, focused on concrete, verifiable
gaps rather than re-doing what was already in good shape:

- **`/crawlers` hub**: added a computed, never-hard-coded stats line (crawler-page count, distinct
  operator count, most recent verification date — all derived from the actual content collection
  at build time) and a "How entries are verified" explainer. Confirmed accurate after rebuild:
  22 crawler reference pages, 8 operators represented (Bingbot's Microsoft entry has no page yet,
  disclosed as before), most recently verified from this session's Google-Extended/Amazon fixes.
- **`/tools` hub**: was a bare title + one-line list of 5 links. Added a "tool vs. full audit"
  explainer (grounded in the real mechanism — every tool deep-links into the same full-scan
  report), per-tool signal labels, and a "how these work" section covering privacy/retention and
  the shared-parser guarantee (linking to `/scanner`, `/privacy`, `/methodology`, `/limitations`).
- **`/methodology`**: added a signal-support matrix (what CrawlPact can/cannot infer per signal,
  plus honest specification-maturity notes — RFC 9309 is a real IETF standard; `llms.txt`/RSL/
  Content Signals are not) and a last-substantive-update date. This is the one genuinely new,
  evidence-heavy piece of trust content added in this pass, consistent with the task brief's
  framing of methodology as the primary trust/authority page.
- **`/about`**: added one paragraph distinguishing CrawlPact from a WAF, live crawler blocker,
  server-log analytics service, or general-purpose SEO crawler, linking to `/limitations` for the
  full list rather than duplicating it.
- **A real a11y regression, found and fixed before it shipped**: the new methodology table's
  `overflow-x-auto` wrapper had no keyboard-focus mechanism (`scrollable-region-focusable`, a
  genuine WCAG 2.1 SC 2.1.1-adjacent violation flagged by the a11y suite, not a false positive).
  Fixed by copying the exact pattern already used for `pricing.astro`'s comparison table
  (`tabindex="0" role="region" aria-label="..."`) rather than inventing a new one.
- Deliberately not added: a "report a correction" contact link on the crawler directory or
  methodology page. The task brief asks for a correction mechanism, but no verified contact
  channel exists yet (same legal-identity gap as before) — adding a link or address here would be
  exactly the kind of invented contact info the audit has consistently refused to fabricate.

**Verification:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck` (0 errors), `pnpm test:unit`
(221/221), `pnpm db:validate`, and `pnpm build` all passed.
`pnpm test:integration` flaked once more on the same `billing-webhook.integration.test.ts` race
test as round 2 (same assertion, same file — no billing code touched either round), clean on
retry both times (141/141). This is now a reproducible pattern across two separate sessions in
this workstream, not a one-off — worth a dedicated look at the webhook ordering test's own timing
assumptions, separate from this content/SEO work. `pnpm test:a11y:chromium` caught the real
scrollable-table violation above (correctly — not a false positive), returned to 82/82 once fixed,
then showed one further transient "flaky" (not failed) result on an unrelated homepage
forced-colors test that passed on Playwright's built-in retry and passed clean (82/82, exit 0) on
a subsequent full run.

---

## 20. Implementation log, round 4 (scoring/scanner completeness) + a real finding on the billing-webhook flake

- **`/scoring`**: added a "Reproducibility and comparisons" section — same policy + same registry/
  ruleset version always produces the same score, and a score can legitimately change between two
  scans of an _unchanged_ site because the registry/ruleset itself updated ("registry drift"),
  which should not be read as the site's policy getting better or worse. This was the one item
  from the Phase 10 scoring checklist not already covered.
- **`/scanner`**: added the missing size limit (~2 MB per response, stated as an approximate
  figure consistent with how the page already states "roughly 12 requests"/"at most five
  redirects" — not as a precise internal threshold), a "what the scanner does not scan" section
  (authenticated pages, JS-rendered content, full-site coverage), explicit target-side-block
  reporting behaviour, and a link to `/privacy` for retention.

**Root-caused, not fixed, the recurring `billing-webhook.integration.test.ts` flake** (now
observed three times across rounds 2, 3, and 4, always the same assertion): the test
`"processes both events when two related deliveries for a brand-new subscription race
concurrently"` fires two webhook deliveries via `Promise.all` — `subscription.created`
(`occurred_at` T+0.0s) and `subscription.activated` (T+0.5s) — for the same new subscription, and
asserts both resolve to `outcome: "processed"`. `Promise.all` starts both requests concurrently
but does not guarantee which one's write actually reaches the database first. When the
`subscription.activated` request's insert/update happens to land before the
`subscription.created` request's under real concurrent execution (more likely under the kind of
system load this session's repeated back-to-back builds/tests created), the webhook handler's
out-of-order protection correctly recognizes that an event chronologically _earlier_ than what's
already recorded just arrived, and classifies it `ignored_out_of_order` — which is arguably the
_correct_ application behaviour, not a bug, but conflicts with the test's assumption that
`Promise.all` ordering matches processing ordering. This is a real, reproducible finding worth a
dedicated look at either the test (should it tolerate `ignored_out_of_order` as an acceptable
outcome under genuine concurrent delivery, given idempotency is preserved?) or the ordering logic
itself — deliberately not touched here, since it's billing-critical code outside this workstream's
scope and outside what a content/SEO/trust audit should be making judgment calls on.

**Verification:** full quality gate — `pnpm format:check`, `pnpm lint`, `pnpm typecheck` (0
errors), `pnpm test:unit` (221/221), `pnpm db:validate`, `pnpm build`, and `pnpm test:a11y:chromium`
(82/82, dev server pre-started) all passed. `pnpm test:integration` flaked once more on the same
webhook test (root-caused above), clean on retry (141/141).

---

## 21. Implementation log, round 5 (homepage artwork, editorial policy, incident tracking system, legal checklist, webhook flake documentation)

Full scope: homepage artwork, editorial/source-governance documentation, a complete incident-
tracking system (design doc → migration → admin UI → public status integration → tests), a legal-
information checklist (no invented values), and a dedicated root-cause document for the recurring
billing-webhook test flake — see the instructing message for the exact brief. Summary here;
`CHANGELOG.md` has the file-by-file list.

**Homepage artwork** — `apps/web/src/components/PolicyEvidenceMap.astro`, an original inline-SVG
"Policy Evidence Map" (website → declared signals → four purpose lanes → report), added to
`index.astro` immediately after the hero. Two renderings, not one shrunk down: a detailed
horizontal version for `sm:` and above, and a simplified vertical version below `sm` — the first
mobile render of the single-diagram approach produced ~5px effective text, caught before shipping
and fixed with a purpose-built mobile layout rather than smaller font sizes. `aria-hidden="true"`
(the adjacent heading/paragraph state the same content in words), fixed `aspect-ratio` per variant
(no layout shift, confirmed via `scrollWidth` checks at 360/768/1280px — no horizontal overflow at
any width), CSS-only flow animation gated on `prefers-reduced-motion` (verified both branches via
`page.emulateMedia`). Zero network requests, zero client JS — no Core Web Vitals impact.

**Editorial and source-governance policy** — `docs/seo/EDITORIAL_SOURCE_AND_CONTENT_POLICY.md`.
Covers authorship (organizational, not an invented byline), acceptable sources in priority order,
how conflicting operator documentation is resolved, last-verified-date discipline, the content
review workflow, and — directly and honestly — how AI assistance was used in producing CrawlPact's
content (including this document), stating plainly what that does and doesn't change about the
sourcing/review bar. Cross-references rather than duplicates the three existing narrower policies
(`SOURCE_VERIFICATION_POLICY.md`, `SEO_CONTENT_GOVERNANCE.md`, `CRAWLER_REGISTRY_GOVERNANCE.md`).

**Incident tracking system** — designed on paper first
(`docs/architecture/INCIDENT_TRACKING_SYSTEM_DESIGN.md`), then implemented exactly as designed:

- `packages/database/migrations/0018_incidents.sql` + `packages/database/src/schema/incidents.ts`
  — two new, purely additive tables (`incidents`, `incident_updates`), no existing table touched.
  Actor references (`created_by_user_id`) nullable with `ON DELETE SET NULL` from the first
  migration, matching the pattern migrations `0013`–`0015` had to apply retroactively elsewhere —
  not repeating that bug. `pnpm db:validate` confirms migration/Drizzle agreement (40 tables).
  Applied to the **local** D1 database only (`wrangler d1 migrations apply --local`, explicitly
  not `--remote`) so the feature could be exercised end-to-end during development; **not applied
  to production**. Applying `0018_incidents.sql` to the production D1 database, and deploying this
  code, are both real production-infrastructure actions requiring their own explicit go-ahead —
  consistent with every other production change in this workstream, this one wasn't done
  unilaterally either. See the final summary's "deployment considerations" for exactly what that
  entails.
- `apps/web/src/lib/status/components.ts` — the canonical 7-component list shared by admin and
  public surfaces (one source of truth for labels).
- `apps/web/src/lib/admin/incidents.ts` + `apps/web/src/pages/api/admin/incidents/**` — mirrors
  the existing `system_notices` feature's shape exactly (same auth chokepoint
  `requireAdminAction`/`requireAdminSession`, same audit-log reuse — no second, redundant audit
  mechanism was built).
- `apps/web/src/components/admin/IncidentsManager.tsx` + `apps/web/src/pages/admin/incidents/index.astro`
  — Super Admin create/update UI using the existing `@crawlpact/ui` component library, added to
  `AdminNav.astro`'s Security group.
- `apps/web/src/lib/status/public-status.ts` — the "public status adapter": combines the
  **existing, unchanged** internal health checks (`lib/admin/health.ts`) with admin-curated
  incidents into a six-state public vocabulary (`operational` / `degraded_performance` /
  `partial_outage` / `major_outage` / `maintenance` / `status_unavailable`). An incident can only
  escalate a component's displayed status, never mask a worse internal signal back down to
  "operational" — verified in the integration tests below. A failed health check or failed
  incident query resolves to `status_unavailable`, never a default "operational."
- `apps/web/src/pages/status.astro` rewritten to render: overall status, the 7 canonical
  components (preserving the two existing real config-derived detail strings — audit-engine and
  Paddle-billing status — rather than replacing them), current incidents with full update
  timelines, scheduled maintenance, recently-resolved incidents, and an honest "no reliable uptime
  measurement exists yet" statement instead of a fabricated percentage. `Cache-Control: public,
max-age=30` added so the page can't show minutes-stale incident state.
- Tests: `apps/web/tests/integration/admin-incidents.integration.test.ts` (8 tests, real D1) —
  auth/reason rejection, creation + audit-log verification, escalation of the affected component
  and overall status, status-transition + `resolved_at` semantics, a resolved incident moving out
  of "current" into "recently resolved" and the component reverting to operational, a non-public
  incident never appearing in the public computation (including that a `critical` severity on a
  draft incident must not escalate the public overall status), and a scheduled-maintenance
  incident reporting as "maintenance" rather than an outage. Plus
  `apps/web/src/lib/status/components.test.ts` (4 unit tests) for the pure helper functions.
- Manually exercised end-to-end against the local dev server with the migration applied: verified
  the overall status correctly showed `status_unavailable` before the local migration was applied
  (incidents tables didn't exist yet — confirms the "never default to operational" rule actually
  holds under a real failure, not just in a test) and correctly escalated to a real
  `degraded_performance` afterward, driven by genuine local webhook-failure data already present
  in the dev database — not a contrived test fixture.

**Legal-information checklist** — `docs/release/LEGAL_INFORMATION_CHECKLIST.md`. Every required
field (legal entity name, address, jurisdiction, consumer-protection regime, three contact
channels) explicitly marked `(not provided)` — no value was invented to fill the table. States
precisely what's already safe to do without this information (most content work) and what stays
blocked (jurisdiction-specific terms clauses, a named privacy data controller,
`/.well-known/security.txt`, a public correction-submission channel). Cross-referenced from
`docs/status/KNOWN_RISKS.md`.

**Billing-webhook flake — documented, not fixed** — `docs/status/BILLING_WEBHOOK_RACE_TEST_FLAKE.md`.
Precise root cause (quoting the actual `isOutOfOrder` comparison in
`apps/web/src/lib/billing/webhook-processor.ts`): the test's `Promise.all`-fired concurrent
requests can complete in either order, and when the later-timestamped event's write lands first,
the handler's out-of-order protection _correctly_ rejects the earlier-timestamped one — this is
the handler working as designed, not a defect. The test's assertion (both requests must report
"processed") is what's wrong. Two remediation options given, with a recommendation (assert final-
state invariants — exactly one row, correct final status, no `"failed"` outcomes — independent of
which request "won," rather than a fixed per-request outcome). **Neither the handler nor the test
was changed** — this stays a separate, dedicated billing-critical change per instruction.

**A real, pre-existing text-rendering bug found and fixed along the way**: while visually
inspecting the new methodology table, spotted `<code>` content directly abutting the preceding
word with no space ("project'sdocs/status/...") — an Astro/JSX whitespace-collapsing behavior
where a newline immediately before an inline element (`<code>`, `<a>`) does not reliably produce a
rendered space unless an explicit `{" "}` separates them. A static sweep plus rendered-HTML
verification (not just the static heuristic, which had false positives) found **12 instances
across 7 files touched this session** — including one on the homepage hero
("...required. Try<code>example.com") that predates this workstream entirely, confirming this is
a real, previously-unnoticed sitewide pattern, not something newly introduced. Fixed all 12,
verified each via direct HTML inspection post-fix (not just re-reading the source). Files outside
this session's diff were not swept — flagged as a worthwhile follow-up content-QA pass, not fixed
here (true scope creep beyond the assigned work).

**Verification:** full quality gate — `pnpm format:check`, `pnpm lint`, `pnpm typecheck` (0
errors), `pnpm test:unit` (225/225, up from 221 — 4 new component tests), `pnpm test:integration`
(149/149, up from 141 — 8 new incident tests; one run flaked on the already-documented,
now-expected webhook race test, clean on immediate retry), `pnpm db:validate` (40 tables), `pnpm build`,
and `pnpm test:a11y:chromium` (82/82, dev server pre-started) all passed. Responsive/no-overflow
checks at 360/768/1280px on `/status` and the homepage artwork; reduced-motion behaviour verified
both ways for the artwork's flow animation.

---

## 22. Implementation log, round 6 (crawler/guide content-completeness audit)

Following a systematic research pass against the original task brief's Phase 8 (crawler pages)
and Phase 9 (guides) content checklists across all 22 crawler pages and all 20 guides. Full
findings informed the fixes below; the two checklist items confirmed as _not_ real gaps
(no undisclosed control-token crawler exists beyond the two already known; every implementation/
troubleshooting guide already has a genuine verification step) were left alone rather than
"fixed" against a non-issue.

**Template-level fixes** (applied once in `crawlers/[slug].astro`, so all 22 pages get them
identically, with zero risk of the per-page drift that caused the original unevenness):

- **Example `robots.txt` configuration** — a `User-agent: {token} / Disallow: /` block, generated
  from each crawler's own real `userAgentToken`, not hand-copied per page. Previously present on
  only 1 of 22 pages.
- **Wildcard-fallback explanation** — a standard paragraph (RFC 9309: no dedicated group means the
  crawler falls back to `User-agent: *`), linking to `/guides/robots-txt-syntax-basics/`.
  Previously present on 0 of 22 pages (it only existed in guide content, never on the crawler
  pages themselves, even though every single crawler is subject to the same rule).
- **Related-tool link** — every crawler page now points to `/tools/ai-crawler-checker/` from its
  closing CTA. Previously 0 of 22.
- **Source-verification note** — a line linking to `/methodology#registry-verification` (a new
  `id` added to that heading so the anchor actually resolves), stating the record was checked
  against its cited source as of its `lastVerified` date.

**Related-guides cross-linking** — added an optional `relatedCrawlerSlugs` field to the guides
content schema (`content.config.ts`) and set it, with real values, on the 7 guides that are
genuinely about specific crawler tokens (the 6 comparison guides plus
`google-extended-vs-googlebot.md`). The crawler template now looks up and displays any guide that
lists it — an explicit, verifiable relationship, not fragile keyword-matching against guide body
text. `google-extended-vs-googlebot.md` itself was also fixed to actually link to
`/crawlers/googlebot/` and `/crawlers/google-extended/` in its body — the audit found it discussed
both crawlers repeatedly by name without linking to either, the clearest single missing-link case
found. 5 decision guides that named the AI crawler checker's exact use case without linking to it
(`applebot-vs-applebot-extended`, `metas-four-crawlers-explained`, `perplexitybot-vs-perplexity-user`,
`should-you-block-ccbot`, `google-extended-vs-googlebot`) each got one added.

**Checked and confirmed not a real gap** (per the audit, explicitly not "fixed" against a
non-issue): no crawler beyond the two already-documented control tokens (`Google-Extended`,
`Applebot-Extended`) turned out to be mislabeled as making its own requests; every implementation
and troubleshooting guide sampled already has a genuine, explicit verification step.

**Deliberately not done, and why:**

- **Full User-Agent HTTP header strings** (e.g. a complete `Mozilla/5.0 (compatible; GPTBot/1.0;
...)` string) — would require re-verifying each of 22 tokens against its official source
  specifically for this detail, which wasn't done as part of this pass. Flagged as a follow-up
  requiring dedicated source verification, not fabricated from the bare token already on file.
- **Historical rename/split notes and known-ambiguity call-outs** for the 21 pages that don't
  already have one — genuinely requires new research per crawler (only `GoogleOther` currently has
  an explicit ambiguity statement). Not attempted here to avoid guessing at history that wasn't
  independently re-verified.
- **Platform/CDN-specific implementation steps** (concrete Cloudflare/Netlify/Vercel/WordPress
  instructions instead of "consult your platform's documentation") for the 3 file-publishing
  guides — a genuine content gap, but substantial new-content work; flagged as a priority
  follow-up rather than attempted in this pass.
- **Standardizing the 16 crawler pages with boilerplate-only or missing "what blocking
  affects/doesn't affect" sections** up to the `gptbot.md`/`google-extended.md` quality bar — real,
  valuable, per-page content writing that needs its own dedicated pass rather than being rushed
  here; noted as the top content-quality priority for next time.

**A repeat of the same whitespace-collapsing bug class from round 5** was introduced by this
round's own new template code (a `<code>` tag starting a line with no `{" "}` after the preceding
line's text) — caught by re-running the same static sweep script used in round 5 before shipping,
not by accident. Fixed immediately, verified via rendered HTML output, not just re-reading source.

**Verification:** full quality gate — `pnpm format:check`, `pnpm lint`, `pnpm typecheck` (0
errors), `pnpm test:unit` (225/225), `pnpm test:integration` (149/149), `pnpm db:validate` (40
tables), `pnpm build` (all 22 crawler pages + 20 guides built successfully), and
`pnpm test:a11y:chromium` (82/82 on a clean run; one unrelated, already-known transient flake on
an earlier run, self-resolved on Playwright's retry) all passed. Spot-checked rendered HTML output
directly (not just source) for: the robots.txt/wildcard-fallback text on `gptbot`, the
related-guides section correctly appearing only where a real relationship exists (present on
`googlebot`, absent on `oai-adsbot`), and the methodology anchor link resolving correctly.

---

## 23. Implementation log, round 7 (standardizing "what blocking affects" across 16 candidate pages)

Per explicit product-owner instruction: replace boilerplate-only "Site-owner controls" sections
and add missing ones across the 16 crawler pages round 6's research identified as gaps, each
explaining purpose/operator, what blocking affects, and — where applicable — the
training/search/indexing/retrieval/user-triggered distinction against sibling tokens from the
same operator.

**Two of the 16 were re-checked and found to already meet the target bar** — `gptbot.md` ("What
blocking GPTBot does") and `google-extended.md` ("Why this one is easy to get wrong") both
already had genuine, crawler-specific affects/doesn't-affect content under a differently-named
heading. Rewriting already-good content to force a naming match would have been exactly the kind
of unnecessary churn the instructions warned against — left unchanged.

The other **14 pages got new or replaced content**, each naming the specific sibling tokens from
the same operator that remain unaffected:

| Page                       | Operator / purpose            | Change                                                                                                                                                                                                           |
| -------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `amazonbot.md`             | Amazon / mixed                | Replaced boilerplate. Explains disallowing it opts out of general product-improvement crawling (possible AI training); does not affect `Amzn-SearchBot` or `Amzn-User`.                                          |
| `googlebot.md`             | Google / search               | Replaced boilerplate. Explains it governs Search indexing only; does not affect `Google-Extended` (training opt-out) or `Google-CloudVertexBot` (agent).                                                         |
| `googleother.md`           | Google / unknown              | Replaced boilerplate. Explains the effect is as unspecific as Google's own purpose disclosure; does not affect `Googlebot` or `Google-Extended`.                                                                 |
| `google-cloudvertexbot.md` | Google / agent                | Replaced boilerplate. Explains it governs only site-owner-requested Vertex AI Agent crawls; does not affect Search indexing or the training opt-out.                                                             |
| `meta-externalads.md`      | Meta / advertising validation | Replaced boilerplate. Does not affect `Meta-ExternalAgent`, `Meta-WebIndexer`, or `Meta-ExternalFetcher`.                                                                                                        |
| `meta-externalfetcher.md`  | Meta / agent                  | Replaced boilerplate. Explains it's a single-page, user-directed fetch, not a bulk crawl; does not affect the other three Meta tokens.                                                                           |
| `meta-webindexer.md`       | Meta / search                 | Replaced boilerplate. Governs Meta AI search relevance only; does not affect the other three Meta tokens.                                                                                                        |
| `amzn-searchbot.md`        | Amazon / search               | Added new section (previously had none). Does not affect `Amazonbot` or `Amzn-User`.                                                                                                                             |
| `amzn-user.md`             | Amazon / user-triggered       | Added new section. Does not affect `Amazonbot` or `Amzn-SearchBot`.                                                                                                                                              |
| `applebot-extended.md`     | Apple / training              | Strengthened existing "Related crawler" note into a full section; clarifies it's a training-opt-out layered on `Applebot`, not a separate crawl.                                                                 |
| `ccbot.md`                 | Common Crawl / research       | Added a distinct "Site-owner controls" section alongside the existing (unchanged, already good) "why it matters" content — clarifies the disallow only affects future snapshots, not existing downstream copies. |
| `meta-externalagent.md`    | Meta / training               | Strengthened the existing generic "distinguishing" note into an explicit affects/doesn't-affect statement naming the other three Meta tokens.                                                                    |
| `oai-searchbot.md`         | OpenAI / search               | Strengthened; explicit that it affects ChatGPT search results only, not `GPTBot` or `ChatGPT-User`.                                                                                                              |
| `perplexitybot.md`         | Perplexity / search           | Strengthened; explicit that it affects Perplexity's answer citations only, not `Perplexity-User`.                                                                                                                |

**What was preserved on every page**: the existing frontmatter (operator, token, purpose,
lifecycle status, official source, `lastVerified`), the existing intro paragraph, and any other
existing section (e.g. `ccbot.md`'s "why it matters" paragraph, `amzn-*.md`'s "Related crawlers"
sections) — this was additive/replacement of only the boilerplate or thin section, not a rewrite
of the whole page. **`lastVerified` dates were deliberately not changed** on any of the 14 —
per `docs/seo/EDITORIAL_SOURCE_AND_CONTENT_POLICY.md`'s own rule against artificial freshness,
since this pass reused already-verified facts already on file rather than re-fetching each
operator's source. No frontmatter schema changes were needed (only page body content changed).

**Metadata, internal links, tests**: no title/description/canonical changes needed (unaffected by
body content edits). No new internal links were introduced in this round (round 6 already added
the guide/tool cross-links); this round only strengthened prose within existing sections. No test
changes were needed — `seo-metadata.spec.ts` continues to pass since page structure (one `<h1>`,
metadata, canonical) is untouched; no new route was added.

**Verification:** full quality gate — `pnpm format:check`, `pnpm lint`, `pnpm typecheck` (0
errors), `pnpm test:unit` (225/225), `pnpm test:integration` (149/149), `pnpm db:validate` (40
tables), `pnpm build` (all 22 crawler pages built successfully), and `pnpm test:a11y:chromium`
(82/82 clean; one already-known, unrelated transient flake on an earlier run, self-resolved) all
passed. Spot-checked rendered HTML output for `amzn-searchbot` and confirmed the new section
renders correctly alongside the existing "Related crawlers" section.

**Confirmed still unresolved, not touched, no claim of completion made**: the legal-entity/
address/jurisdiction/contact checklist (`docs/release/LEGAL_INFORMATION_CHECKLIST.md`) and the
Cloudflare AI-bot-blocking `robots.txt` setting — both remain exactly as documented in §17/§18,
per explicit product-owner instruction not to mark either resolved without independently
verifiable evidence.

---

## 24. Cloudflare AI-bot block — resolved (2026-07-31)

The product owner reported disabling Cloudflare's Managed robots.txt / AI-bot-blocking feature
directly in the Cloudflare dashboard (the connected API token still cannot read or write Bot
Management settings — same `10000: Authentication error` on `GET /zones/{id}/bot_management` as
every earlier attempt in this workstream, confirmed again at resolution time — so this could not
be done or verified via the API; it required dashboard access this session doesn't have).

**Independently verified, not just accepted on claim**: fetched `https://crawlpact.com/robots.txt`
directly. It now reads:

```
User-agent: *
Allow: /

Disallow: /api/
Disallow: /audit/*
Disallow: /app
Disallow: /sign-in
Disallow: /dev/

Sitemap: https://crawlpact.com/sitemap.xml
```

This matches `apps/web/public/robots.txt` (the site's own source-controlled file) exactly, with
no "BEGIN Cloudflare Managed content" block, no `Content-Signal` line, and none of the
per-crawler `Disallow` rules (`GPTBot`, `ClaudeBot`, `Google-Extended`, `CCBot`,
`Applebot-Extended`, `Amazonbot`, `Bytespider`, `meta-externalagent`) found in every earlier
check this workstream — confirmed absent, not merely unchecked. CrawlPact's own site no longer
blocks the AI crawlers its product audits. P0 item 5 (§14) and the corresponding executive-summary
bullet (§1) are updated to reflect this; §9 and §18/§20/§23's original findings are left as
written, since they accurately describe what was true when each was recorded.

**Still open, unaffected by this resolution**: the legal-entity/address/jurisdiction/contact
checklist (§5 item 2, `docs/release/LEGAL_INFORMATION_CHECKLIST.md`) remains fully unresolved —
every field still reads `(not provided)` as of this section being written, independently
re-confirmed by reading the file directly, not assumed.

## 25. Final release pass (2026-07-31)

Four items closed out before release, each independently verified rather than accepted on claim.

**1. Source-controlled `robots.txt` cleanup — merged, not yet deployed.** PR #58
(`fix(seo): simplify audit robots exclusion`) changed `Disallow: /audit/*` to `Disallow: /audit/`
in `apps/web/public/robots.txt`, added a 5-assertion regression test
(`apps/web/src/lib/robots-txt.test.ts`) asserting no AI-crawler-specific directive is ever
reintroduced, and merged to `main` as commit `fd8eae5`. CI on that PR initially failed 5 unrelated
integration tests with `TypeError: dispose is not a function` / Miniflare setup timeouts —
traced to `apps/web/tests/integration/d1-harness.ts`'s `beforeAll` hook racing a 10s timeout under
CI resource contention; confirmed transient (none of the 5 failing files touch the D1 harness or
the 3 files this PR changed) by re-running the failed job, which then passed cleanly. Verified via
`git log origin/main` and `git show origin/main:apps/web/public/robots.txt` that `main` now
contains the corrected file. **Production has not yet picked this up**: `curl
https://crawlpact.com/robots.txt` still returns the old `Disallow: /audit/*` wildcard form as of
this writing, because merging to `main` and deploying to production are deliberately separate,
independently-authorized steps in this repository (`.github/workflows/deploy-production.yml` is
`workflow_dispatch`-only). This is expected, not a defect — the fix ships to production as part of
this release's deployment step, covered later in this section.

**2. Homepage artwork removed.** The product owner reviewed the "Policy Evidence Map" SVG artwork
added in round 5 (§21) and rejected it ("remove only the new section with the art work on the home
page. It is not appropriate."). Removed `apps/web/src/components/PolicyEvidenceMap.astro`
entirely and its import/usage from `index.astro`. Confirmed no other file in `apps/web/src` or
`apps/web/tests` referenced the component before deleting it, and confirmed zero residual markup,
classes, or script references in the rebuilt HTML output afterward (`grep` for
`policy-evidence-map` / `Policy Evidence Map` in `dist/client/index.html` returns no matches).

**3. Trust-metadata config added.** Gap found: `privacy.astro`, `terms.astro`,
`acceptable-use.astro`, and `methodology.astro` each hand-typed the same "Effective and last
updated" / "Last substantive update" date, and separately hand-typed the same billing/
infrastructure/analytics provider names — no single source of truth existed, so a future date or
provider change would require finding and editing every occurrence correctly. Added
`apps/web/src/lib/trust-config.ts` (`TRUST_CONFIG`) and wired all four pages to read from it.
Legal-identity fields are explicitly typed `null` (not a placeholder string) with a comment
pointing to `docs/release/LEGAL_INFORMATION_CHECKLIST.md` — nothing reads or renders these fields
anywhere in the codebase yet (confirmed by `grep`), so there is no risk of an invented value
surfacing. Verified after wiring: rebuilt the site and confirmed the rendered date strings are
byte-for-byte identical to what was previously hand-typed (`30 July 2026`, `31 July 2026`) on all
four pages, and confirmed the "Third parties" paragraph on `/privacy` still reads correctly with
provider names sourced from the config.

**4. Legal checklist re-scoped, not resolved.** Per the product owner's explicit instruction to
"ignore" and "skip" the legal-checklist gap rather than have it block this release, reworded
`docs/release/LEGAL_INFORMATION_CHECKLIST.md`'s title and status line, and the corresponding
`docs/status/KNOWN_RISKS.md` entry, from "release blocker" to "deferred, scoped items only." No
value was invented anywhere — every field in the checklist still reads `(not provided)`, confirmed
by re-reading the file. The correction is one of framing and scope, not content: the gap blocks
only the specific items it always blocked (terms-of-service governing-law clause, a named privacy
data controller, `/.well-known/security.txt`, a public content-correction channel), not the
release as a whole, and the document now says so explicitly instead of implying a full release
gate.

**Full validation run** (`pnpm quality`: format, lint, typecheck, unit, integration, db:validate,
build) passed with one exception: `billing-webhook.integration.test.ts`'s
"processes both events when two related deliveries for a brand-new subscription race concurrently"
test failed once under full-suite load. This is the exact pre-existing, already-documented flake
from `docs/status/BILLING_WEBHOOK_RACE_TEST_FLAKE.md` (found 2026-07-30, root-caused 2026-07-31) —
confirmed unrelated to any change in this session via `git log` showing zero diff to that test file
or the webhook handler it exercises, and confirmed flaky rather than deterministic by re-running it
in isolation 4 times, passing all 4. Per the product owner's explicit instruction from round 5, the
webhook handler and its out-of-order protection were not modified as part of this work — the fix
belongs in a dedicated, separately-reviewed billing-critical change. `pnpm test:a11y:chromium`
(82 tests) passed in full against a live dev server, including the four pages whose date rendering
changed in this section.

## 26. Production deployment and post-deploy hotfix (2026-07-31)

PR #59 was pushed, CI passed, merged to `main` (squash commit `e245793`), and CI re-verified for
that exact commit — all preconditions `deploy-production.yml` requires. Dispatched with the
required typed confirmation. The workflow applied `0018_incidents.sql` to the live D1 database,
deployed the Worker, and verified bindings — all succeeded — but its final step, the automated
production smoke test, failed two checks: `Status page: contains "Free audit (real scan)"` and
`Status page: audit-engine label is honest (available)`.

**Root cause**: the `/status` rewrite in §21/this release replaced the literal capability label
`scripts/smoke-test.ts` depends on with a paraphrase ("Real scan enabled." instead of "Free audit
(real scan): Available."), silently weakening the exact honesty disclosure `CLAUDE.md` requires
for `AUDIT_ENGINE_ENABLED`. This was not caught by `pnpm quality` or `pnpm verify:push` locally,
because neither runs the production smoke test against a real Cloudflare deployment — only
`deploy-production.yml`'s own smoke-test step, run after the Worker is already live, exercises
this exact check. Production was live with this defect for approximately 45 minutes between the
two deploy runs.

**Fix**: a dedicated one-line hotfix restoring the literal wording, verified locally (build,
prettier, direct `curl` against a fresh dev server), opened as PR #60, CI-checked, squash-merged
as `ca6c3c1`, and deployed via a second `deploy-production.yml` run — this run's smoke test passed
in full.

**Independent final verification** (not accepted on the workflow's own report alone): ran
`node scripts/smoke-test.ts production https://crawlpact.com` directly against the live site after
the second deploy completed. **32/32 checks passed**, including live confirmation of: the
corrected `Disallow: /audit/` form in `robots.txt` (PR #58, previously merged but not yet deployed
— now live), the honest `"Free audit (real scan): Available."` status label, complete absence of
the removed homepage artwork section, correct trust-config-driven dates on `/privacy`, and the two
new Amazon crawler pages resolving with `HTTP 200`.

This is the exact scenario `docs/status/KNOWN_RISKS.md`'s standing rule addresses: a claim of
"deployed successfully" was not accepted until independently re-verified against the live site,
and the gap between "the deploy workflow ran" and "the deploy workflow's own smoke test actually
passed" was treated as a real, unresolved failure requiring a fix — not smoothed over or retried
blindly.
