# Legal Information Checklist — Deferred, Scoped Items Only

**Status: open, explicitly deferred by the product owner (2026-07-31).** This does not block
shipping the current release. It blocks only the specific jurisdiction-dependent items listed
under "What stays blocked" below — everything else in the product ships normally with this gap
still open. None of the fields below exist anywhere in the repository (confirmed by search across
`package.json`, `wrangler.jsonc`, `privacy.astro`, `terms.astro`, `acceptable-use.astro`,
`SiteFooter.astro` — see `docs/reports/CRAWLPACT_PRODUCTION_CONTENT_TRUST_SEO_AUDIT.md` §5 item 2).
This checklist exists so the gap is tracked as a specific, fillable list rather than a vague
"legal stuff is missing" note. **Nothing in this file is a guess or a placeholder value to
publish** — every row is genuinely blank until the product owner supplies the real answer.

Do not fill any row below with an invented value to "complete" this document. An empty row here is
the correct, honest state until the real answer is supplied.

## Required information

| Field                                                                                                                                                   | Value            | Blocks                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Legal entity name (e.g. "CrawlPact, Inc.", "CrawlPact Ltd.")                                                                                            | _(not provided)_ | Terms of service party identification, privacy policy data-controller identity, footer copyright line, `/.well-known/security.txt`               |
| Registered business address                                                                                                                             | _(not provided)_ | Terms of service, privacy policy (where a controller address is customarily disclosed)                                                           |
| Governing jurisdiction (country/state whose law governs the terms)                                                                                      | _(not provided)_ | Terms of service governing-law and dispute-resolution clauses                                                                                    |
| Applicable consumer-protection regime (follows from jurisdiction — e.g. does UK/EU consumer law or a specific US state's apply to any customer segment) | _(not provided)_ | Terms of service refund/cancellation language, privacy policy legal-basis language                                                               |
| Verified privacy/data-request contact (email or form)                                                                                                   | _(not provided)_ | Privacy policy contact section, data-subject request handling                                                                                    |
| Verified security-disclosure contact                                                                                                                    | _(not provided)_ | `/security` page, `/.well-known/security.txt` (currently does not exist — see `docs/reports/CRAWLPACT_PRODUCTION_CONTENT_TRUST_SEO_AUDIT.md` §3) |
| Verified general support/correction contact                                                                                                             | _(not provided)_ | Public correction-submission channel referenced in `docs/seo/EDITORIAL_SOURCE_AND_CONTENT_POLICY.md`                                             |

## What is already safe to do without this information

Per the product owner's explicit instruction (2026-07-31), work that doesn't require a
jurisdiction or legal identity continues normally: removing internal engineering leaks from public
copy, fixing structural/SEO issues, adding effective/last-updated dates (a fact about when content
was last changed, not a legal claim), rewriting content for clarity and accuracy, and anything
else that doesn't assert who the legal operator is or what law governs a dispute.

## What stays blocked until this is filled in

- Terms of service: any specific governing-law or dispute-resolution clause. A generic terms page
  describing the service itself (what it does, plan mechanics, acceptable use) can still be
  accurate without this — only the jurisdiction-specific clauses are blocked.
- Privacy policy: naming a specific data controller entity and address. The technical data-flow
  description (what's collected, third parties, retention) is already accurate and unblocked —
  see `apps/web/src/pages/privacy.astro`, which correctly describes actual practice today.
- `/.well-known/security.txt`: the standard requires a real contact — publishing a fake one is
  explicitly prohibited by `CLAUDE.md` and the original audit brief. Not implemented until a real
  contact exists.
- A public content-correction submission channel (`docs/seo/EDITORIAL_SOURCE_AND_CONTENT_POLICY.md`'s
  "How corrections are submitted and processed" section) — same reason.

## How to close this out

1. Product owner supplies the values above (directly, or by pointing to where they're already
   registered — e.g. a Paddle merchant-of-record configuration, a business registration document).
2. Update this table with the real values and change the file's status line to "resolved
   (date)" — don't delete the historical record of what was missing and when it was filled in.
3. Implement the specific blocked items listed above, each as its own reviewable change.
4. Cross-reference: `docs/status/KNOWN_RISKS.md` and
   `docs/reports/CRAWLPACT_PRODUCTION_CONTENT_TRUST_SEO_AUDIT.md` both point here rather than
   duplicating this list — keep it in one place.
