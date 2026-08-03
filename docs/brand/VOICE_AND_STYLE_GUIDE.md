# Voice and Style Guide

**Level 1 document (Current authoritative).** Defines how CrawlPact writes, established Phase 2,
2026-08-03. Applies to all current messaging surfaces — see
`docs/brand/MESSAGING_SURFACE_INVENTORY.md`.

## Required voice traits

- **Calm** — explain risk without panic. Preferred: "Two policy signals conflict." Avoid: "Your
  website is dangerously exposed."
- **Precise** — use exact crawler-purpose and evidence terminology (see
  `docs/brand/PRODUCT_TERMINOLOGY_GLOSSARY.md`).
- **Independent** — avoid sounding like an infrastructure vendor, a crawler operator, or an
  anti-AI campaign.
- **Evidence-led** — state what was observed and how it was classified, not a conclusion without
  its basis.
- **Honest** — distinguish known, inferred, unspecified, and unavailable states explicitly; never
  collapse them into one confident-sounding claim.
- **Helpful** — explain the consequence and the recommended next step, not just the fact.
- **Professional** — accessible technical language suitable for agencies, developers, publishers,
  and business stakeholders alike.

## Writing rules

- Use sentence case for headings and UI labels.
- Prefer active voice.
- Keep headings outcome-oriented.
- Explain abbreviations on first use (e.g. "RSL (Really Simple Licensing)").
- Do not anthropomorphise crawlers unnecessarily ("GPTBot wants to..." → "GPTBot is classified
  as...").
- Avoid exaggerated cybersecurity language ("dangerously exposed," "under attack," "vulnerable").
- Avoid empty superlatives: "revolutionary," "game-changing," "ultimate," and similar.
- Avoid legal certainty ("compliant," "protected," "guaranteed") — see the claims guide.
- Avoid unexplained registry terminology — always link or define on first use.
- Avoid treating every unspecified policy as automatically bad — "unspecified" is a neutral,
  factual state, not an implicit failing grade.
- Avoid portraying one policy objective as universally correct — a publisher intentionally
  allowing search while blocking training is not "wrong"; a different site intentionally allowing
  both is not "wrong" either. CrawlPact reports what is declared, not a universal verdict on
  intent.
- Use "website" consistently rather than alternating unnecessarily with "site," except where
  space requires the shorter word.
- Use "AI crawler" rather than "AI bot" in formal product copy; "AI bot" is acceptable in
  search-oriented educational contexts (e.g. an SEO guide's title) where it aids discoverability.
- Use punctuation consistently with the repository's existing style (en dashes for parenthetical
  asides, matching current homepage/docs usage).
- Use accessible link labels — never "click here" or a bare URL as the only link text.
- Do not place essential meaning only in tooltips — a screen-reader user or a user who never
  hovers must still get the same information from visible text.

## Evidence wording

**Prefer**: "CrawlPact detected…" · "The website currently declares…" · "The public response
indicates…" · "The crawler is classified in registry version…" · "This rule is unspecified…" ·
"These signals appear inconsistent…" · "The policy changed between scans…" · "This finding
changed because the registry changed…"

**Avoid**: "The crawler definitely accessed…" · "The crawler cannot access…" · "Your content is
fully protected…" · "Your website is AI compliant…"

## Worked example

- Avoid: "GPTBot is blocked and your content is fully protected from AI training."
- Prefer: "robots.txt currently disallows GPTBot. This declares an intent to exclude this
  crawler from training use; CrawlPact cannot confirm GPTBot's actual behaviour beyond this
  declaration."
