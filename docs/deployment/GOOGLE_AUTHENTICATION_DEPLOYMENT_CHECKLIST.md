# Google Authentication Deployment Checklist

Companion to [ADR-0009](../architecture/adr/ADR-0009-GOOGLE-FEDERATED-AUTHENTICATION.md) and
[GOOGLE_AUTHENTICATION_THREAT_REVIEW.md](../security/GOOGLE_AUTHENTICATION_THREAT_REVIEW.md).
Tracks what's actually been verified vs. what remains before Google sign-in can be trusted on a
real, deployed environment. Update the checkboxes below with real evidence as each step is
actually completed — do not check a box because the code exists, only because it was observed
working.

## Current status (updated 2026-09-07 — corrected transport deployed and confirmed working)

**Working, confirmed by the product owner with a real Google account.** The initial
implementation (`c7b3d62`/`b31270d`) was deployed to preview and production configured in GIS
redirect mode (`login_uri`), which made Google itself POST the credential cross-site to
`/api/auth/google` — Astro's own CSRF protection correctly rejected it (`Cross-site POST form
submissions are forbidden`), confirmed live on both environments. Corrected the same day to GIS
JavaScript-callback mode (`ux_mode: "popup"`; see ADR-0009's post-acceptance correction note and
`docs/security/GOOGLE_AUTHENTICATION_THREAT_REVIEW.md`), deployed to preview then production
(commit `72a8630`), each independently verified post-deploy (corrected request reaches real
logic; old cross-site request still correctly rejected). **The product owner then manually
signed in and signed up with a real Google account on both Preview and Production, confirmed
working, 2026-09-07.** Account linking, disconnect, and admin isolation remain covered only by
the automated test suites — see the still-unchecked items below for what a real-account
confirmation of those would still add.

## Cloudflare / environment prerequisites (should already be true — verify before proceeding)

- [x] `preview.crawlpact.com` Cloudflare Custom Domain is active (see
      `docs/deployment/CLOUDFLARE_ENVIRONMENT_MATRIX.md`'s Notes section) — confirmed: the
      corrected transport deployed to it via `deploy-preview.yml` and the product owner
      successfully signed in through it.
- [x] `GOOGLE_CLIENT_ID` present in both `apps/web/wrangler.jsonc` top-level `vars` (production)
      and `env.preview.vars` (preview) — confirmed working on both as of commit `72a8630`.
- [x] `pnpm env:validate:preview` and `pnpm env:validate:production` both pass — enforced by
      `pnpm run release:check` in `deploy-production.yml`, which succeeded for `72a8630`.

## Google Auth Platform (owner action — external, cannot be automated from this repo)

For **preview**:

- [x] Authorized JavaScript origin `https://preview.crawlpact.com` added — confirmed indirectly:
      Google would reject an unauthorized origin, and the product owner's real sign-in/sign-up
      on preview succeeded.
- [x] Authorized redirect URI `https://preview.crawlpact.com/api/auth/google` added — same
      evidence as above.

For **production** (confirm still present, do not remove):

- [x] `https://crawlpact.com` and `https://crawlpact.com/api/auth/google` remain — confirmed
      indirectly by the product owner's successful real sign-in/sign-up on production.
- [ ] `http://localhost:4321` and its redirect URI remain (local development) — not exercised
      with a real Google account after the transport fix; not reverified this pass.

Both:

- [ ] Publishing status remains **Testing** until an explicit, separate owner decision to
      publish — this checklist does not authorize publishing. Not reverified this pass (external
      Google Auth Platform state, no observed evidence either way).
- [ ] No `*.workers.dev` origin, no wildcard origin, ever added — not reverified this pass.
- [ ] No Client Secret exists on the OAuth client (the GIS ID-token flow this integration uses
      does not need one) — not reverified this pass.

## Local validation (this pass — mark only what was actually run and observed)

