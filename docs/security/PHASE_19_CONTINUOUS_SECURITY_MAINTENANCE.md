# Phase 19 Continuous Security Maintenance

Status: current-authoritative, 2026-08-14. Turns Phase 12's one-time security hardening into an
ongoing maintenance policy, per §84.

## Retained for every release, unconditionally

- Secret scan (working tree, diff, build output)
- Dependency audit (`pnpm audit --audit-level=critical`)
- `test:security` suite (auth, CSRF, SSRF, IDOR)
- Repository privacy validator (`repo-privacy:validate`)

These are already wired into `pnpm quality` and CI — this policy does not add new tooling, it
commits to never removing or weakening them for convenience.

## GitHub Actions pinning

Full-length immutable commit SHA pinning is retained for every workflow action. `@main`/`@master`/
`@vN` tags are never substituted for convenience — confirmed unchanged as of this pass (no
workflow files were touched).

## Dependency review priority (§87)

1. Critical exploitable runtime vulnerability — immediate.
2. High exploitable runtime vulnerability — immediate.
3. Security-tooling updates — same week.
4. Supported-framework security fixes — same week.
5. Ordinary version updates — batched, reviewed for compatibility before merge, never auto-merged.

Current state: `pnpm audit --audit-level=critical` is clean (0 critical). 12 total advisories (4
moderate, 8 high) are all dev-tooling-only (build-time Astro/Vite chain), not production runtime —
tracked under RISK-026, unchanged.

## Dependabot handling

5 open Dependabot PRs as of this pass (astro 7.2.0, @astrojs/cloudflare 14.2.0, lucide-react
1.29.0, a dev-dependencies group, @astrojs/react 6.0.2) — all dev-tooling, none blindly merged.
Each requires: security relevance check, runtime impact check, compatibility check, and passing
CI before merge — no PR in this set has been merged as part of Phase 19 foundation work, since
none carries security relevance and grouping/merging them is ordinary maintenance, not foundation
work.

## Secret rotation policy

No secret is rotated on a fixed calendar. Rotation is triggered by: suspected exposure (as
happened with `PADDLE_WEBHOOK_SECRET`, rotated in the Phase 0-18 pass), a credential's own
provider-recommended rotation guidance, or a personnel/access change. Current secret inventory
(names only, never values): `ABUSE_MONITORING_SECRET`, `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`,
`SESSION_SIGNING_SECRET` — confirmed present on `crawlpact-web` via a live, read-only Cloudflare
API check this pass.

## Incident escalation

A real P0/P1 security finding overrides any in-progress conversion/optimisation work (§89, §162)
and pauses the optimisation programme until resolved (§142), consistent with the existing
`docs/operations/OPERATIONAL_ALERT_MODEL.md` incident-severity model — not a new escalation path.

## Review trigger

Re-review this policy when: a new class of dependency vulnerability is found, a security-relevant
Cloudflare/Paddle platform change occurs, or at the quarterly trigger-based governance review
(`docs/governance/PHASE_19_CONTINUOUS_REVIEW_CADENCE.md`).
