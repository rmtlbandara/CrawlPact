# GitHub Brand Metadata Manifest — 2026-08-03

**Status: verification-blocked (by manifest-only decision, not access failure).**

Live-checked via `gh repo view rmtlbandara/CrawlPact --json description,repositoryTopics`:

```json
{ "description": "", "repositoryTopics": null }
```

The repository currently has **no description and no topics set**. `gh` write access to repo
metadata (`gh repo edit`) was available this session but, following the same manifest-only
precedent established in Phase 0 for GitHub governance writes (see
`docs/governance/GITHUB_GOVERNANCE_SETUP_MANIFEST.md`), no live change was made without an
in-the-moment authorisation. This manifest records the exact recommended values so they can be
applied later, either by running the command below or by a future session once authorised.

## Recommended repository description

```
Independent AI crawler policy auditing and monitoring across websites, hosting providers, and CDNs.
```

(Matches `apps/web/src/config/brand.ts`'s `githubDescription` — kept under GitHub's ~350-character
limit.)

## Recommended topics

```
ai-crawlers, robots-txt, crawler-policy, astro, cloudflare-workers, web-audit
```

## Command to apply (when authorised)

```bash
gh repo edit rmtlbandara/CrawlPact \
  --description "Independent AI crawler policy auditing and monitoring across websites, hosting providers, and CDNs." \
  --add-topic ai-crawlers \
  --add-topic robots-txt \
  --add-topic crawler-policy \
  --add-topic astro \
  --add-topic cloudflare-workers \
  --add-topic web-audit
```
