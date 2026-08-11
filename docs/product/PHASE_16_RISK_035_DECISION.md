# Phase 16 RISK-035 decision

## Re-evaluation trigger

RISK-035 ("Public crawler directory is statically generated, not read live from the registry")
becomes relevant to Phase 16 because the Policy Observatory needs authoritative current registry
facts — the prompt's §105 explicitly requires re-evaluating it for that reason.

## What was actually decided

**Option C — leave the `/crawlers` directory architecture unchanged; close the Observatory-specific
factual-authority question separately, by construction.**

- Considered **Option A** (keep static crawler editorial pages but use the active D1 registry as a
  factual overlay/source) and **Option B** (build a generated artifact from the active registry).
  Neither was adopted for the _existing_ `/crawlers` pages — doing so would be exactly the "large
  crawler-directory rewrite" §107 says not to force "unless it meaningfully reduces RISK-035," and
  the actual Phase 16 need (authoritative Observatory metrics) doesn't require rewriting those
  pages at all.
- Instead, the Registry Observatory (`/observatory`, `/observatory/registry`) was built from day one
  to read exclusively from `registry_version_entries` via `getRegistryVersionSnapshotMap()` —
  **never** from the Markdown crawler content collection. This is architecturally Option A's core
  idea (a live D1 read path for factual registry data), applied to the _new_ Observatory surface
  rather than retrofitted onto the _existing_ static directory.

## Result

- **RISK-035 itself is not closed.** `/crawlers`/`/crawlers/:slug` remain statically generated and
  still carry the same drift risk they did at the end of Phase 15 — nothing about them changed this
  phase. The risk entry in `docs/risks/ACTIVE_RISKS.md` is retained as-is.
- **The Observatory is structurally immune to that same risk.** `/observatory/registry` cannot
  drift from the registry the way `/crawlers` can, because it has no separate content source to
  drift _from_ — it computes directly from the same immutable release data at request time. This is
  noted as a clarification on RISK-035's entry, not a new risk and not a closure of the existing
  one.

## Why not go further

Rewriting `/crawlers` to read live from D1 was out of scope for a phase whose stated goal is a
research/authority layer, not a directory-architecture change — and RISK-035's own trigger
condition ("registry releases become more frequent than roughly monthly, or a real customer-facing
incident traces back to public-page staleness") was not met this phase. Forcing the rewrite now
would be scope creep against the prompt's own §107 instruction.