- [x] `pnpm run db:migrate` applied migration `0038_google_oauth.sql` to a clean local DB.
- [x] `pnpm run db:validate` passed (migrations ↔ Drizzle schema consistency).
- [x] `pnpm run test:unit` passed, including `google.test.ts`'s JWT-verification edge cases.
- [x] `pnpm run test:integration` passed, including the Google callback CSRF/state/nonce/
      linking/admin-isolation suite (38 tests, rewritten for the corrected JSON-callback
      transport).
- [x] `pnpm run typecheck` passed.
- [x] `pnpm run lint` / `pnpm run format:check` passed.
- [x] `pnpm run docs:validate` / `trust:validate` / `status:validate` / `operations:validate` /
      `brand:validate` passed.
- [x] `pnpm audit --audit-level=critical` passed (covers the new `jose` dependency).
- [x] `git diff --check` passed; no secret, no Client Secret, no Google ID token committed
      (gitleaks required a fix for a false positive on a test fixture property name — see
      `CHANGELOG.md` / commit history, not a real secret).

## Preview deployment sequence (do not execute until the two sections above are both genuinely done)

1. [x] Confirm `preview.crawlpact.com` is live and isolated (separate D1/KV/R2 from production) — confirmed, deploy-preview.yml succeeded and the smoke test passed.
2. [x] Confirm the Google preview origin + redirect URI are configured (above) — confirmed indirectly by the successful real sign-in.
3. [x] Ensure the preview D1 migration path is ready (`wrangler d1 migrations apply crawlpact-db-preview --remote`, via the normal `deploy-preview.yml` workflow — never applied ad hoc from a local machine) — confirmed, ran as part of the workflow.
4. [x] Deploy preview through the normal trusted workflow (`deploy-preview.yml`, triggered by CI success on `main` — never a manual `wrangler deploy` from a local working tree) — confirmed, watched to success.
5. [x] Apply/verify the preview migration according to the existing deployment procedure — confirmed as part of the workflow run.
6. [x] Run the preview smoke test (`pnpm run smoke:preview`) — confirmed passing (one transient DNS-propagation failure, re-ran and passed).
7. [x] Manually sign up with a designated Google test user (Google Auth Platform's Testing mode requires the account to be an explicitly added test user) — confirmed by the product owner's direct report ("Google sign in / sign up works in Preview"), not independently observed by a query/screenshot.
8. [ ] Verify the new `users` row + `oauth_accounts` association + session were actually created (a direct, read-only D1 query — the established pattern this repo already uses for post-deploy verification elsewhere) — NOT done; the product owner's report confirms the outcome (sign-up worked) but no one ran the underlying D1 query.
9. [x] Test sign-out → Google sign-in (existing account) — confirmed by the product owner's direct report ("Google sign in ... works in Preview"), same caveat as item 7.
10. [ ] Test an existing passkey account → "Connect Google" → both methods reach the same `users.id` — not tested with a real account.
11. [ ] Test the anonymous-audit continuation flow through Google sign-up — not tested with a real account.
12. [ ] Test the pricing/checkout continuity flow through Google sign-up — not tested with a real account.
13. [ ] Test the Google disconnect lockout safeguard (refused with no passkey; allowed with one) — not tested with a real account.
14. [ ] Confirm production is unaffected (no shared D1/KV/R2, no changed production vars) — not independently re-verified this pass beyond passkey/status endpoints checked during the deploy cycle itself.

Do not check any of these off, and do not claim them in a status report, without the specific
observed evidence behind each one (a query result, a screenshot, a log line) — matching this
repository's existing "verified-live" vs. "code-present-not-production-verified" discipline (see
`docs/status/CURRENT_STATE.md`).

## Production release gate

Do not enable/announce Google sign-in in production merely because preview worked once. Require,
with evidence:

- [ ] Every local-validation checkbox above, plus every preview-deployment-sequence step, genuinely
      completed.
- [ ] Production Google origin/redirect confirmed present (not just "should still be there").
- [ ] An explicit, separate owner decision on whether to publish the Google OAuth app (this
      checklist does not make that decision).
- [ ] A final `git diff --check` / secret-scan clean on the exact commit being deployed.
