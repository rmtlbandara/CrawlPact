# Google Apex Authorized Origin Disposition — COMPLETE

**Status 2026-09-15 (updated): COMPLETE.** The product owner removed `https://crawlpact.com` from
the CrawlPact Google OAuth Web client's Authorized JavaScript Origins and confirmed a real
Production Google sign-in on `https://app.crawlpact.com/sign-in` still succeeds end-to-end
(account chooser → authentication → return to `https://app.crawlpact.com/app` → authenticated
dashboard loaded). Remaining Authorized JavaScript Origins after the change:
`http://localhost:4321`, `https://preview.crawlpact.com`, `https://app.crawlpact.com`. Authorized
Redirect URIs were left unchanged.

```
GOOGLE APEX AUTHORIZED JAVASCRIPT ORIGIN — REMOVED ✅
APP-HOST GOOGLE SIGN-IN — RECONFIRMED ✅
GOOGLE MIGRATION CLEANUP — COMPLETE ✅
```

Note on the account-chooser branding: Google's chooser screen showing "continue to
crawlpact.com"-style copy reflects the registered **application/verification name**, not the
browser-origin JavaScript check — it is expected and is not evidence that the removed apex origin
is still being used for the origin-validated flow itself.

**Verification limitation, unchanged**: this session has no tool that can read or write Google
Cloud Console configuration, so the origin removal itself is OWNER-OBSERVED evidence (the owner's
direct report), not independently re-verified by this session against the Google API. The
resulting live sign-in behavior (app-host flow succeeding) is exactly what such a removal should
produce and is consistent with the owner's report.

---

_Original action-item text, preserved below for context on why this was raised and what was
asked — not rewritten now that it is resolved._

Phase 4D.3 of the Master Finalization Directive asks for a final disposition
on whether `https://crawlpact.com` should remain a Google Authorized JavaScript Origin now that
the app-subdomain migration's Google Sign-In flow runs on `https://app.crawlpact.com`.

## Why this session cannot perform this action

No tool available to this session can read or write Google Cloud Console / Google Auth Platform
configuration. This was already true as of the 2026-09-11 pre-Phase-4 closure pass (see
`docs/baseline/2026-09-11-app-subdomain-final-pre-phase4/OWNER_ACTION_QUEUE.md` item 4) and
remains true now — confirmed again this session rather than assumed stale. This is not fabricated
as done, and the apex origin has **not** been removed by this session.

## What the owner needs to do

1. Open Google Cloud Console → **APIs & Services → Credentials** for the CrawlPact OAuth client
   (`GOOGLE_CLIENT_ID` in `wrangler.jsonc`, ending `...apps.googleusercontent.com`).
2. Confirm `https://app.crawlpact.com` is present as an **Authorized JavaScript origin** — this is
   required and should already be present (Google sign-in on the app host is live and was
   previously owner-confirmed working, per `docs/status/CURRENT_STATE.md`).
3. Decide on `https://crawlpact.com`'s continued presence as an Authorized JavaScript origin:
   - **Remove it** if no legitimate apex-hosted Google sign-in flow remains — the app-subdomain
     migration's Stage A/B/C work has moved every first-party sign-in entry point to
     `app.crawlpact.com` (`ENTRY_POINT_INVENTORY.md`), and the legacy `/sign-in` apex path now
     permanently `308`-redirects to the app host rather than rendering a sign-in form itself, so
     the apex origin should have no remaining legitimate Google Sign-In use.
   - **Keep it** only if you are aware of a real, currently-used apex-hosted Google flow this
     session's evidence missed.
4. After removing it (if you do): perform a real Google sign-in on `https://app.crawlpact.com`
   and confirm it still succeeds — this is the one verification step that matters and the one
   this session cannot substitute for.
5. If you keep it: no action needed, but record the reason briefly wherever you track this
   decision, so a future pass doesn't re-raise the same question without context.

## Do not

- Do not remove the origin without first confirming the app-host flow still authorizes-origin
  correctly afterward — Google enforces this at the browser/JS-SDK level, and a mistake here
  breaks sign-in for every user, not just a subset.
- Do not weaken working Google auth for cosmetic cleanup alone — this is optional hygiene, not a
  blocking item.

## Disposition recorded (original, superseded — see the top of this file)

```
~~GOOGLE APEX AUTHORIZED ORIGIN — OWNER ACTION REQUIRED (console access unavailable to this session)~~
```

**Superseded 2026-09-15**: the owner performed the action directly and confirmed the result —
see the completion notice at the top of this file.
