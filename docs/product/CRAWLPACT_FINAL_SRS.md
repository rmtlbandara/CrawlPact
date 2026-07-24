# CrawlPact

## AI Crawler Policy Auditor & Monitor

### Complete Development-Ready Software Requirements Specification

**Product name:** CrawlPact  
**Primary domain:** `crawlpact.com`  
**Document version:** 3.0  
**Document status:** Final development baseline  
**Prepared date:** 22 July 2026  
**Target market:** Global  
**Primary acquisition channel:** SEO and content marketing  
**Primary infrastructure:** Cloudflare  
**Payment platform:** Paddle Billing  
**Initial operating model:** Solo-founder SaaS  
**AI dependency:** None in the MVP  
**Design direction:** Professional, evidence-led, technical, trustworthy and modern

---

## Table of Contents

1. [Document Purpose](#1-document-purpose)
2. [Product Overview](#2-product-overview)
3. [Business Objectives](#3-business-objectives)
4. [Product Positioning](#4-product-positioning)
5. [Product Boundaries](#5-product-boundaries)
6. [External Service Constraints](#6-external-service-constraints)
7. [User Roles](#7-user-roles)
8. [Subscription Plans](#8-subscription-plans)
9. [Public Website and Landing/Home Page](#9-public-website-and-landinghome-page)
10. [UI, UX and Professional Design Concept](#10-ui-ux-and-professional-design-concept)
11. [Additional Public Website Pages](#11-additional-public-website-pages)
12. [Core User Journeys](#12-core-user-journeys)
13. [Domain Input and Normalisation Requirements](#13-domain-input-and-normalisation-requirements)
14. [Public Audit Requirements](#14-public-audit-requirements)
15. [Safe Fetching and SSRF Protection](#15-safe-fetching-and-ssrf-protection)
16. [Robots.txt Requirements](#16-robotstxt-requirements)
17. [Crawler Registry Requirements](#17-crawler-registry-requirements)
18. [Policy Presets](#18-policy-presets)
19. [Additional Policy Signals](#19-additional-policy-signals)
20. [Conflict Detection](#20-conflict-detection)
21. [Recommendation Engine](#21-recommendation-engine)
22. [Findings and Scoring](#22-findings-and-scoring)
23. [Reports](#23-reports)
24. [Authentication and Account Security](#24-authentication-and-account-security)
25. [Saved Domains and Monitoring](#25-saved-domains-and-monitoring)
26. [Notifications](#26-notifications)
27. [Paddle Billing](#27-paddle-billing)
28. [Super Admin Control Center](#28-super-admin-control-center)
29. [Agency Features](#29-agency-features)
30. [SEO Requirements](#30-seo-requirements)
31. [Technical Architecture](#31-technical-architecture)
32. [Core Database Model](#32-core-database-model)
33. [Security Requirements](#33-security-requirements)
34. [Privacy and Data Retention](#34-privacy-and-data-retention)
35. [Testing Requirements](#35-testing-requirements)
36. [Production Acceptance Criteria](#36-production-acceptance-criteria)
37. [Development Phases](#37-development-phases)
38. [Future Scope](#38-future-scope)
39. [Branding Requirements](#39-branding-requirements)
40. [Final Development Directive](#40-final-development-directive)

---

# 1. Document Purpose

This Software Requirements Specification defines the complete requirements for designing, developing, testing, launching, operating, and expanding CrawlPact.

It shall serve as the authoritative development reference for:

- Product planning
- Information architecture
- UI and UX design
- Visual design system
- Landing-page implementation
- Customer dashboard implementation
- Super Admin interface implementation
- Frontend development
- Backend development
- Database design
- Cloudflare architecture
- Authentication
- Paddle billing
- AI crawler registry management
- Domain auditing
- Scheduled monitoring
- Customer reporting
- Super Admin operations
- Security
- Privacy
- Accessibility
- Responsive design
- SEO
- Content publishing
- Quality assurance
- Production deployment
- Release approval
- Future product governance

Any implementation that materially conflicts with this SRS must be documented and explicitly approved before production deployment.

All product, engineering, UI, UX, security, billing and operational decisions shall be evaluated against this document.

---

# 2. Product Overview

## 2.1 Product Definition

CrawlPact is a vendor-neutral SaaS platform that audits and monitors the publicly declared AI crawler policy of a website.

The user enters a public domain or URL. CrawlPact evaluates relevant public resources and signals, including:

- `robots.txt`
- AI crawler-specific user-agent rules
- `llms.txt`
- `llms-full.txt`
- RSL declarations
- Content Signals
- Robots meta directives
- `X-Robots-Tag`
- Sitemap declarations
- Relevant HTTP headers
- Status codes
- Redirect behaviour
- Selected page-level signals

CrawlPact then explains:

- Which documented AI crawlers appear allowed
- Which documented AI crawlers appear blocked
- Which crawlers have no explicit policy
- Which crawlers are used for search
- Which crawlers are used for training
- Which crawlers perform user-triggered retrieval
- Which crawlers support agents or other automated actions
- Whether the declared configuration matches the user’s selected objective
- Whether different policy signals conflict
- Whether the website’s configuration has changed
- Whether CrawlPact’s crawler registry has changed

## 2.2 Primary Product Promise

> **Audit and monitor your website’s AI crawler policy.**

## 2.3 Primary Tagline

> **Know what AI crawlers can access.**

## 2.4 Supporting Product Description

> CrawlPact checks how search, training, user-triggered, and agent crawlers are addressed by your website. It identifies configuration conflicts, generates clear recommendations, and monitors policy changes without requiring installation, server-log access, or an AI API.

## 2.5 Product Category

CrawlPact shall be positioned as:

> **AI crawler policy governance software**

## 2.6 Core Product Principle

CrawlPact audits **declared policy**.

It does not prove or guarantee that external crawlers will obey that policy.

Every report shall distinguish between:

1. **Declared policy** – what the website asks crawlers to do
2. **Observed response** – what CrawlPact successfully retrieved
3. **Actual crawler behaviour** – what an external crawler truly does, which cannot be proven through a public configuration audit alone

---

# 3. Business Objectives

## 3.1 Primary Revenue Objective

CrawlPact shall aim to generate at least:

> **USD 20,000 in annual gross recurring revenue by the end of 2027**

This target is not guaranteed and shall be treated as a commercial planning objective.

## 3.2 Supporting Business Objectives

CrawlPact shall aim to:

- Acquire users primarily through SEO
- Avoid dependence on social-media marketing
- Provide a useful free audit without registration
- Convert agencies and multi-domain users to annual subscriptions
- Minimise customer-support requirements
- Avoid third-party email and SMS providers
- Avoid external AI APIs in the MVP
- Operate initially on low-cost Cloudflare infrastructure
- Use Paddle as the merchant-of-record and billing system
- Be maintainable by one founder
- Develop a defensible, versioned AI crawler knowledge base
- Build recurring value through monitoring and change history
- Present a highly professional international SaaS brand
- Establish trust through evidence, transparency and strong UX
- Avoid cluttered, template-like or low-quality SaaS design
- Create a product interface suitable for agencies, publishers, developers and professional teams

## 3.3 Commercial Success Targets

| Metric | End-of-2027 target |
|---|---:|
| Monthly organic sessions | 15,000+ |
| Monthly completed free audits | 3,000+ |
| Registered accounts | 1,500+ |
| Saved domains | 1,000+ |
| Active paid customers | 150+ |
| Gross annual recurring revenue | USD 20,000+ |
| Scheduled scan success rate | 98%+ excluding target-side failures |
| Annual renewal rate | 70%+ |
| Monthly manual support requests | Fewer than 10 |
| Critical parser false-positive rate | Below 1% |
| Audit-start to audit-completion rate | 80%+ |
| Landing-page audit conversion | 15%+ |
| Paid-plan checkout completion | 60%+ after checkout start |

---

# 4. Product Positioning

## 4.1 Primary Target Segment

The primary paying customer shall be:

> **A web, SEO, or digital agency managing multiple customer websites**

This segment has stronger recurring value because agencies need:

- Portfolio-wide crawler audits
- Client reporting
- Historical evidence
- Scheduled monitoring
- Change detection
- Consistent recommendations
- Multi-domain management

## 4.2 Secondary Segments

Secondary users shall include:

- Independent publishers
- News and editorial websites
- SaaS businesses
- Documentation websites
- Public knowledge bases
- Ecommerce websites
- Technical website owners
- SEO consultants
- Web developers
- Content businesses

## 4.3 Initially Excluded Segments

The MVP shall not be designed around:

- Enterprises requiring custom SLAs
- Customers requiring SAML or enterprise SSO
- Private-network scanning
- Active bot blocking
- Custom integrations
- Legal consulting
- Custom crawler enforcement
- Full managed-service onboarding
- Private server-log ingestion
- Security-operation-centre workflows

## 4.4 Product Differentiators

| Differentiator | Requirement |
|---|---|
| Vendor neutral | CrawlPact shall work with websites hosted on any public provider |
| No installation | The primary audit shall require only a domain or URL |
| Purpose aware | Search, training, user-triggered, agent and mixed-use crawlers shall be separated |
| Evidence based | Every finding shall include its exact evidence |
| Versioned registry | Crawler identities and purposes shall be versioned |
| Historical monitoring | Paid users shall see website-policy changes over time |
| Registry-drift monitoring | Changes caused by new crawler information shall be identified |
| Agency workflow | Multi-domain portfolios and client reports shall be supported |
| Deterministic | Core audit findings shall not depend on an AI model |
| Low support | Authentication, billing, reports and troubleshooting shall be self-service |
| Professional interface | The product shall present a polished, credible and globally suitable UI |
| Clear information hierarchy | Complex policy information shall be understandable without visual overload |
| Trust-centred UX | Limitations, evidence, methodology and sources shall remain visible |

---

# 5. Product Boundaries

## 5.1 CrawlPact Is

CrawlPact is:

- A public website-policy auditor
- An AI crawler policy monitor
- A `robots.txt` evaluator
- A policy-conflict detector
- A crawler-purpose knowledge base
- A report generator
- A multi-domain portfolio-monitoring tool
- A technical recommendation system
- A change-governance platform

## 5.2 CrawlPact Is Not

CrawlPact is not:

- A web application firewall
- A reverse proxy
- A live crawler blocker
- A server-log analytics service
- A full-site SEO crawler
- An AI-search ranking tracker
- A brand-mention tracker
- A legal service
- A copyright-enforcement service
- A compliance certificate
- A guarantee that bots will obey instructions
- A guarantee that content will appear in AI answers
- A general-purpose SEO suite

## 5.3 Prohibited Product Claims

CrawlPact shall not claim:

- “Stop all AI scraping”
- “Guarantee protection from AI”
- “Make AI crawlers obey”
- “Ensure ChatGPT ranking”
- “Legally protect your website content”
- “Complete AI compliance”
- “Block every AI bot”
- “Guarantee AI visibility”

## 5.4 Approved Product Claims

CrawlPact may state:

- Audit your declared AI crawler policy
- See how documented crawlers are addressed
- Detect crawler-policy conflicts
- Monitor crawler-policy changes
- Generate evidence-based recommendations
- Compare search and training crawler access
- Manage crawler policies across multiple websites

---

# 6. External Service Constraints

## 6.1 Approved External Platforms

The MVP may depend on:

- Cloudflare Workers
- Cloudflare Pages or Workers Static Assets
- Cloudflare D1
- Cloudflare Cron Triggers
- Cloudflare R2 only when justified
- Cloudflare Turnstile only when abuse requires it
- Paddle Billing
- Browser-native WebAuthn/passkeys
- Public websites being audited
- Official crawler documentation

## 6.2 Prohibited External Operational Services

The MVP shall not use:

- External email-delivery providers
- External SMS providers
- External push-notification providers
- External AI APIs
- External authentication providers
- External analytics vendors
- External PDF-generation services
- External screenshot services
- External job schedulers
- External customer-support chat tools
- External log-management services
- External uptime-monitoring services requiring application integration

## 6.3 Paddle Email Exception

Paddle may independently send:

- Payment confirmations
- Receipts
- Billing notices
- Renewal notices
- Failed-payment notices

These communications are part of Paddle’s merchant-of-record service and do not constitute a CrawlPact-operated email service.

CrawlPact itself shall not use email for:

- Authentication
- Password recovery
- Product notifications
- Scan alerts
- Marketing campaigns
- Support communication

---

# 7. User Roles

## 7.1 Anonymous Visitor

An anonymous visitor may:

- View the landing page
- Enter a public domain
- Run a limited manual audit
- View the crawler matrix
- View critical findings
- View policy limitations
- View basic recommendations
- Read crawler-reference pages
- Use free validation tools
- View pricing

## 7.2 Free Registered User

A free user may:

- Register with a passkey
- Save one domain
- Keep limited scan history
- Select a policy preset
- Run limited manual rescans
- View in-app notices
- Upgrade through Paddle

## 7.3 Solo Subscriber

A Solo subscriber may:

- Save up to five domains
- Receive monthly monitoring
- View historical scans
- Receive in-app change notifications
- Use a private Atom feed
- Generate private report links
- View complete recommendations

## 7.4 Pro Subscriber

A Pro subscriber may:

- Save up to 25 domains
- Receive weekly monitoring
- Create domain groups
- Export CSV data
- Generate print-ready reports
- Use portfolio filters
- Receive higher manual scan limits

## 7.5 Agency Subscriber

An Agency subscriber may:

- Save up to 100 domains
- Receive weekly monitoring
- Create client groups
- Batch-import domains
- Generate client-safe reports
- Add limited agency branding
- View portfolio-level risk
- Export portfolio data

## 7.6 Super Admin

The Super Admin is the platform owner and shall have global operational visibility across:

- Users
- Accounts
- Subscriptions
- Payments
- Revenue
- Domains
- Scans
- Scheduled jobs
- Findings
- Notifications
- Crawler registry
- Rulesets
- Security events
- Abuse events
- Paddle webhooks
- Product usage
- Feature configuration
- Public notices
- System health
- Administrative actions

---

# 8. Subscription Plans

| Feature | Free | Solo | Pro | Agency |
|---|---:|---:|---:|---:|
| Annual price | USD 0 | USD 79 | USD 179 | USD 399 |
| Saved domains | 1 | 5 | 25 | 100 |
| Monitoring | None | Monthly | Weekly | Weekly |
| History retention | 30 days | 12 months | 24 months | 36 months |
| Manual rescans/domain/month | 2 | 5 | 10 | 20 |
| Domain groups | No | No | Yes | Yes |
| CSV export | No | No | Yes | Yes |
| Print-ready report | Basic | Yes | Yes | Yes |
| Private Atom feed | No | Yes | Yes | Yes |
| Private report links | Limited | Yes | Yes | Yes |
| Batch import | No | No | Limited | Yes |
| Agency branding | No | No | No | Yes |

Plan definitions and entitlements shall be stored in the database and shall not be permanently hard-coded into the frontend.

---

# 9. Public Website and Landing/Home Page

## 9.1 Landing-Page Objective

The CrawlPact home page shall perform four primary functions:

1. Explain the product clearly
2. Allow a visitor to run an audit immediately
3. Establish technical trust
4. Convert suitable visitors into registered or paid users

The landing page shall not operate only as a marketing brochure.

The primary product interaction—the domain audit—shall be visible in the first viewport.

## 9.2 Home-Page Route

Canonical route:

`https://crawlpact.com/`

All of the following shall redirect permanently to the canonical route:

- `http://crawlpact.com`
- `http://www.crawlpact.com`
- `https://www.crawlpact.com`

## 9.3 Recommended Home-Page Metadata

**Title:**

> AI Crawler Policy Auditor & Robots.txt Checker | CrawlPact

**Meta description:**

> Audit how AI search, training, user-triggered and agent crawlers are addressed by your website. Detect policy conflicts, generate recommendations and monitor changes.

**Canonical:**

`https://crawlpact.com/`

**Primary H1:**

> Audit and monitor your website’s AI crawler policy.

## 9.4 Home-Page Hero Section

The hero shall contain:

- CrawlPact logo
- Primary headline
- Supporting description
- Domain audit input
- Primary audit button
- Clear no-install statement
- Short trust statement
- Optional example-domain link

Recommended hero copy:

> **Audit and monitor your website’s AI crawler policy.**

> See how search, training, user-triggered and agent crawlers are addressed by your website. Detect conflicts, generate clear recommendations and monitor future changes—without installing anything.

Primary input placeholder:

> Enter a domain, such as example.com

Primary button:

> Audit domain

Supporting trust text:

> No installation. No server-log access. No AI API required.

## 9.5 Hero Audit Input Requirements

The hero audit form shall:

- Accept a domain, hostname or public HTTP/HTTPS URL
- Validate input before submission
- Display an actionable error for invalid input
- Support keyboard submission
- Prevent duplicate submissions
- Display scan progress after submission
- Preserve the entered value
- Never require account creation before the first audit
- Link to scanner information and limitations

## 9.6 Home-Page Navigation

Primary navigation shall include:

- Product
- Free tools
- AI crawlers
- Guides
- Pricing
- Methodology
- Sign in

A primary navigation CTA shall display:

> Audit a domain

On mobile, navigation shall use an accessible collapsible menu.

## 9.7 Trust and Transparency Strip

Immediately below the hero, the page should present short factual trust statements:

- Vendor-neutral
- No installation
- Evidence-based findings
- Search and training crawlers separated
- Works with public websites
- Deterministic recommendations

CrawlPact shall not display invented customer counts, testimonials, company logos or trust badges.

Any metric shown publicly must be based on verified product data.

## 9.8 Problem Explanation Section

The page shall explain that “block AI” is no longer one simple decision.

The section should show that crawler operators may use separate crawlers for:

- Search
- Training
- User-triggered retrieval
- Agents
- Advertising or validation
- Research or mixed purposes

Recommended section heading:

> AI crawler policy is no longer a single allow-or-block decision.

The content shall explain that blocking a search crawler may have a different consequence from blocking a training crawler.

## 9.9 How CrawlPact Works Section

The page shall display a three-step or four-step process:

### Step 1: Enter a domain

CrawlPact retrieves bounded public policy resources.

### Step 2: Review crawler access

The system separates search, training, user-triggered and agent crawlers.

### Step 3: Fix conflicts

The user receives evidence, explanations and configuration recommendations.

### Step 4: Monitor changes

Paid users receive scheduled rechecks, history and policy-change notifications.

## 9.10 Product Result Preview

The home page shall include a realistic static preview of the product report.

The preview may show:

- Policy Health Score
- Search crawler status
- Training crawler status
- Critical findings
- A crawler matrix
- A configuration-diff preview
- Scan timestamp
- Registry version

The preview shall not use fabricated customer data.

A clearly labelled demonstration domain or synthetic example shall be used.

## 9.11 Key Features Section

The feature section shall contain at least:

### AI crawler access matrix

See whether documented crawlers appear allowed, blocked or unspecified.

### Search versus training separation

Understand the different business effects of crawler purposes.

### Policy-conflict detection

Identify contradictions across `robots.txt`, headers, RSL and related signals.

### Configuration recommendations

Receive copyable, deterministic changes with evidence.

### Change monitoring

Detect future website-policy and crawler-registry changes.

### Multi-domain management

Manage policies across client and company websites.

### Evidence and history

Preserve the exact resources and rules used for every finding.

## 9.12 Audience and Use-Case Section

The page shall present relevant use cases for:

- SEO agencies
- Publishers
- SaaS companies
- Documentation websites
- Web developers
- Technical website owners

Each use case shall describe a real task rather than generic marketing language.

## 9.13 Supported Signal Section

The page shall display supported public resources:

- `robots.txt`
- AI crawler user-agent groups
- `llms.txt`
- `llms-full.txt`
- RSL
- Content Signals
- Robots meta
- `X-Robots-Tag`
- Sitemap declarations
- Relevant HTTP headers

The section shall state that support depth may vary by specification maturity.

## 9.14 Crawler Directory Preview

The landing page shall highlight selected crawler-reference pages.

Each preview card may show:

- Crawler name
- Operator
- Purpose
- Current verification date
- Link to full crawler page

The page shall link to the complete crawler directory.

## 9.15 Monitoring Section

The landing page shall explain the recurring value of the paid product.

Recommended heading:

> A correct policy today can become outdated tomorrow.

This section shall explain:

- Website deployments can alter policy files
- CDNs or plugins can change generated rules
- Crawler operators can introduce new tokens
- Crawler purposes can be separated or revised
- Saved domains can be re-evaluated when the registry changes

## 9.16 Pricing Section

The home page shall include a compact pricing summary.

The pricing section shall:

- Show annual prices
- Show domain limits
- Show monitoring frequency
- Identify the recommended plan
- Link to the full pricing page
- Avoid hidden mandatory fees
- State that billing is handled by Paddle
- State that applicable taxes may be calculated during checkout

Recommended CTA labels:

- Start free
- Choose Solo
- Choose Pro
- Choose Agency

## 9.17 Frequently Asked Questions

The home page shall include an FAQ section covering at least:

1. Does CrawlPact block AI crawlers?
2. Does CrawlPact guarantee that crawlers obey `robots.txt`?
3. Do I need to install anything?
4. Does CrawlPact use AI?
5. Can I allow AI search but block AI training?
6. What websites can CrawlPact audit?
7. How are crawler purposes verified?
8. What happens when a crawler changes?
9. Does CrawlPact provide legal advice?
10. How do paid monitoring and notifications work?

FAQ content shall be concise, factual and consistent with the product limitations.

## 9.18 Final Call-to-Action Section

The final CTA shall repeat the domain audit form.

Recommended heading:

> Check your website’s AI crawler policy now.

Supporting text:

> Run a free public audit. No account or installation required.

Button:

> Audit domain

## 9.19 Footer

The footer shall include:

### Product

- Domain audit
- Pricing
- Crawler directory
- Free tools
- Changelog

### Resources

- Guides
- Methodology
- Scoring methodology
- Scanner information
- Documentation

### Company and legal

- About CrawlPact
- Privacy policy
- Terms of service
- Acceptable-use policy
- Security
- Limitations
- Status

### Brand

- CrawlPact logo
- Short description
- Copyright year

The footer shall not require social-media links.

## 9.20 Landing-Page Conversion Events

First-party product analytics shall record aggregate events for:

- Home page viewed
- Hero audit started
- Hero audit completed
- Result viewed
- Account creation started
- Account created
- Pricing viewed
- Checkout started
- Subscription activated
- Crawler-reference page opened
- Final CTA audit started

These events shall avoid collecting unnecessary personal information.

## 9.21 Landing-Page Content Rules

The landing page shall:

- Use direct, clear language
- Avoid unsupported superlatives
- Avoid fear-based claims
- Avoid invented urgency
- Avoid fake countdowns
- Avoid fake testimonials
- Avoid fake customer logos
- Avoid misleading “compliance” language
- Explain product limitations visibly
- Use technical evidence to build trust

## 9.22 Landing-Page Performance

The home page shall:

- Be server rendered or statically generated
- Minimise JavaScript
- Avoid large video backgrounds
- Avoid unnecessary animation libraries
- Optimise images
- Use responsive image formats
- Avoid layout shifts
- Target strong Core Web Vitals
- Load the primary audit form without waiting for nonessential scripts

## 9.23 Landing-Page Accessibility

The landing page shall target WCAG 2.2 AA.

Requirements include:

- Keyboard-accessible navigation
- Proper form labels
- Visible focus states
- Sufficient colour contrast
- Semantic headings
- Accessible error messages
- No colour-only status communication
- Reduced-motion support
- Descriptive links
- Accessible tables and accordions

## 9.24 Landing-Page Structured Data

The page may include valid structured data for:

- Organization
- WebSite
- SoftwareApplication
- FAQPage, only when the visible FAQ matches the markup
- BreadcrumbList on subpages

Structured data shall not include fabricated reviews or ratings.

---

# 10. UI, UX and Professional Design Concept

## 10.1 Design Vision

The CrawlPact interface shall communicate:

- Technical credibility
- Professional trust
- Calm confidence
- Precision
- Transparency
- Evidence
- Security
- Simplicity
- International SaaS quality

The design shall feel suitable for:

- Agencies presenting results to clients
- Publishers making policy decisions
- Developers reviewing technical evidence
- Business owners who need clear guidance
- A global professional audience

The design shall not feel:

- Playful
- Childlike
- Overly futuristic
- Cyberpunk
- Visually noisy
- Template-generated
- Excessively animated
- Fear based
- Like a generic AI chatbot
- Like a low-quality free SEO checker
- Like a cryptocurrency product
- Like a dark hacker-security interface

## 10.2 Core Design Concept

The approved design concept shall be:

> **Evidence-led technical clarity**

This concept means:

- Important evidence is visually prioritised
- Complex information is broken into understandable layers
- Status is clear without relying only on colour
- Every recommendation can be traced to evidence
- Large technical reports remain readable
- The interface feels calm and controlled
- Decoration never competes with information
- Trust is established through transparency rather than marketing claims

## 10.3 Visual Personality

The visual personality shall be:

- Professional
- Minimal
- Structured
- Refined
- Authoritative
- Modern
- Neutral
- Technical
- Accessible

The product may use subtle visual references to:

- Policy documents
- Structured rules
- Website paths
- Crawling routes
- Access matrices
- Connected systems
- Verification
- Change detection

The product shall avoid literal cartoon spider imagery as the main visual identity.

## 10.4 Design Theme

The primary MVP theme shall be a polished light theme.

The light theme shall use:

- Soft neutral page backgrounds
- White or near-white surfaces
- Dark navy or charcoal text
- Controlled blue or blue-green brand accents
- Muted borders
- Clear status colours
- Soft shadows used sparingly

A dark theme may be delivered as a post-MVP enhancement.

The data model and CSS architecture shall permit a future dark theme without redesigning components.

## 10.5 Recommended Colour System

The exact final colours may be adjusted during visual implementation, but the design system shall follow the approved semantic structure.

### Brand colours

| Token | Suggested value | Use |
|---|---|---|
| `brand-900` | `#0B1F33` | Primary headings, dark brand surfaces |
| `brand-800` | `#12324F` | Navigation and strong UI elements |
| `brand-700` | `#184A70` | Secondary brand emphasis |
| `brand-600` | `#176B87` | Primary interactive brand colour |
| `brand-500` | `#1E88A8` | Hover or supporting accent |
| `brand-100` | `#DFF3F7` | Light accent backgrounds |
| `brand-50` | `#F2FAFB` | Very light highlighted surfaces |

### Neutral colours

| Token | Suggested value | Use |
|---|---|---|
| `neutral-950` | `#101820` | Primary text |
| `neutral-800` | `#273541` | Secondary headings |
| `neutral-700` | `#42515C` | Body text |
| `neutral-600` | `#5C6B75` | Supporting text |
| `neutral-500` | `#75838D` | Placeholder and metadata |
| `neutral-300` | `#C8D0D6` | Strong borders |
| `neutral-200` | `#DDE3E7` | Default borders |
| `neutral-100` | `#EDF1F3` | Muted backgrounds |
| `neutral-50` | `#F7F9FA` | Page background |
| `white` | `#FFFFFF` | Cards and primary surfaces |

### Status colours

| Status | Suggested colour | Supporting background |
|---|---|---|
| Success / allowed | `#157347` | `#E9F7EF` |
| Warning / review | `#B66A00` | `#FFF4D8` |
| Error / blocked risk | `#B42318` | `#FDECEA` |
| Critical | `#8E1B12` | `#F9DEDB` |
| Information | `#175CD3` | `#EAF2FF` |
| Unknown / neutral | `#667085` | `#F2F4F7` |

Status colours shall never be the only indicator of meaning.

Every status shall also include:

- Text
- Icon
- Label
- Accessible description where necessary

## 10.6 Colour-Contrast Requirements

- Normal body text shall meet at least WCAG AA contrast.
- Large text shall meet WCAG AA contrast.
- Interactive controls shall remain visible in default, hover, active, focus and disabled states.
- Placeholder text shall not be used as the only form label.
- Status chips shall maintain readable text contrast.
- Disabled states shall remain understandable without becoming invisible.
- Focus rings shall be clearly visible on both light and coloured surfaces.

## 10.7 Typography System

The product shall use a professional sans-serif typeface suitable for technical interfaces.

Recommended open-source or system-compatible options include:

- Inter
- Geist Sans
- IBM Plex Sans
- Source Sans 3
- Native system font stack

A single primary type family is recommended for consistency and performance.

A monospace typeface shall be used for:

- `robots.txt` content
- User-agent tokens
- URLs
- Code snippets
- Configuration diffs
- Header names
- Technical evidence

Recommended monospace options include:

- Geist Mono
- IBM Plex Mono
- JetBrains Mono
- Native system monospace

### Type scale

| Style | Desktop size | Mobile size | Weight |
|---|---:|---:|---:|
| Display heading | 52–60px | 38–44px | 650–700 |
| Page H1 | 40–48px | 32–38px | 650–700 |
| Section H2 | 28–34px | 24–28px | 600–700 |
| Subsection H3 | 20–24px | 18–22px | 600 |
| Card heading | 16–18px | 16–18px | 600 |
| Body large | 18px | 17px | 400 |
| Body default | 15–16px | 15–16px | 400 |
| Supporting text | 13–14px | 13–14px | 400 |
| Metadata | 12–13px | 12–13px | 450 |
| Code | 13–14px | 12–13px | 400 |

Line height shall generally range from:

- 1.1–1.2 for large headings
- 1.35–1.45 for compact UI headings
- 1.5–1.7 for body content
- 1.5 for code and evidence blocks

## 10.8 Spacing System

The design shall use a consistent spacing system based on a four-pixel unit.

Recommended spacing tokens:

| Token | Value |
|---|---:|
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 12px |
| `space-4` | 16px |
| `space-5` | 20px |
| `space-6` | 24px |
| `space-8` | 32px |
| `space-10` | 40px |
| `space-12` | 48px |
| `space-16` | 64px |
| `space-20` | 80px |
| `space-24` | 96px |

Spacing shall be generous enough to communicate quality without wasting dashboard space.

Marketing pages may use larger section spacing.

Application pages shall use denser but still comfortable spacing.

## 10.9 Border Radius System

The interface shall use controlled rounded corners.

Recommended values:

| Component | Radius |
|---|---:|
| Small chips and badges | 6px |
| Buttons and inputs | 8px |
| Cards | 10–12px |
| Large marketing panels | 14–16px |
| Full pills | 999px only for compact status chips |

The product shall avoid excessive rounded “bubble” styling.

## 10.10 Shadow System

Shadows shall be subtle.

Recommended use:

- Navigation elevation
- Modal dialogs
- Floating menus
- Important marketing preview cards
- Sticky mobile controls

Most dashboard cards should rely on borders and background contrast rather than heavy shadows.

The product shall avoid:

- Large glowing shadows
- Neon effects
- Multiple stacked shadows
- Excessive glassmorphism
- Low-contrast transparent surfaces

## 10.11 Iconography

The product shall use one consistent professional icon set.

Suitable icon styles:

- Lucide-style outline icons
- Heroicons-style outline icons
- Custom simple line icons

Icons shall:

- Use consistent stroke width
- Be labelled where meaning is not obvious
- Never replace important text
- Support screen-reader labels where interactive
- Avoid decorative overuse

Recommended semantic icons:

| Concept | Icon direction |
|---|---|
| Audit | Search or scan frame |
| Policy | Document with rules |
| Allowed | Check circle |
| Blocked | Minus or restricted circle |
| Warning | Triangle |
| Critical | Octagon or alert circle |
| Search crawler | Search icon |
| Training crawler | Dataset or layers icon |
| User-triggered | User with cursor |
| Agent/action | Connected nodes or workflow |
| History | Clock or timeline |
| Diff | Split arrows |
| Registry | Database or indexed list |
| Evidence | File search |
| Monitoring | Radar or pulse |
| Security | Shield |
| Billing | Card or receipt |

## 10.12 Illustration Style

Illustrations shall be optional and limited primarily to:

- Landing page
- Empty states
- Onboarding
- Product explanation

Illustrations shall be:

- Geometric
- Abstract
- Technical
- Minimal
- Brand-colour controlled
- Original or properly licensed

Illustrations shall not include:

- Cartoon spiders as the main brand device
- Humanoid AI robots
- Generic glowing AI brains
- Excessively futuristic imagery
- Fake dashboards that differ materially from the product

## 10.13 Logo Direction

The CrawlPact logo should communicate:

- Rules
- Paths
- Structured access
- Agreement
- Monitoring
- Technical precision

Possible logo concepts include:

- A structured “C” formed from connected path lines
- Two brackets or paths forming a protected agreement
- A document-rule symbol combined with a crawler path
- A node and route mark representing controlled access
- A monogram combining “C” and “P” through structured lines

The logo shall work in:

- Full colour
- Single colour
- Dark background
- Light background
- Favicon size
- Small navigation size
- Print reports

The logo shall not require detailed illustration to remain recognisable.

## 10.14 Responsive Layout Grid

### Marketing pages

Recommended maximum content width:

- 1180–1240px

Recommended layout:

- 12-column desktop grid
- 8-column tablet grid
- 4-column mobile grid

### Application pages

Recommended structure:

- Fixed or collapsible left sidebar on desktop
- Main content area with maximum readable width where appropriate
- Full-width tables and reports when necessary
- Top bar for account, notifications and global actions

### Breakpoints

Suggested breakpoints:

| Name | Width |
|---|---:|
| Small mobile | 360px |
| Mobile | 480px |
| Large mobile | 640px |
| Tablet | 768px |
| Small desktop | 1024px |
| Desktop | 1280px |
| Wide desktop | 1440px+ |

Components shall be tested across content-driven breakpoints rather than relying only on device labels.

## 10.15 Application Shell

The authenticated application shall use a professional dashboard shell.

### Desktop shell

The desktop application shall include:

- Left navigation sidebar
- Product logo
- Workspace or account name
- Primary navigation
- Upgrade indicator where relevant
- Help or methodology link
- User/security menu
- Top page header
- Main content region
- Optional contextual right panel only when useful

### Mobile shell

The mobile application shall include:

- Compact top bar
- Menu trigger
- Page title
- Notification access
- User/security menu
- Bottom or drawer navigation where appropriate
- Sticky primary action only when necessary

The mobile interface shall not display a permanently visible desktop sidebar.

## 10.16 Customer Navigation Structure

Recommended customer navigation:

### Primary

- Overview
- Domains
- Monitoring
- Notifications
- Reports
- Crawler registry

### Organisation

- Groups
- Imports
- Exports

### Account

- Plan and billing
- Security
- Feed
- Account settings

The navigation shall adapt to plan availability.

Unavailable premium features may be:

- Hidden when irrelevant
- Displayed with a clear upgrade label
- Never presented as broken or disabled without explanation

## 10.17 Super Admin Navigation Structure

Recommended Super Admin navigation:

### Overview

- Global dashboard
- System health

### Customers

- Users
- Subscriptions
- Transactions
- Entitlements
- Internal notes

### Product operations

- Domains
- Scans
- Scheduled jobs
- Notifications
- Shared reports

### Crawler intelligence

- Operators
- Crawlers
- Registry releases
- Ruleset releases
- Finding analytics

### Security

- Security events
- Blocked targets
- Rate limits
- Audit logs

### Configuration

- Plans
- Runtime settings
- Feature flags
- System notices
- Maintenance mode

Super Admin navigation shall be visually distinct from customer navigation.

## 10.18 Page Header Pattern

Every authenticated page shall include a consistent header containing:

- Page title
- Short optional description
- Breadcrumb where useful
- Primary action
- Secondary actions
- Status or last-updated metadata where relevant

Examples:

### Domains page

**Title:** Domains  
**Description:** Monitor and manage AI crawler policies across your websites.  
**Primary action:** Add domain

### Scan report

**Title:** example.com  
**Description:** AI crawler policy report  
**Metadata:** Scanned 22 July 2026 at 14:35 UTC  
**Primary action:** Run new scan

## 10.19 Card Design

Cards shall be used for meaningful grouping, not every block of content.

A standard card may include:

- Optional eyebrow label
- Title
- Supporting text
- Main value
- Trend or metadata
- Action
- Status

Card variants:

- Metric card
- Finding card
- Domain card
- Recommendation card
- Evidence card
- Empty-state card
- Upgrade card
- Warning callout

Cards shall use:

- Clear heading hierarchy
- Consistent padding
- Subtle border
- Minimal shadow
- Predictable action placement

## 10.20 Buttons

Button hierarchy shall include:

### Primary button

Used for one main action per view.

Examples:

- Audit domain
- Add domain
- Save policy
- Start checkout

### Secondary button

Used for alternative or supporting actions.

Examples:

- View methodology
- Export CSV
- Compare scans

### Tertiary or text button

Used for low-emphasis actions.

Examples:

- Cancel
- Learn more
- View source

### Destructive button

Used only for destructive actions.

Examples:

- Delete account
- Revoke access
- Block target

Button requirements:

- Minimum 44px recommended touch height
- Clear hover, focus, active and disabled states
- Loading state without layout shift
- Icons placed consistently
- No multiple visually equal primary actions
- Destructive actions require confirmation where appropriate

## 10.21 Form Controls

Inputs shall use persistent labels.

Every input shall support:

- Label
- Optional description
- Placeholder where useful
- Validation state
- Error message
- Success state where appropriate
- Disabled state
- Read-only state
- Keyboard navigation
- Autofill behaviour where applicable

Domain fields shall display:

- Normalisation feedback
- Unsafe-input errors
- Protocol correction
- Duplicate-domain warning
- Clear submit status

The interface shall never use placeholder text as the only label.

## 10.22 Data Tables

Tables shall be used for:

- Domain portfolios
- Crawler registry
- Users
- Subscriptions
- Transactions
- Scans
- Webhooks
- Security events
- Audit logs

Table requirements:

- Clear column labels
- Sort controls
- Filter controls
- Search where appropriate
- Pagination or virtualisation for large datasets
- Sticky header on long tables
- Row actions in predictable location
- Horizontal scrolling on mobile
- Priority-column responsive hiding
- Expandable mobile row details
- Loading skeleton
- Empty state
- Error state
- Accessible table semantics

Tables shall avoid excessive columns by default.

Users shall be able to open detail pages for full information.

## 10.23 Status Chips

Status chips shall use consistent terminology.

Examples:

### Domain status

- Healthy
- Needs attention
- Critical
- Incomplete
- Monitoring paused
- Scan failed

### Subscription status

- Active
- Trialing
- Past due
- Paused
- Cancelled
- Expired

### Crawler result

- Allowed
- Blocked
- No explicit rule
- Mixed
- Unknown
- Unavailable

Each chip shall include:

- Text
- Semantic colour
- Optional icon
- Accessible meaning

## 10.24 Policy Health Score Component

The Policy Health Score shall be presented with:

- Numeric score when available
- Text label
- Category breakdown
- Explanation
- Confidence or completeness state
- Link to scoring methodology
- Clear limitations

The score shall not use a speedometer-style gauge that implies false precision.

Preferred visual forms include:

- Compact horizontal progress band
- Circular summary with adjacent explanation
- Category bars
- Score card with status label

When evidence is insufficient, display:

> **Incomplete**

rather than a misleading numeric score.

## 10.25 Crawler Access Matrix Design

The crawler matrix is a core interface.

It shall support columns such as:

- Crawler
- Operator
- Purpose
- Declared result
- Matched rule
- Policy alignment
- Source
- Last verified

Users shall be able to:

- Filter by purpose
- Filter by result
- Search crawler name
- Expand row evidence
- Open crawler reference
- View matched `robots.txt` rule
- Compare with selected preset

Purpose shall be represented through:

- Text label
- Optional icon
- Consistent chip

The matrix shall remain usable on mobile through:

- Stacked cards
- Expandable rows
- Priority columns
- Horizontal scroll only where unavoidable

## 10.26 Finding Card Design

Each finding card shall include:

- Severity label
- Finding title
- Concise explanation
- Business impact
- Evidence summary
- Recommended action
- Source link
- Expandable technical details
- Finding code
- Ruleset version where needed

The default view shall prioritise:

1. What happened
2. Why it matters
3. What to do

Technical evidence may appear in an expandable section.

Critical findings shall not use aggressive flashing or alarming animation.

## 10.27 Evidence Panel Design

Evidence panels shall display:

- Resource URL
- Status code
- Content type
- Retrieval timestamp
- Relevant lines
- Matched rule
- Parser result
- Registry source
- Copy action

Code and evidence panels shall support:

- Monospace font
- Line numbers
- Syntax emphasis
- Horizontal scrolling
- Copy button
- Diff highlighting
- Accessible contrast
- Collapsed default for large content

Target-controlled text shall always be escaped.

## 10.28 Configuration Diff Design

The configuration recommendation shall show:

- Original content
- Proposed content
- Additions
- Removals
- Unchanged context
- Warning notes
- Copy proposed configuration
- Copy only added lines
- Download text file where supported

Diff colours shall be accessible.

Additions shall not rely only on green.

Removals shall not rely only on red.

Labels such as “Added” and “Removed” shall be present.

## 10.29 Change History and Timeline

Domain history shall use a timeline or list showing:

- Scan date
- Scan trigger
- Score
- Material changes
- Website drift
- Registry drift
- Scan failures
- Preset changes
- Administrative scans

Timeline entries shall include a concise summary and link to comparison.

A visual chart may show score over time, but the detailed history shall remain available as text.

## 10.30 Dashboard Overview Design

The customer overview dashboard shall include:

### Top summary

- Total saved domains
- Critical domains
- Domains needing attention
- Recent changes
- Next scheduled scans

### Priority actions

- Critical findings requiring review
- Failed monitoring
- Subscription issue
- Registry changes affecting domains

### Domain health

- Domain status list
- Score
- Last scan
- Next scan
- Open findings

### Recent activity

- Scans
- Policy changes
- Shared reports
- Preset changes

The dashboard shall prioritise actionable information over vanity metrics.

## 10.31 Domain Detail Page

The domain detail page shall include:

- Domain identity
- Current score
- Current preset
- Monitoring state
- Last and next scan
- Open finding summary
- Crawler matrix
- Policy-signal summary
- Recommendations
- Scan history
- Notification history
- Domain settings

Suggested tabs:

- Overview
- Crawlers
- Findings
- Recommendations
- Evidence
- History
- Settings

Tabs shall maintain URL state where practical.

## 10.32 Scan Progress UX

A running audit shall display:

- Current step
- Completed steps
- Approximate progress
- Clear explanation of what is happening
- Cancel or return option where safe
- Target URL
- Start time
- Non-blocking informational text

The interface shall not display a false exact percentage if progress cannot be measured accurately.

Recommended status copy:

- Validating the public target
- Retrieving `robots.txt`
- Checking crawler-specific rules
- Reviewing additional policy signals
- Generating findings
- Preparing your report

If a step takes longer, the interface may show:

> The website is responding more slowly than usual.

## 10.33 Loading States

Loading states shall use:

- Skeletons for predictable content
- Inline spinners for compact actions
- Progress steps for audits
- Disabled duplicate-submission controls

Loading states shall not:

- Cause major layout shift
- Hide all navigation
- Use indefinite animation without explanation
- Allow duplicate billing or destructive requests

## 10.34 Empty States

Every empty state shall explain:

- What the section contains
- Why it is empty
- What action the user can take

Examples:

### No domains

> Add your first domain to save audit history and monitor policy changes.

Button:

> Add domain

### No notifications

> No policy changes need your attention.

### No scan history

> Run the first scan to create a policy baseline.

Empty states may use minimal illustrations.

## 10.35 Error States

Errors shall include:

- Clear title
- Plain-language explanation
- Technical detail only when helpful
- Retry action where safe
- Alternative action
- Whether data was saved
- Support or documentation link where needed

Example:

> **The website could not be reached**

> CrawlPact could not establish a secure connection to this domain. The website may be unavailable or blocking automated requests.

Actions:

- Try again
- View technical details
- Audit another domain

## 10.36 Confirmation Dialogs

Confirmation dialogs shall be required for:

- Delete account
- Delete domain
- Revoke all sessions
- Revoke feed
- Revoke report
- Suspend user
- Block target
- Publish registry release
- Publish ruleset release
- Enter maintenance mode
- Global scan pause

Dialogs shall clearly explain:

- The action
- The effect
- Whether it is reversible
- The affected entity

High-risk actions may require typing a confirmation value.

## 10.37 Toast and Notification UX

Toasts shall be used for brief feedback such as:

- Domain saved
- Scan started
- Report link copied
- Settings updated
- Export prepared

Persistent errors shall not rely only on disappearing toasts.

Toasts shall:

- Remain keyboard accessible
- Be announced to assistive technology
- Avoid stacking excessively
- Include action when relevant
- Use clear timing

## 10.38 Onboarding UX

Onboarding shall remain lightweight.

The initial onboarding may include:

1. Register a passkey
2. Save recovery codes
3. Add or save a domain
4. Choose a policy preset
5. Review the first report
6. Explain monitoring

The user shall be able to skip non-security onboarding.

Recovery-code confirmation shall not be skippable without a clear acknowledgement of risk.

## 10.39 Pricing and Upgrade UX

Upgrade interfaces shall:

- Clearly show current plan
- Clearly show limits
- Explain paid value
- Display annual pricing
- Avoid manipulative urgency
- Link to Paddle checkout
- Explain taxes may apply
- Explain cancellation through Paddle
- Show what happens after cancellation

Upgrade prompts shall appear contextually.

Examples:

- When a user reaches the domain limit
- When monitoring is requested
- When CSV export is selected
- When agency reports are selected

The product shall not show an upgrade prompt after every action.

## 10.40 Billing UX

The billing page shall show:

- Current plan
- Subscription status
- Domain usage
- Monitoring frequency
- Renewal date
- Scheduled cancellation
- Billing-management button
- Upgrade options
- Entitlement warnings
- Past-due notice where relevant

CrawlPact shall not reproduce Paddle’s complete invoice interface.

The user shall be directed to Paddle’s portal for supported billing actions.

## 10.41 Notification Centre UX

The notification centre shall support:

- Unread indicator
- Severity filter
- Domain filter
- Type filter
- Mark as read
- Mark all as read
- Open related report
- Clear grouping of repeated failures

Notifications shall use concise titles.

Example:

> Search crawler access changed on example.com

Supporting text:

> `OAI-SearchBot` changed from allowed to blocked after the latest `robots.txt` update.

## 10.42 Super Admin UX

The Super Admin interface shall be information dense but organised.

It shall use:

- Global search
- Clear filters
- Saved filter views where useful
- Date-range selector
- Summary metrics
- Operational tables
- Detail drawers or pages
- Strong separation between read-only and modifying actions
- Visible production or sandbox environment indicator

The interface shall avoid exposing destructive actions directly in table rows without confirmation.

## 10.43 Environment Indicators

Preview, development, sandbox and production environments shall be visually distinguishable.

A non-production environment shall display a persistent label such as:

- Development
- Preview
- Paddle Sandbox

Production shall not display a distracting label.

Paddle sandbox data shall never be mixed visually with production revenue totals.

## 10.44 Print and Report Design

Print-ready reports shall use:

- White background
- CrawlPact logo
- Domain and scan metadata
- Clear page title
- Executive summary
- Compact status legend
- Accessible table styling
- Page numbers
- Source references
- Limitations
- Agency branding where permitted

Print reports shall avoid:

- Interactive controls
- Navigation sidebar
- Dark backgrounds
- Excessive colour usage
- Content clipped across pages
- Cards splitting awkwardly between pages

## 10.45 Motion and Animation

Motion shall be subtle and functional.

Approved uses:

- Menu transitions
- Accordion expansion
- Modal entry
- Loading indicators
- Progress-step transitions
- Small chart updates

Animation duration should generally be:

- 120–180ms for small interactions
- 180–250ms for larger transitions

The product shall respect `prefers-reduced-motion`.

The product shall not use:

- Continuous decorative motion
- Parallax backgrounds
- Large animated gradients
- Flashing status indicators
- Excessive page transitions
- Animated counters that delay comprehension

## 10.46 Mobile UX Requirements

The mobile experience shall support all critical functions:

- Run audit
- View summary
- View findings
- Expand evidence
- Save domain
- Change preset
- View notifications
- Manage basic security
- Open Paddle portal
- Review domain status

Large tables shall convert to:

- Stacked data cards
- Expandable rows
- Priority columns
- Horizontal scroll only when unavoidable

Primary actions shall remain reachable.

Touch targets should be at least 44×44px where practical.

## 10.47 Tablet UX Requirements

Tablet layouts may use:

- Collapsible sidebar
- Two-column dashboard cards
- Full-width tables
- Adaptive detail drawers
- Compact top navigation

The interface shall remain usable in portrait and landscape modes.

## 10.48 Keyboard UX

All functions shall be keyboard accessible.

Requirements:

- Logical tab order
- Skip-to-content link
- Visible focus state
- Escape closes dialogs
- Arrow-key support in menus where appropriate
- Enter and Space activate controls
- Focus returns correctly after modal close
- Table row menus are keyboard accessible

Optional future keyboard shortcuts may include:

- `/` focus global search
- `g d` go to domains
- `g n` go to notifications

Keyboard shortcuts shall not be required for normal use.

## 10.49 Screen-Reader UX

The application shall:

- Use semantic landmarks
- Use proper heading hierarchy
- Label icons
- Announce loading completion
- Announce form errors
- Announce toast messages
- Use accessible names for buttons
- Describe status changes
- Avoid inaccessible custom controls

Charts and visual summaries shall include text equivalents.

## 10.50 Content Design and Microcopy

Product copy shall be:

- Direct
- Precise
- Neutral
- Helpful
- Non-alarmist
- Technically accurate

Preferred terminology:

- Audit
- Finding
- Evidence
- Policy
- Recommendation
- Declared access
- Review needed
- Incomplete
- Monitoring
- Change detected

Avoid:

- Dangerous
- Exposed
- Hacked
- Fully protected
- Guaranteed
- Compliant
- Illegal
- Safe from AI

Microcopy shall explain consequences without fear.

Example:

Avoid:

> Your content is exposed to AI.

Use:

> Documented training crawlers are not explicitly blocked by the current policy.

## 10.51 UX Writing Pattern for Findings

Every finding shall follow this structure:

### What happened

A concise factual statement.

### Why it matters

The likely business effect.

### Evidence

The matched resource and directive.

### Recommended action

A clear technical next step.

### Limitation

Any uncertainty or non-enforcement caveat.

## 10.52 UX Requirements for No-Support Operation

To minimise support, the UI shall proactively explain:

- Why a scan failed
- What each crawler purpose means
- Why a recommendation was generated
- Why a score changed
- Difference between website drift and registry drift
- How plan limits work
- How billing is managed
- How passkey recovery works
- Why `robots.txt` does not guarantee enforcement
- Why some evidence is incomplete

Contextual help shall appear close to the relevant feature.

The product should not rely on a separate large help centre for basic understanding.

## 10.53 Design-System Implementation

The design system shall be implemented as reusable components and tokens.

Required token categories:

- Colour
- Typography
- Spacing
- Radius
- Shadow
- Breakpoint
- Z-index
- Motion
- Container width
- Icon sizing

Required reusable components:

- Button
- Icon button
- Link
- Input
- Textarea
- Select
- Checkbox
- Radio
- Switch
- Combobox
- Search field
- Date-range field
- Form field
- Status chip
- Tooltip
- Popover
- Dropdown menu
- Modal
- Confirmation dialog
- Drawer
- Tabs
- Accordion
- Breadcrumb
- Pagination
- Data table
- Card
- Metric card
- Finding card
- Evidence panel
- Code block
- Diff viewer
- Timeline
- Empty state
- Error state
- Skeleton
- Toast
- Alert
- Banner
- Progress steps
- Score component

## 10.54 Component Documentation

Each reusable component shall document:

- Purpose
- Variants
- Sizes
- States
- Accessibility behaviour
- Keyboard interaction
- Responsive behaviour
- Usage examples
- Prohibited usage

Component behaviour shall be tested independently where practical.

## 10.55 UI State Requirements

Every major page and component shall be designed for:

- Default
- Hover
- Focus
- Active
- Disabled
- Loading
- Empty
- Error
- Success
- Partial data
- Permission denied
- Plan restricted
- Offline or unavailable
- Stale data

The UI shall not be considered complete if only the success state is designed.

## 10.56 Visual QA Requirements

Before launch, visual QA shall cover:

- 360px mobile
- 390px mobile
- 480px large mobile
- 768px tablet
- 1024px small desktop
- 1280px desktop
- 1440px wide desktop

Visual QA shall test:

- Long domains
- Long crawler names
- Long URLs
- Large finding counts
- Empty data
- Errors
- Loading
- Large tables
- Translated-length simulation where practical
- Browser zoom at 200%
- Reduced motion
- High contrast where practical
- Print output

## 10.57 Design Acceptance Criteria

The UI/UX shall not be considered production ready until:

1. The full customer application uses the approved design system.
2. The Super Admin uses the same core system with an operational variant.
3. All critical mobile workflows are usable.
4. Keyboard navigation works.
5. Focus states are visible.
6. Colour contrast passes WCAG AA.
7. Loading, empty and error states exist.
8. Tables work on small screens.
9. Long technical content does not break layouts.
10. Reports print cleanly.
11. No target-controlled HTML is rendered unsafely.
12. Primary actions are visually clear.
13. The product does not use fake trust indicators.
14. The interface does not overstate product certainty.
15. Components are reusable and documented.
16. Core pages pass visual regression tests.
17. Marketing pages achieve strong performance.
18. No major layout shift occurs during primary workflows.
19. The interface feels consistent across public, customer and administrator areas.
20. A final professional UI/UX review has been completed.

---

# 11. Additional Public Website Pages

The public website shall include:

- `/`
- `/audit`
- `/pricing`
- `/crawlers`
- `/crawlers/{crawler-slug}`
- `/tools`
- `/tools/ai-crawler-checker`
- `/tools/robots-txt-ai-validator`
- `/tools/rsl-validator`
- `/tools/llms-txt-validator`
- `/tools/content-signals-checker`
- `/guides`
- `/guides/{article-slug}`
- `/methodology`
- `/scoring`
- `/scanner`
- `/changelog`
- `/status`
- `/security`
- `/privacy`
- `/terms`
- `/acceptable-use`
- `/limitations`
- `/sign-in`
- `/app`

---

# 12. Core User Journeys

## 12.1 Anonymous Audit Journey

1. User lands on the home page.
2. User enters a domain.
3. CrawlPact validates the input.
4. CrawlPact performs a bounded safe scan.
5. CrawlPact evaluates applicable crawler policies.
6. CrawlPact displays a report.
7. User selects or changes a policy preset.
8. Recommendations are recalculated.
9. User copies configuration guidance.
10. User may register to save the domain.

## 12.2 Registered Monitoring Journey

1. User creates an account with a passkey.
2. User saves the audited domain.
3. User selects a policy preset.
4. The current scan becomes the baseline.
5. The system schedules future scans.
6. A later scan detects a material change.
7. The system creates an in-app notification.
8. The user opens the before-and-after comparison.
9. The user reviews the recommendation.

## 12.3 Subscription Journey

1. User selects a paid plan.
2. CrawlPact launches Paddle Checkout.
3. Paddle processes payment.
4. Paddle sends signed webhook events.
5. CrawlPact verifies the webhook.
6. Entitlements are updated.
7. The user gains paid access.
8. Billing management is handled through Paddle’s portal.

## 12.4 Agency Journey

1. Agency user creates client groups.
2. Agency imports or adds domains.
3. Policy presets are assigned.
4. CrawlPact scans the portfolio.
5. Portfolio risk is displayed.
6. The agency opens an individual report.
7. A client-safe report link is generated.
8. The agency exports findings where required.

---

# 13. Domain Input and Normalisation Requirements

**FR-DOM-001**  
The system shall accept:

- Bare domains
- Hostnames
- HTTP URLs
- HTTPS URLs
- URLs with paths

**FR-DOM-002**  
The system shall normalise:

- Hostname casing
- Scheme
- Internationalised domain names
- Default ports
- Fragments
- Duplicate slashes
- Trailing dots

**FR-DOM-003**  
The original input shall be retained for display and troubleshooting.

**FR-DOM-004**  
The system shall determine a canonical public origin.

**FR-DOM-005**  
HTTPS shall be attempted first unless the submitted URL explicitly requires another supported approach.

**FR-DOM-006**  
Equivalent saved origins shall not consume duplicate domain slots for the same account.

**FR-DOM-007**  
Unsupported schemes shall be rejected.

Unsupported schemes include:

- `file:`
- `ftp:`
- `data:`
- `javascript:`
- `mailto:`
- `ws:`
- `wss:`

---

# 14. Public Audit Requirements

**FR-AUD-001**  
An anonymous user shall be able to complete an audit without registration.

**FR-AUD-002**  
The audit shall display meaningful progress stages.

Suggested stages:

1. Validating target
2. Checking reachability
3. Retrieving policy resources
4. Parsing directives
5. Evaluating crawlers
6. Checking additional signals
7. Generating findings
8. Preparing the report

**FR-AUD-003**  
Equivalent recent anonymous audits may use cached results.

**FR-AUD-004**  
Cached results shall show their timestamp.

**FR-AUD-005**  
A permitted user may request a fresh scan.

**FR-AUD-006**  
Critical findings shall not be hidden behind payment.

**FR-AUD-007**  
Failure of one optional resource shall not automatically fail the entire audit.

**FR-AUD-008**  
Audit statuses shall include:

- Completed
- Completed with warnings
- Incomplete
- Target unavailable
- Blocked for safety
- Rate limited
- Internal failure

**FR-AUD-009**  
The report shall explain whether a failure occurred because of the target or CrawlPact.

---

# 15. Safe Fetching and SSRF Protection

**FR-FET-001**  
Only public HTTP and HTTPS resources shall be fetched.

**FR-FET-002**  
The scanner shall reject:

- Loopback addresses
- Private IPv4 ranges
- Private IPv6 ranges
- Link-local ranges
- Multicast ranges
- Reserved ranges
- Cloud metadata addresses
- Localhost aliases
- Internal-only hostnames
- Alternative encoded private addresses

**FR-FET-003**  
Literal IP targets shall be rejected in the MVP.

**FR-FET-004**  
Redirect destinations shall be revalidated before following.

**FR-FET-005**  
A resource shall follow no more than five redirects.

**FR-FET-006**  
Approved ports shall be limited to safe public HTTP and HTTPS ports.

**FR-FET-007**  
The scanner shall enforce:

- Connection timeout
- First-byte timeout
- Per-resource timeout
- Total-scan timeout
- Header-size limits
- Body-size limits
- External-request limits

**FR-FET-008**  
A normal scan shall use no more than approximately 12 external requests.

**FR-FET-009**  
The scanner shall not:

- Execute JavaScript
- Submit forms
- Authenticate
- Retain target cookies
- Upload files
- Follow unsupported protocols

**FR-FET-010**  
The scanner shall use an identifiable CrawlPact user agent.

Example:

`CrawlPactAuditBot/1.0 (+https://crawlpact.com/scanner)`

**FR-FET-011**  
The scanner shall not impersonate third-party crawlers.

**FR-FET-012**  
Each fetch result shall record:

- Requested URL
- Final URL
- Status code
- Content type
- Content size
- Redirect count
- Duration
- Relevant headers
- Resource hash
- Truncation status
- Error category

---

# 16. Robots.txt Requirements

**FR-ROB-001**  
The system shall fetch `/robots.txt`.

**FR-ROB-002**  
The parser shall follow RFC 9309 behaviour as closely as practical.

**FR-ROB-003**  
The parser shall preserve:

- Original text
- Line numbers
- Comments
- Blank lines
- Unknown fields
- Group boundaries

**FR-ROB-004**  
The parser shall recognise:

- `User-agent`
- `Allow`
- `Disallow`
- `Sitemap`

**FR-ROB-005**  
Non-standard fields may be recognised but shall be labelled as non-standard.

**FR-ROB-006**  
The evaluator shall support:

- Wildcards
- End anchors
- Longest-match behaviour
- Multiple groups
- Wildcard user-agent groups
- Path-level evaluation

**FR-ROB-007**  
Each crawler result shall show:

- Applicable group
- Applicable rule
- Matched path
- Result
- Line number
- Evaluation explanation

**FR-ROB-008**  
The system shall detect:

- Empty files
- HTML returned as `robots.txt`
- Invalid encodings
- Oversized files
- Missing values
- Duplicate groups
- Conflicting groups
- Broad wildcard blocks
- Invalid sitemap declarations
- Redirect problems
- Server failures

**FR-ROB-009**  
A 404 response shall be treated as no `robots.txt` file.

**FR-ROB-010**  
A successful HTML response shall not be treated as valid robots content.

**FR-ROB-011**  
Every robots-based report shall state:

> This result reflects the website’s declared crawler instructions. It does not prove that every crawler will obey them.

---

# 17. Crawler Registry Requirements

**FR-REG-001**  
CrawlPact shall maintain a versioned crawler registry.

**FR-REG-002**  
Each crawler record shall include:

- Crawler ID
- Operator
- Name
- User-agent token
- Purpose
- Description
- Official source
- First verified date
- Last verified date
- Lifecycle status
- Alternative tokens
- Optional published IP information
- Notes

**FR-REG-003**  
Purpose categories shall include:

- Search
- Training
- User-triggered retrieval
- Agent/action
- Advertising or validation
- Research
- Mixed
- Unknown

**FR-REG-004**  
Lifecycle states shall include:

- Active
- Deprecated
- Replaced
- Unverified
- Retired

**FR-REG-005**  
A crawler shall not be published without:

- A reliable source
- A verified token
- A purpose classification
- A verification date
- Administrator approval

**FR-REG-006**  
Registry releases shall be immutable.

**FR-REG-007**  
Historical scans shall retain the registry version originally used.

**FR-REG-008**  
A registry update may trigger re-evaluation of saved domains.

**FR-REG-009**  
Changes caused by updated crawler information shall be labelled as registry drift.

**FR-REG-010**  
Registry drift shall not be presented as a website configuration change.

---

# 18. Policy Presets

CrawlPact shall include four initial presets.

## 18.1 Maximum AI Visibility

Designed for websites prioritising AI search and user-triggered discovery.

## 18.2 Allow Search, Block Training

Designed for websites that want search visibility while restricting documented training crawlers.

## 18.3 Publisher Protection

Designed for publishers requiring explicit crawler decisions, training restrictions and licensing checks.

## 18.4 Block Known AI Crawlers

Designed for restrictive policies while clearly warning about possible search-visibility consequences.

**FR-POL-001**  
Each crawler result shall be one of:

- Allowed
- Blocked
- No explicit rule
- Mixed or conditional
- Unknown
- Resource unavailable
- Not evaluated

**FR-POL-002**  
The selected preset shall influence:

- Finding severity
- Policy Health Score
- Recommendations
- Generated configuration

**FR-POL-003**  
Changing a preset shall not modify the customer’s website.

**FR-POL-004**  
Preset changes shall be recorded in account history.

---

# 19. Additional Policy Signals

## 19.1 llms.txt

CrawlPact shall check:

- `/llms.txt`
- `/llms-full.txt`, where appropriate

Validation shall include:

- Status
- Content type
- File size
- Basic Markdown structure
- Linked resources
- Malformed content
- Server failures

A missing `llms.txt` file shall be informational rather than critical.

## 19.2 RSL

CrawlPact shall:

- Discover supported RSL declarations
- Validate supported RSL syntax
- Display declared permissions
- Display declared prohibitions
- Display licensing or payment terms
- Identify unsupported fields
- Detect conflicts with other signals

RSL shall be described as a machine-readable declaration, not technical enforcement.

## 19.3 Content Signals

CrawlPact shall:

- Detect recognised Content Signals
- Preserve unknown future fields
- Identify contradictions with crawler-specific rules

## 19.4 HTML and HTTP Signals

The scanner shall inspect bounded page responses for:

- Meta robots
- `X-Robots-Tag`
- Canonical URL
- Relevant `Link` headers
- Policy references
- RSL associations

## 19.5 Sitemap Signals

The system shall:

- Discover sitemap declarations
- Validate basic sitemap accessibility
- Avoid crawling every sitemap URL
- Inspect only a bounded sample where required

---

# 20. Conflict Detection

The system shall detect contradictions such as:

- Search crawlers blocked under Maximum AI Visibility
- Training crawlers allowed under Block Training
- Search visibility expected while search crawlers are blocked
- Page-level directives inaccessible because the page is blocked
- RSL declarations conflicting with Content Signals
- Wildcard rules overriding specific intended rules
- Deprecated crawler tokens still used
- Replacement crawler tokens missing
- Multiple groups causing unexpected results
- Headers and site-level policy disagreeing

Each conflict shall contain:

- Conflicting signals
- Resource location
- Relevant lines
- Likely impact
- Recommended resolution
- Confidence level

---

# 21. Recommendation Engine

**FR-REC-001**  
Recommendations shall be deterministic.

**FR-REC-002**  
The MVP shall not depend on an AI model.

**FR-REC-003**  
The system shall generate recommended `robots.txt` changes.

**FR-REC-004**  
Unrelated existing directives shall be preserved where practical.

**FR-REC-005**  
The report shall show:

- Current configuration
- Proposed configuration
- Added lines
- Removed lines
- Changed lines
- Explanation

**FR-REC-006**  
CrawlPact shall never directly modify the customer’s website in the MVP.

**FR-REC-007**  
Recommendations shall be copyable.

**FR-REC-008**  
Recommendations that may reduce search visibility shall display a warning.

**FR-REC-009**  
Recommendation rules shall be versioned.

---

# 22. Findings and Scoring

## 22.1 Finding Structure

Every finding shall include:

- Finding code
- Severity
- Category
- Title
- Summary
- Detailed explanation
- Evidence
- Affected crawler or signal
- Business impact
- Recommended action
- Confidence
- Source
- Ruleset version

## 22.2 Severity Levels

| Severity | Meaning |
|---|---|
| Critical | Configuration clearly defeats the selected objective or creates a serious safety problem |
| High | Material policy mismatch with likely business impact |
| Medium | Conflict, ambiguity or meaningful emerging-standard issue |
| Low | Maintainability or best-practice issue |
| Information | Neutral observation or optional status |

## 22.3 Policy Health Score

The score shall range from 0 to 100 when sufficient evidence is available.

Suggested weighting:

| Category | Weight |
|---|---:|
| Resource availability and validity | 15% |
| Syntax and deterministic evaluation | 20% |
| Business-objective alignment | 30% |
| Cross-signal consistency | 15% |
| Registry freshness and explicitness | 10% |
| Monitoring and change risk | 10% |

Score labels:

| Score | Label |
|---:|---|
| 90–100 | Strong |
| 75–89 | Good |
| 50–74 | Needs attention |
| 25–49 | Weak |
| 0–24 | Critical |
| Insufficient evidence | Incomplete |

The score shall not be described as:

- Compliance score
- Legal score
- Security score
- Protection score

---

# 23. Reports

Every report shall contain:

1. Domain
2. Scan date
3. Executive summary
4. Policy Health Score
5. Selected preset
6. Crawler-purpose matrix
7. Critical and high findings
8. Complete findings
9. Standards-readiness summary
10. Exact evidence
11. Matched-rule traces
12. Recommendations
13. Configuration diff
14. Change history
15. Sources
16. Registry version
17. Ruleset version
18. Product limitations

Reports shall be:

- Responsive
- Accessible
- Printable
- Browser-PDF compatible
- Private by default

Paid plans shall support CSV export.

Private report links shall:

- Use high-entropy tokens
- Be revocable
- Be optionally expiring
- Be marked `noindex`
- Exclude private account information

---

# 24. Authentication and Account Security

CrawlPact shall use passkeys/WebAuthn.

The MVP shall not require passwords or email-based authentication.

Users shall be able to:

- Register a passkey
- Add additional passkeys
- Rename passkeys
- Remove passkeys
- View sessions
- End sessions
- Sign out all sessions
- Generate recovery codes
- Regenerate recovery codes
- Delete the account

Recovery codes shall:

- Be shown once
- Be downloadable
- Be one-time use
- Be stored only as hashes

Users shall be encouraged to register at least two passkeys.

Sensitive actions shall require recent authentication.

---

# 25. Saved Domains and Monitoring

A saved domain shall include:

- Display name
- Canonical origin
- Owner
- Group
- Selected preset
- Monitoring state
- Monitoring frequency
- Last scan
- Next scan
- Current score
- Open findings
- Notes

Users shall be able to:

- Rename a domain
- Change its preset
- Pause monitoring
- Resume monitoring
- Move it between groups
- Delete it
- Trigger a manual rescan within quota

Scheduled monitoring shall:

- Select only due domains
- Use bounded batches
- Prevent duplicate scans
- Apply retry backoff
- Compare semantic changes
- Suppress formatting-only noise
- Distinguish website drift from registry drift
- Group repeated failures
- Pause long-term failing domains when necessary

---

# 26. Notifications

Notifications shall be available through:

- In-app notification centre
- Private Atom feed for paid users

Notification types shall include:

- Critical policy change
- High-severity policy change
- New crawler
- Crawler-purpose change
- Registry drift
- Resource failure
- Monitoring paused
- Subscription issue
- Shared report expiry
- Platform notice

No email or SMS notification provider shall be used.

---

# 27. Paddle Billing

Paddle shall process annual subscriptions.

The system shall support:

- Paddle Checkout
- Signed Paddle webhooks
- Idempotent event handling
- Out-of-order event handling
- Local entitlement caching
- Paddle customer portal
- Cancellation
- Renewal
- Past-due states
- Refunds
- Chargebacks
- Sandbox and production environments

Paddle shall remain the billing source of truth.

The local application shall store only the data required to:

- Identify the customer
- Identify the subscription
- Identify the plan
- Determine access
- Detect synchronisation errors

---

# 28. Super Admin Control Center

## 28.1 Super Admin Objective

The Super Admin Control Center shall provide the platform owner with complete operational visibility and controlled management of CrawlPact.

The Super Admin interface shall be separate from the customer dashboard.

It shall be available only to explicitly authorised administrator accounts.

## 28.2 Super Admin Global Dashboard

The dashboard shall display:

- Total registered users
- New users
- Active users
- Suspended users
- Paying customers
- Active subscriptions
- Past-due subscriptions
- Cancelled subscriptions
- Saved domains
- Monitored domains
- Completed scans
- Failed scans
- Critical findings
- Security events
- Gross revenue
- Refunds
- Chargebacks
- Estimated ARR
- Estimated monthly recurring equivalent
- Current system status

Metrics shall support:

- Today
- Last seven days
- Last 30 days
- Current month
- Previous month
- Current year
- Custom date range

Sandbox and production data shall be separated.

## 28.3 User Management

The Super Admin shall be able to search users by:

- User ID
- Display name
- Paddle customer ID
- Paddle subscription ID
- Domain
- Plan
- Account status

A user profile shall display:

- User ID
- Creation date
- Status
- Passkey count
- Session count
- Plan
- Subscription status
- Paddle customer ID
- Saved-domain count
- Monitoring usage
- Manual-scan usage
- Latest activity
- Notifications
- Internal notes

The Super Admin shall be able to:

- Suspend an account
- Restore an account
- Revoke sessions
- Pause monitoring
- Revoke feed tokens
- Revoke shared reports
- Begin account deletion
- Cancel pending deletion
- Add internal notes

Sensitive authentication material shall never be displayed.

Every sensitive action shall require:

- A reason
- Recent administrator authentication
- An audit-log entry

## 28.4 Safe Account Inspection

The Super Admin shall have a read-only support view showing the customer-visible product state.

Direct customer impersonation shall not be included in the MVP.

A future impersonation capability shall require:

- Explicit reason
- Short-lived access
- Visible impersonation indicator
- Full audit logging
- Billing and security restrictions

## 28.5 Subscription Management

The Super Admin shall view all subscriptions with:

- CrawlPact user
- Paddle customer ID
- Paddle subscription ID
- Plan
- Status
- Billing period
- Renewal date
- Cancellation state
- Past-due state
- Last Paddle event
- Local entitlement state
- Synchronisation state

Subscriptions shall be filterable by:

- Plan
- Status
- Renewal date
- Cancellation
- Past due
- Entitlement mismatch
- Synchronisation error

The Super Admin shall be able to request a Paddle resynchronisation.

Temporary administrative entitlements may be granted only when:

- An expiry date is defined
- A reason is recorded
- The action is audited
- The entitlement is visibly labelled

## 28.6 Payment and Revenue Monitoring

The Super Admin shall view relevant Paddle transaction records.

Displayed data may include:

- Transaction ID
- User
- Subscription
- Plan
- Currency
- Gross amount
- Tax
- Fee, where available
- Net amount, where available
- Status
- Transaction date
- Payment date
- Refund status
- Chargeback status

The revenue dashboard shall display:

- Gross sales
- Successful payments
- Failed payments
- Refunded amount
- Chargebacks
- Revenue by plan
- New subscriptions
- Renewals
- Cancellations
- Upgrades
- Downgrades
- Estimated ARR
- Monthly recurring equivalent

Locally calculated values shall be clearly labelled as estimates.

## 28.7 Paddle Webhook Monitoring

The Super Admin shall view:

- Event ID
- Event type
- Received time
- Occurrence time
- Processing status
- Processing attempts
- Related customer
- Related subscription
- Error
- Last retry time

Webhook statuses shall include:

- Pending
- Processed
- Ignored
- Failed
- Retrying
- Permanently failed

The Super Admin may retry eligible failed webhooks.

Webhook retrying shall remain idempotent.

Sensitive payload fields shall be redacted.

## 28.8 Global Domain Management

The Super Admin shall be able to view all saved domains.

The global domain table shall include:

- Domain
- Owner
- Plan
- Preset
- Monitoring status
- Last scan
- Next scan
- Score
- Critical findings
- Failure count

The Super Admin shall be able to:

- Search domains
- View scan history
- Trigger an administrative scan
- Pause monitoring
- Resume monitoring
- Block unsafe targets
- Remove target blocks
- Review latest findings

Administrative scans shall not consume customer quotas.

## 28.9 Scan Operations

The operations dashboard shall display:

- Scans started
- Scans completed
- Scans failed
- Average duration
- Pending scans
- Retrying scans
- Paused domains
- Failure categories
- High-failure hosts
- Average external requests per scan

Scan failures shall be filterable by:

- DNS
- TLS
- Timeout
- Unsafe target
- Redirect
- Size limit
- 403
- 404
- 429
- 5xx
- Parser error
- Application error

## 28.10 Scheduler and Cron Monitoring

Each scheduled-job execution shall display:

- Job name
- Start time
- Completion time
- Status
- Domains selected
- Scans created
- Completed scans
- Failed scans
- Duration
- Error summary

The system shall detect:

- Missed executions
- Overlapping jobs
- Stuck jobs
- Long executions
- Excessive failure rates

The Super Admin shall be able to pause scheduled monitoring globally during an incident.

Global pause and resume actions shall require confirmation and a reason.

## 28.11 Registry Administration

The Super Admin shall be able to:

- Create crawler operators
- Create crawler records
- Update source evidence
- Deprecate tokens
- Define replacement crawlers
- Create registry releases
- Compare releases
- Publish releases
- Roll back the active release pointer
- Trigger domain re-evaluation
- Publish changelog entries

Published versions shall remain immutable.

Historical scans shall not be modified.

## 28.12 Findings and Ruleset Monitoring

The Super Admin shall view:

- Most frequent findings
- Findings by severity
- Findings by crawler
- Findings by preset
- Findings by plan
- Newly introduced findings
- Findings with high dismissal or dispute rates

A recommendation-rule change shall require a new ruleset version.

Historical findings shall retain their original ruleset.

## 28.13 Product Usage Analytics

The Super Admin shall view first-party metrics for:

- Landing-page visits
- Audit starts
- Audit completions
- Audit failure rate
- Account registrations
- Domains saved
- Presets selected
- Manual rescans
- Shared reports
- CSV exports
- Pricing views
- Checkout starts
- Paid conversions
- Monitoring notifications opened

Analytics shall avoid storing unnecessary personal data.

## 28.14 Security Monitoring

The security dashboard shall show:

- Unsafe scan attempts
- Rate-limit events
- Authentication failures
- Recovery-code failures
- Suspicious sessions
- Invalid Paddle signatures
- Replayed webhooks
- High-volume scanning accounts
- Frequently scanned targets
- Administrator security actions

The Super Admin shall be able to:

- Suspend abusive users
- Block abusive targets
- Revoke sessions
- Revoke feed tokens
- Revoke reports

Security actions shall require a recorded reason.

## 28.15 Content and Public Notices

The Super Admin shall be able to manage structured operational content for:

- Crawler records
- Registry changelog
- Product announcements
- System notices
- Scanner information
- Scoring methodology
- Maintenance messages

Long-form guides and articles may remain repository-managed during the MVP.

A complex CMS shall not be built unless operationally necessary.

## 28.16 Runtime Configuration

The Super Admin shall be able to manage approved settings such as:

- Anonymous audit limits
- Manual scan limits
- Maximum body size
- Fetch timeout
- Redirect limit
- Scan batch size
- Monitoring interval
- Retry interval
- Report expiry
- Data retention
- Billing grace period
- Maintenance mode

Security-critical settings shall use validated safe ranges.

Secrets shall never be displayed or edited through the Super Admin interface.

## 28.17 Maintenance Mode

Maintenance mode shall support:

- Public website remaining online
- Dashboard becoming read-only
- New audits being paused
- Scheduled scans being paused
- Paddle webhooks remaining operational
- Super Admin access remaining operational

## 28.18 Administrative Roles

The initial release may use only the Super Admin role.

The data model shall support future roles:

- Super Admin
- Registry Manager
- Billing Viewer
- Support Viewer
- Security Administrator
- Content Manager

Role enforcement shall occur on the server.

## 28.19 Super Admin Audit Log

Every sensitive administrative action shall record:

- Administrator ID
- Action
- Target
- Previous state, where applicable
- New state, where applicable
- Reason
- Timestamp
- Request ID

Audit logs shall cover:

- User suspension
- Session revocation
- Entitlement grants
- Subscription reconciliation
- Domain-monitoring changes
- Registry publication
- Ruleset publication
- Webhook retries
- Target blocks
- Configuration changes
- Maintenance mode
- Report revocation

Administrative audit logs shall not be editable through the interface.

## 28.20 Super Admin Security

Super Admin accounts shall require:

- Passkey authentication
- At least two registered passkeys
- Shorter session expiration
- Recent authentication for sensitive actions
- Separate production and preview access
- Stricter rate limits
- CSRF protection
- Non-indexable routes
- Offline recovery material

---

# 29. Agency Features

Agency users shall be able to:

- Create client groups
- Add client names
- Batch-import domains
- Review import errors
- View portfolio summaries
- Filter by severity
- Filter by scan status
- Filter by score
- Generate client-safe links
- Export CSV
- Add limited agency branding

Agency branding shall not remove CrawlPact’s legal or technical limitations.

---

# 30. SEO Requirements

## 30.1 SEO Acquisition Model

CrawlPact shall acquire users through:

- Free tools
- Crawler-reference pages
- Comparison pages
- Decision guides
- Troubleshooting guides
- CMS guides
- Hosting guides
- Standards documentation
- Registry changelogs
- Product-led shared reports

## 30.2 Initial Keyword Clusters

- AI crawler checker
- AI robots.txt checker
- GPTBot checker
- ClaudeBot checker
- PerplexityBot checker
- AI crawler policy
- Block AI training crawlers
- Allow AI search crawlers
- AI crawler monitor
- Robots.txt change monitor
- RSL validator
- Content Signals checker
- llms.txt validator

## 30.3 Technical SEO

Public indexable pages shall have:

- Unique titles
- Unique descriptions
- Canonical URLs
- Semantic headings
- Open Graph metadata
- Appropriate structured data
- Accurate updated dates

Private pages shall not be indexed.

Arbitrary domain reports shall be `noindex`.

XML sitemaps shall contain only reviewed public pages.

Thin programmatic pages shall not be generated.

## 30.4 Initial Content Minimum

Before launch, publish at least:

- 20 crawler-reference pages
- 10 decision or comparison guides
- 5 implementation guides
- 5 troubleshooting guides
- 4 free validator pages
- 1 methodology page
- 1 scoring page
- 1 registry changelog

---

# 31. Technical Architecture

## 31.1 Recommended Stack

| Layer | Recommendation |
|---|---|
| Public website | Astro |
| Interactive UI | React islands or a lightweight React application |
| API | Cloudflare Workers |
| Language | Strict TypeScript |
| Router | Hono or equivalent |
| Database | Cloudflare D1 |
| Optional large-object storage | Cloudflare R2 |
| Scheduling | Cloudflare Cron Triggers |
| Concurrency coordination | Durable Objects where justified |
| Authentication | WebAuthn/passkeys |
| Payments | Paddle |
| Styling | CSS variables with Tailwind CSS or a controlled component system |
| UI component primitives | Accessible headless components or internally maintained equivalents |
| Icons | One consistent SVG icon library |
| Testing | Vitest and Playwright |
| Visual regression | Playwright screenshots or equivalent |
| Deployment | Cloudflare |

## 31.2 Core Components

1. Public landing site
2. Free audit interface
3. Customer dashboard
4. Super Admin Control Center
5. Design system and component library
6. Safe target validator
7. Fetch engine
8. `robots.txt` parser
9. Additional signal parsers
10. Crawler registry
11. Policy engine
12. Conflict detector
13. Recommendation engine
14. Scoring engine
15. Report renderer
16. Monitoring scheduler
17. Notification service
18. Paddle adapter
19. Authentication service
20. First-party analytics
21. Administrative audit system

---

# 32. Core Database Model

The final database shall include at least:

## Identity

- `users`
- `passkey_credentials`
- `recovery_codes`
- `sessions`
- `admin_roles`
- `admin_role_assignments`

## Billing

- `plans`
- `billing_customers`
- `subscriptions`
- `transactions`
- `webhook_events`
- `temporary_entitlements`

## Domains and Scans

- `domain_groups`
- `domains`
- `scans`
- `scan_resources`
- `scan_crawler_results`
- `findings`
- `scan_diffs`

## Registry

- `crawler_operators`
- `crawlers`
- `registry_versions`
- `registry_version_entries`
- `ruleset_versions`

## Notifications and Sharing

- `notifications`
- `feed_tokens`
- `shared_reports`
- `system_notices`

## Administration and Security

- `admin_audit_logs`
- `blocked_targets`
- `security_events`
- `scheduled_job_runs`
- `runtime_configuration`
- `internal_user_notes`
- `product_events`

## Optional UI Preferences

- `user_preferences`
- `saved_filters`
- `table_preferences`

UI preference fields may include:

- Sidebar collapsed state
- Preferred table density
- Saved domain filters
- Reduced animation preference
- Future theme preference

All major entities shall include:

- Creation timestamp
- Update timestamp where appropriate
- Stable unique identifier
- Ownership or actor relationship
- Soft-deletion field where appropriate

---

# 33. Security Requirements

Security is a launch-blocking requirement.

The system shall implement:

- SSRF protection
- DNS and redirect validation
- Body-size limits
- Timeout limits
- Request quotas
- Escaped target-controlled content
- Content Security Policy
- Strict Transport Security
- Secure cookies
- Server-side authorisation
- CSRF protection
- Paddle signature verification
- Webhook idempotency
- Hashed recovery codes
- Session revocation
- Administrative audit logs
- Dependency scanning
- Secret scanning
- Production/preview separation

No public user shall be able to access:

- Another user’s domains
- Another user’s scans
- Another user’s reports
- Another user’s billing information
- Administrative routes
- Raw secrets
- Recovery codes
- Session tokens

The UI shall never expose secrets in:

- DOM source
- Browser logs
- Error messages
- Support views
- Super Admin tables
- Downloaded exports

---

# 34. Privacy and Data Retention

CrawlPact shall store only information required for:

- Accounts
- Billing
- Saved domains
- Audit evidence
- Monitoring
- Security
- Product operation
- First-party metrics

The product shall not store complete websites.

Bounded snapshots may be retained for:

- `robots.txt`
- `llms.txt`
- RSL
- Relevant headers
- Relevant HTML policy snippets
- Sitemap metadata

Recommended retention:

| Data | Retention |
|---|---|
| Anonymous scan cache | 24 hours to 7 days |
| Free account history | 30 days |
| Solo history | 12 months |
| Pro history | 24 months |
| Agency history | 36 months |
| Raw IP security logs | Minimum operational period |
| Administrative logs | At least 24 months |
| Billing reconciliation records | As legally and operationally required |
| Deleted account private data | Purge within 30 days where permitted |

---

# 35. Testing Requirements

## 35.1 Unit Tests

Testing shall cover:

- Domain normalisation
- IDN handling
- Unsafe-address detection
- Redirect validation
- Robots parsing
- Wildcard matching
- Group selection
- Crawler evaluation
- Conflict detection
- Findings
- Scoring
- Diffs
- Entitlements
- Paddle event handling
- Recovery codes
- Admin authorisation
- Design-token output
- Component state logic
- Form validation
- Accessible labels

## 35.2 Integration Tests

Testing shall cover:

- Cloudflare Workers and D1
- Authentication
- Domain ownership
- Monitoring jobs
- Registry publication
- Super Admin actions
- Paddle webhooks
- Paddle portal
- Report sharing
- Atom feeds
- Responsive application shell
- UI state persistence
- Print report rendering

## 35.3 End-to-End Tests

Playwright or equivalent tests shall cover:

- Landing-page audit
- Anonymous report
- Mobile audit
- Passkey registration
- Sign-in
- Save domain
- Manual scan
- Scheduled scan
- Change notification
- Paddle purchase
- Billing portal
- Agency report
- Super Admin user search
- Super Admin subscription review
- Webhook retry
- Account deletion
- Keyboard-only navigation
- Modal focus management
- Mobile navigation
- Report printing
- Table filtering
- Empty and error states

## 35.4 Security Tests

Testing shall include:

- Private IPv4
- Private IPv6
- Redirect-based SSRF
- Encoded IP addresses
- Redirect loops
- Oversized responses
- Slow responses
- HTML injection
- Malicious CSV
- CSRF
- Session fixation
- Webhook replay
- Invalid signatures
- Cross-account access
- Super Admin route access
- Recovery-code brute force
- Unsafe target-controlled text rendered in UI
- Downloaded CSV formula injection
- Shared-report token guessing

## 35.5 Accessibility Tests

Testing shall include:

- Automated accessibility audit
- Keyboard-only navigation
- Screen-reader smoke testing
- Focus visibility
- Modal focus trapping
- Form error announcement
- Status communication without colour
- 200% browser zoom
- Reduced-motion mode
- Mobile screen-reader navigation
- Table accessibility
- Print readability

## 35.6 Visual Regression Tests

Visual snapshots shall cover:

- Home page
- Audit progress
- Audit report
- Domain dashboard
- Domain detail
- Crawler matrix
- Finding card
- Evidence panel
- Diff view
- Notifications
- Billing page
- Security page
- Agency portfolio
- Super Admin dashboard
- Users table
- Subscriptions table
- Scan operations
- Registry editor
- Maintenance mode

Snapshots shall cover desktop and mobile variants.

---

# 36. Production Acceptance Criteria

The product shall not launch until:

1. The landing page is complete and responsive.
2. The professional UI/UX design system is implemented.
3. The public site, customer app and Super Admin interface are visually consistent.
4. The hero audit works without registration.
5. Search, training and user-triggered crawlers are separated.
6. Every crawler result displays evidence.
7. `robots.txt` matching tests pass.
8. SSRF attempts are blocked.
9. Redirect-based safety tests pass.
10. HTML returned as `robots.txt` is safely handled.
11. Additional signal parsers function correctly.
12. Recommendations are deterministic.
13. The score is reproducible.
14. Passkey registration and login work.
15. Recovery codes work.
16. Domain ownership is enforced.
17. Scheduled monitoring works.
18. Website drift and registry drift are separated.
19. In-app notifications work.
20. Atom feeds work.
21. Paddle sandbox lifecycle tests pass.
22. Webhook signatures are verified.
23. Duplicate webhooks are safe.
24. Out-of-order webhooks are safe.
25. Plan limits work.
26. Reports print correctly.
27. Private reports are `noindex`.
28. The Super Admin dashboard displays global users, subscriptions, domains and scan status.
29. The Super Admin can review Paddle webhooks.
30. The Super Admin can review failed scans.
31. Administrative actions are audited.
32. Runtime configuration uses validated limits.
33. The primary UI is keyboard accessible.
34. WCAG AA contrast requirements pass.
35. Loading, empty, error and permission states are implemented.
36. Core pages work at 360px mobile width.
37. Tables remain usable on mobile.
38. Long domains and URLs do not break layouts.
39. Core public pages pass technical SEO checks.
40. Canonical redirects work.
41. Sitemap and robots configuration are correct.
42. Privacy, terms, acceptable-use, scanner, limitations and security pages are published.
43. No critical or high security defects remain.
44. Visual regression testing passes.
45. A professional UI/UX review is completed.
46. A production-readiness audit has been completed.

---

# 37. Development Phases

## Phase 0: Foundation

- Repository
- Architecture
- CI
- D1 migrations
- Security baseline
- Design tokens
- Design system
- Component library
- Testing framework
- Preview and production environments

## Phase 1: Landing Page and Public Audit

- Professional home page
- Responsive navigation
- Hero audit input
- Trust sections
- Product preview
- Pricing preview
- FAQ
- Target validation
- Safe fetcher
- `robots.txt` parser
- Initial registry
- Result page
- Basic findings

## Phase 2: Policy Engine

- Presets
- Additional signals
- Conflict detection
- Recommendations
- Policy Health Score
- Report rendering
- Crawler matrix
- Evidence panels
- Diff viewer

## Phase 3: Accounts

- Passkeys
- Recovery codes
- Sessions
- Saved domains
- History
- Account deletion
- Customer application shell
- Security settings UX

## Phase 4: Monitoring

- Cron scheduler
- Scan locking
- Semantic diffs
- Notifications
- Atom feeds
- History timeline
- Monitoring dashboard

## Phase 5: Paddle

- Plans
- Checkout
- Webhooks
- Entitlements
- Portal
- Cancellation
- Grace periods
- Billing UI

## Phase 6: Super Admin

- Global dashboard
- User management
- Subscription management
- Payment monitoring
- Domain and scan operations
- Registry management
- Security monitoring
- Runtime configuration
- Audit logs
- Professional operational UI

## Phase 7: Agency

- Groups
- Batch import
- Portfolio dashboard
- CSV
- Client reports
- Branding

## Phase 8: SEO Launch

- Crawler directory
- Free tools
- Guides
- Methodology
- Scoring page
- Changelog
- Technical SEO
- Legal and trust pages

## Phase 9: UI/UX Hardening

- Responsive review
- Accessibility review
- Visual regression
- Print review
- Cross-browser review
- Copy consistency
- Error-state review
- Component documentation
- Professional design audit

---

# 38. Future Scope

Only after paid-market validation, consider:

- Custom policy matrices
- GitHub pull-request generation
- CMS plugins
- Server-log import
- Crawler-IP verification
- Cloudflare-log integration
- Team member accounts
- Advanced administrator roles
- Customer API
- AI-generated plain-language summaries
- AI-search citation tracking
- Active crawler enforcement
- Dark theme
- Advanced dashboard customisation
- Saved dashboard layouts
- Internationalisation
- Additional report templates

Deterministic evidence shall remain the source of truth even if AI explanations are added later.

---

# 39. Branding Requirements

The brand shall always be written:

> **CrawlPact**

Avoid:

- CrawlPACT
- Crawl Pact
- CrawlPact Protocol

Official descriptor:

> **AI Crawler Policy Auditor & Monitor**

CrawlPact shall communicate:

- Trust
- Clarity
- Evidence
- Neutrality
- Technical credibility
- Simplicity
- Professional international quality

Because “PACT” may also refer to unrelated emerging technical concepts, CrawlPact shall not present “Pact” as an acronym or protocol.

A legal trademark review should be completed before major brand investment.

---

# 40. Final Development Directive

CrawlPact shall be developed as a focused, deterministic, vendor-neutral and professionally designed AI crawler policy-governance platform.

The development team shall prioritise:

1. A strong, conversion-focused home page
2. A professional, consistent visual design system
3. Clear and trustworthy UX
4. Safe public-domain scanning
5. Correct crawler-policy evaluation
6. Search-versus-training separation
7. Evidence-based findings
8. Clear policy presets
9. Accurate recommendations
10. Historical monitoring
11. Agency portfolio management
12. Self-service authentication
13. Paddle-managed billing
14. Complete Super Admin visibility
15. SEO-led acquisition
16. Accessibility
17. Responsive performance
18. Near-zero manual support

The interface shall feel like a credible international B2B SaaS product rather than a generic SEO utility.

The design shall remain:

- Professional
- Minimal
- Evidence led
- Accessible
- Calm
- Technically accurate
- Consistent
- Responsive

The MVP shall not expand into general SEO auditing, active crawler blocking, custom consulting, server-log analytics or enterprise integrations.

The final product promise shall remain:

> **CrawlPact helps website owners understand, manage and monitor their publicly declared AI crawler policy.**

This document is the complete final approved SRS baseline for CrawlPact development.
