# Product Terminology Glossary

**Level 1 document (Current authoritative).** Canonical definitions for CrawlPact product
terminology, established Phase 2, 2026-08-03. UI copy, documentation, and reports should use
these terms consistently — see `docs/brand/VOICE_AND_STYLE_GUIDE.md` for how to introduce them.

## Crawler purpose taxonomy

- **AI crawler** — an automated client operated by or on behalf of an AI company that requests
  web resources for a purpose related to search, training, retrieval, or agentic action.
- **Search crawler** — an AI crawler whose declared purpose is indexing content for a search or
  answer product (e.g. OAI-SearchBot).
- **Training crawler** — an AI crawler whose declared purpose is collecting content for model
  training (e.g. GPTBot).
- **User-triggered retrieval crawler** — a crawler that fetches a specific page in direct response
  to a user's real-time request (e.g. ChatGPT-User).
- **Agent crawler** — a crawler acting on behalf of an autonomous or semi-autonomous AI agent
  performing a task, distinct from a one-shot retrieval.
- **Multipurpose crawler** — a crawler operator has not separated by declared purpose into
  distinct tokens; classified `mixed`.
- **Crawler operator** — the organisation that operates a given crawler (e.g. OpenAI, Anthropic,
  Google).
- **Crawler token** — the exact user-agent string (or family of strings) a crawler identifies
  itself with (e.g. `GPTBot`).

## Policy and evidence

- **Public policy signal** — any publicly accessible mechanism a website uses to declare crawler
  policy: robots.txt, meta directives, HTTP header directives, Content Signals, RSL, llms.txt.
- **Declared policy** — what a website's public policy signals state, as currently published.
- **Observed public response** — what CrawlPact's own request to a public resource actually
  returned, at the time of a scan.
- **robots.txt** — the standard, path-based crawler-access declaration file.
- **Meta directive** — an in-HTML directive (e.g. `<meta name="robots">`) governing crawler
  behaviour for that page.
- **HTTP header directive** — a response header (e.g. `X-Robots-Tag`) governing crawler
  behaviour for that resource.
- **Content Signals** — an emerging HTTP-header-based mechanism for declaring content-usage
  intent (e.g. AI training permission) independent of robots.txt.
- **RSL (Really Simple Licensing)** — an emerging, optional machine-readable licensing
  declaration format.
- **llms.txt** — an emerging, optional file proposing a curated summary of a site for AI
  consumption. Not a universally adopted or required standard — see
  `docs/brand/CLAIMS_AND_MESSAGING_GUIDE.md`.
- **Explicit allow** — a policy signal that names a crawler and permits it.
- **Explicit disallow** — a policy signal that names a crawler and excludes it.
- **Unspecified** — no explicit rule addresses a given crawler; a neutral, factual state, not
  automatically equivalent to "allowed" unless the specific standard's own default rule justifies
  that reading.
- **Conflict** — two or more current public policy signals disagree about the same crawler or
  purpose.
- **Finding** — a single, discrete observation CrawlPact's evaluation produced from a scan.
- **Evidence** — the underlying observed data (declared signal text, HTTP response, timestamp)
  a finding is based on.
- **Recommendation** — a suggested policy change generated from a finding and the account's
  selected policy objective.
- **Objective** — the policy stance a user selects (e.g. "allow search, block training") that
  recommendations are generated against.
- **Policy preset** — a named, pre-configured objective a user can select instead of building one
  manually.
- **Baseline** — the first saved scan of a domain, used as the reference point for future
  monitoring comparisons.

## Scanning and monitoring

- **Scan** — one complete evaluation run against a domain, producing a report.
- **Monitoring** — the ongoing, scheduled re-scanning of a saved domain and comparison against its
  baseline/prior scan.
- **Website-policy change** — a detected difference caused by the website's own public response
  changing between two scans.
- **Registry-driven change** — a detected difference caused by an update to CrawlPact's crawler
  registry (a new crawler, a reclassification, a new release) rather than any change on the
  website itself.
- **Registry version** — the specific, versioned, immutable snapshot of the crawler registry a
  given scan was evaluated against.
- **Verification date** — the date a crawler registry entry's classification was last confirmed
  against its operator's own official documentation.
- **Partial result** — a scan that completed with some, but not all, resources successfully
  evaluated.
- **Resource unavailable** — a specific resource (e.g. robots.txt) could not be fetched during a
  scan; distinct from an explicit block, since a failed request is not automatically a policy
  decision.
- **Score** — a deterministic numeric summary of a scan's findings against the account's selected
  objective; not a universal legal or business judgement, and not a measure of actual crawler
  obedience.
- **Risk** — (in the product's own risk-register sense, not this glossary's product-terminology
  sense) — see `docs/risks/ACTIVE_RISKS.md` for that distinct usage.
- **Incident** — a real, publicly disclosed service disruption tracked on `/status`.

## Required distinctions

- **Declared policy versus actual behaviour** — CrawlPact evaluates declarations and public
  responses; it does not prove crawler behaviour.
- **Unspecified versus allowed** — an absent explicit rule must not automatically be described as
  explicit permission unless the relevant standard and evaluation logic justify that
  interpretation.
- **Website-policy change versus registry-driven change** — a website-policy change comes from a
  different public response; a registry-driven change comes from updated crawler knowledge or
  classification.
- **Resource unavailable versus explicit block** — a failed request is not automatically a policy
  decision.
- **Score versus policy objective** — the score reflects deterministic evaluation criteria against
  one selected objective; it is not a universal legal or business judgement.
