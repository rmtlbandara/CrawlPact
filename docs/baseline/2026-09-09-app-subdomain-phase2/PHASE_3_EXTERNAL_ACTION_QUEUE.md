# Phase 3 External Action Queue

Date: 2026-09-09. Nothing here changed externally during Phase 2 (Phase 2 touched only code/config
in the repository) — this restates Phase 1's `EXTERNAL_PREREQUISITES.md` with the sequencing
Phase 2's actual implementation now makes concrete, plus one new internal deployment gate Phase 2
surfaced.

## Sequencing Phase 3 must follow

```
1. Deploy Phase 2's code to Preview first (existing environment, no new hostname).
   Verify: security headers, trailing-slash redirects, and Worker-invocation behavior
   under the production-shaped `run_worker_first` array pattern — Preview already runs
   `run_worker_first: true` (blanket), so this specifically means validating the
   *selective* array pattern's behavior before it goes to production, per
   STATIC_ASSET_HOST_ENFORCEMENT.md's deployment caution.

2. Deploy Phase 2's code to production (same code, still no Custom Domain change).
   This is the "real production behavior change" flagged in
   STATIC_ASSET_HOST_ENFORCEMENT.md — requires explicit deployment authorization,
   separate from Phase 2/3 planning authorization.
   Verify via direct production checks: homepage, a sample of prerendered pages
   (trailing slash, headers), /sign-in, /app, /admin all still behave exactly as before
   (Phase 20 canonical contract, security headers, existing apex auth) — this is a
   regression check, not new functionality.

3. Only after step 2 is confirmed stable: attach app.crawlpact.com as a second
   Cloudflare Custom Domain to the same Worker (crawlpact-web). No DNS conflict
   exists (live-verified Phase 1, re-verify at execution time). This is the point
   at which `worker.ts`'s app-surface logic (HOST_ROUTING_IMPLEMENTATION.md)
   starts actually mattering for real traffic.

4. Add https://app.crawlpact.com to the existing Google OAuth Web Client's
   Authorized JavaScript Origins (Google Cloud Console — this session has no
   access; owner action).

5. Direct-host validation against the now-live app.crawlpact.com:
   - a real existing production passkey authenticates successfully
     (WEBAUTHN_MIGRATION_CONTRACT.md's mandatory regression gate — cannot be
     performed before this point);
   - new passkey registration + login;
   - Google sign-in from the app host;
   - recovery-code redemption;
   - dashboard/account/admin navigation;
   - a public-only path requested on app.crawlpact.com correctly redirects to the
     apex (this is the moment HOST_ROUTING_IMPLEMENTATION.md's hard-gate logic
     is exercised by a real Custom Domain for the first time, not just tests).

6. Only after step 5 passes: submit app.crawlpact.com to Paddle for checkout-domain
   approval (Paddle Dashboard — no API; owner action). Do not enable live app-host
   checkout before approval status is confirmed.

7. Full Phase 3 regression suite per PHASE_2_TEST_CONTRACT.md (inherited from Phase 1,
   still the authoritative test contract — Phase 2 implemented the code it specifies
   tests for; Phase 3 runs the direct-host versions of those tests against the real
   attached domain).
```

## Owner actions (unchanged from Phase 1, still not started)

| System     | Status              | Action                                                                                     |
| ---------- | ------------------- | ------------------------------------------------------------------------------------------ |
| Cloudflare | Ready, not attached | Attach `app.crawlpact.com` Custom Domain to `crawlpact-web` — **only after step 2 above**  |
| Google     | Not configured      | Add `https://app.crawlpact.com` as an Authorized JavaScript Origin                         |
| Paddle     | Not submitted       | Submit `app.crawlpact.com` as a checkout domain for approval — **only after step 5 above** |

No owner action has been taken during Phase 2. None is a Phase 2 blocker; Phase 2 was pure code
implementation.
