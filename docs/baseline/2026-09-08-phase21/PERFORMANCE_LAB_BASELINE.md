# Phase 21 Performance Lab Baseline

**No fresh local Lighthouse run was executed this phase.** The authoritative, continuously-running
source for this product's performance budget is `.github/workflows/deploy-preview.yml`'s
"Lighthouse budget check against the deployed preview" step (`scripts/lighthouse-check.mjs`),
which runs against a real deployed Preview Worker on every deploy and gates the deploy on it — a
point-in-time number captured locally against `astro dev` (a different runtime, no Cloudflare edge
characteristics, no production build optimisations) would not be representative and risks being
mistaken for a real performance signal.

## What this phase's changes could plausibly affect

None of the four fixes in `UX_FINDING_REGISTER.md` touch anything on the Lighthouse-tracked pages'
critical rendering path (home, pricing, audit, crawlers, guides, platforms, tools — see `PAGES` in
`scripts/lighthouse-check.mjs`) — all four are Super Admin/customer-app-only changes (behind auth,
not part of the public Lighthouse budget check) or a small dependency-free utility function. No
performance regression is plausible from this changeset, and the existing CI gate will still catch
it if this assessment is wrong.
