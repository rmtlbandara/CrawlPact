## Purpose

<!-- What does this change, and why? -->

## SRS requirement

<!-- Which docs/product/CRAWLPACT_FINAL_SRS.md section(s) does this satisfy, or N/A -->

## Impact checklist

- [ ] Architecture (record an ADR under `docs/architecture/adr/` if this is material)
- [ ] Security (auth, CSRF, headers, secrets)
- [ ] Scanner / SSRF chokepoint (`packages/scanner`)
- [ ] Authentication (passkeys, sessions)
- [ ] D1 migration (forward-only, hand-authored SQL; reviewed before merge)
- [ ] Paddle billing (webhooks, checkout, prices)
- [ ] Cloudflare (DNS, TLS, WAF, cache, Worker bindings)
- [ ] Environment variables (`.env.example`, `packages/config/src/env.ts`, `apps/web/wrangler.jsonc`, CI)

## Tests run

<!-- pnpm quality output, or which specific suites -->

## Preview URL

<!-- Filled in automatically once the preview deploy workflow runs -->

## Documentation updated

<!-- Which docs/ files, or "none needed" -->

## Rollback / forward-fix plan

<!-- How to undo this if it breaks something in preview or production -->
