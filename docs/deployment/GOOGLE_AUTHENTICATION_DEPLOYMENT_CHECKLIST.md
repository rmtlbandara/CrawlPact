# Google Authentication Deployment Checklist

Companion to [ADR-0009](../architecture/adr/ADR-0009-GOOGLE-FEDERATED-AUTHENTICATION.md) and
[GOOGLE_AUTHENTICATION_THREAT_REVIEW.md](../security/GOOGLE_AUTHENTICATION_THREAT_REVIEW.md).
Tracks what's actually been verified vs. what remains before Google sign-in can be trusted on a
real, deployed environment. Update the checkboxes below with real evidence as each step is
actually completed — do not check a box because the code exists, only because it was observed
working.

## Current status (updated 2026-09-07 — transport defect found and corrected)

**Deployed, but currently defective; correction built and locally verified, not yet redeployed.**
The initial implementation (`c7b3d62`/`b31270d`) was deployed to preview and production and
configured Google Identity Services in redirect mode (`login_uri`). This makes Google itself POST
the credential cross-site to `/api/auth/google`, which Astro's own CSRF protection correctly
rejects (`Cross-site POST form submissions are forbidden`) — **confirmed live on both preview and
production**. The corrected architecture (GIS JavaScript-callback mode, `ux_mode: "popup"`; see
ADR-0009's post-acceptance correction note and
`docs/security/GOOGLE_AUTHENTICATION_THREAT_REVIEW.md`) is built and passes local unit/integration
tests, typecheck, lint, and format against a real (Miniflare) D1 database and real cryptographic
JWT verification using locally generated test keys — **but has not yet been committed, pushed, or
redeployed.** Until that redeploy happens, Google sign-in remains non-functional on both
production and preview (the button renders, but every attempt fails with the cross-site-POST
error) — passkey/recovery-code sign-in is completely unaffected and continues working normally.

## Cloudflare / environment prerequisites (should already be true — verify before proceeding)

- [ ] `preview.crawlpact.com` Cloudflare Custom Domain is active (see
      `docs/deployment/CLOUDFLARE_ENVIRONMENT_MATRIX.md`'s Notes section — this was a prior,
      separate migration pass; Google preview testing depends on it being genuinely live, not
      just configured).
- [ ] `GOOGLE_CLIENT_ID` present in both `apps/web/wrangler.jsonc` top-level `vars` (production)
      and `env.preview.vars` (preview) — already true as of this pass; re-confirm nothing
      regressed it.
- [ ] `pnpm env:validate:preview` and `pnpm env:validate:production` both pass.

## Google Auth Platform (owner action — external, cannot be automated from this repo)

For **preview**:

- [ ] Authorized JavaScript origin `https://preview.crawlpact.com` added.
- [ ] Authorized redirect URI `https://preview.crawlpact.com/api/auth/google` added.

For **production** (confirm still present, do not remove):

- [ ] `https://crawlpact.com` and `https://crawlpact.com/api/auth/google` remain.
- [ ] `http://localhost:4321` and its redirect URI remain (local development).

Both:

- [ ] Publishing status remains **Testing** until an explicit, separate owner decision to
      publish — this checklist does not authorize publishing.
- [ ] No `*.workers.dev` origin, no wildcard origin, ever added.
- [ ] No Client Secret exists on the OAuth client (the GIS ID-token flow this integration uses
      does not need one).

## Local validation (this pass — mark only what was actually run and observed)

- [ ] `pnpm run db:migrate` applied migration `0038_google_oauth.sql` to a clean local DB.
- [ ] `pnpm run db:validate` passed (migrations ↔ Drizzle schema consistency).
- [ ] `pnpm run test:unit` passed, including `google.test.ts`'s JWT-verification edge cases.
- [ ] `pnpm run test:integration` passed, including the Google callback CSRF/state/nonce/
      linking/admin-isolation suite.
- [ ] `pnpm run typecheck` passed.
- [ ] `pnpm run lint` / `pnpm run format:check` passed.
- [ ] `pnpm run docs:validate` / `trust:validate` / `status:validate` / `operations:validate` /
      `brand:validate` passed.
- [ ] `pnpm audit --audit-level=critical` passed (covers the new `jose` dependency).
- [ ] `git diff --check` passed; no secret, no Client Secret, no Google ID token committed.

## Preview deployment sequence (do not execute until the two sections above are both genuinely done)

1. Confirm `preview.crawlpact.com` is live and isolated (separate D1/KV/R2 from production).
2. Confirm the Google preview origin + redirect URI are configured (above).
3. Ensure the preview D1 migration path is ready (`wrangler d1 migrations apply
crawlpact-db-preview --remote`, via the normal `deploy-preview.yml` workflow — never applied
   ad hoc from a local machine).
4. Deploy preview through the normal trusted workflow (`deploy-preview.yml`, triggered by CI
   success on `main` — never a manual `wrangler deploy` from a local working tree).
5. Apply/verify the preview migration according to the existing deployment procedure.
6. Run the preview smoke test (`pnpm run smoke:preview`).
7. Manually sign up with a designated Google test user (Google Auth Platform's Testing mode
   requires the account to be an explicitly added test user).
8. Verify the new `users` row + `oauth_accounts` association + session were actually created (a
   direct, read-only D1 query — the established pattern this repo already uses for post-deploy
   verification elsewhere).
9. Test sign-out → Google sign-in (existing account).
10. Test an existing passkey account → "Connect Google" → both methods reach the same `users.id`.
11. Test the anonymous-audit continuation flow through Google sign-up.
12. Test the pricing/checkout continuity flow through Google sign-up.
13. Test the Google disconnect lockout safeguard (refused with no passkey; allowed with one).
14. Confirm production is unaffected (no shared D1/KV/R2, no changed production vars).

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
