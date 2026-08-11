# Research crawling policy

**Status: not yet implemented.** No automated research-corpus crawling exists in this codebase as
of Phase 16 — see `PHASE_16_RESEARCH_CORPUS_DECISION.md` for why Layer B (Website Policy
Observatory) was not built this phase. This document defines the policy that would govern such
crawling _if and when_ Layer B is approved and built, so the decision doesn't need to be re-derived
under time pressure later, and so nothing ships without an ethics review already on record.

## Purpose

Collecting bounded, structured policy-signal observations (robots.txt presence, explicit AI
crawler directives, purpose-level allow/deny state) from a defined, versioned research corpus of
publicly accessible websites — never arbitrary or unbounded web crawling.

## Scope

- Only origins explicitly included in a frozen, versioned research corpus (see
  `PHASE_16_RESEARCH_DATA_MODEL.md`'s `research_corpora`/`research_corpus_entries` sketch).
- Only the resources CrawlPact's existing scanner already supports: `/robots.txt`, other policy
  files CrawlPact currently parses, and the homepage only when required to inspect currently
  supported HTTP/meta signals.
- Never: article libraries, user pages, login areas, recursive sitemap crawling, private or
  authenticated content.

## Rate limits

Low per-origin concurrency, a total corpus request cap, and a total corpus runtime cap, all to be
defined against a real corpus size before first use (see the capacity gate in
`PHASE_16_RESEARCH_STORAGE_CAPACITY_MODEL.md`). No daily whole-corpus automation by default —
manually initiated or low-frequency (monthly/quarterly) explicitly approved runs only.

## User-agent

`CrawlPactResearch/1.0`, with a public contact/information URL, once a `/research/crawler`
transparency page exists. Must never masquerade as Googlebot, a browser, or another crawler.

## Retry / 429 behaviour

Treat `429`/`Retry-After` seriously; back off; never retry indefinitely against an unresponsive or
rate-limiting origin.

## Robots handling

Identify CrawlPact honestly; respect explicit applicable restrictions; never bypass authentication
or access controls.

## Exclusion process

A site operator may request exclusion from future corpus scanning via CrawlPact's existing contact
channel (`/contact`) — no new support platform. An exclusion request updates the corpus's exclusion
list at the next version freeze; it does not retroactively delete already-published aggregate
findings (see `RESEARCH_DATA_RETENTION_POLICY.md`).

## Reuse, not a fork

Any future research collection must reuse the existing safe-fetch chokepoint (ADR-0005,
`packages/scanner`), parsing, registry, and policy-semantics code — never a second, drifting
scanner implementation (§32).
