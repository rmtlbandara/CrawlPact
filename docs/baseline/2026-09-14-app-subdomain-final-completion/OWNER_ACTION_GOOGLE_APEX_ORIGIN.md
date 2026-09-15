# Owner Action Required — Google Apex Authorized Origin Disposition

Status 2026-09-15. Phase 4D.3 of the Master Finalization Directive asks for a final disposition
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

## Disposition recorded

```
GOOGLE APEX AUTHORIZED ORIGIN — OWNER ACTION REQUIRED (console access unavailable to this session)
```

This item does not block Phase 4's completion — the master directive itself treats an
unavailable-console item as a disclosed OWNER ACTION, not a blocker, provided it is not falsely
claimed as done.
