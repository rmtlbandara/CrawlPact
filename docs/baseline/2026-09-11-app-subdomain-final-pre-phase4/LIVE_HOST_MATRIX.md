# Final Pre-Phase-4 — Live Host/Route Boundary Matrix

Status 2026-09-11. Evidence class: LIVE HTTP unless noted. Re-run against the current live
Production deployment (`8eacde5b-…` / `a73071e7-…`) — no code changed since the last full pass, so
results are unchanged from the prior turn's validation, re-confirmed rather than re-derived from
memory.

## Apex (`crawlpact.com`)

| Path                                                                                        | Result                                                              |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `/`                                                                                         | 200                                                                 |
| `/pricing/`                                                                                 | 200                                                                 |
| `/about/`                                                                                   | 200                                                                 |
| `/audit`                                                                                    | 301 → `/audit/`                                                     |
| `/crawlers/`, `/crawlers/gptbot/`                                                           | 200                                                                 |
| `/guides/`, `/tools/`, `/platforms/`, `/methodology/`, `/security/`, `/privacy/`, `/terms/` | 200                                                                 |
| `/status`                                                                                   | 301 → `/status/`                                                    |
| `/sign-in`                                                                                  | 200                                                                 |
| `/pay`                                                                                      | 200                                                                 |
| `/sitemap.xml`                                                                              | 200                                                                 |
| `/robots.txt`                                                                               | 200                                                                 |
| `/index.html`, `/index`                                                                     | 301 → `/`                                                           |
| `/about.html`, `/about/index`, `/about/index.html`                                          | 301 → `/about/` (single hop)                                        |
| `/security.html`                                                                            | 301 → `/security/`                                                  |
| `/crawlers.html`, `/crawlers/index.html`                                                    | 301 → `/crawlers/`                                                  |
| `/crawlers/gptbot.html`                                                                     | 301 → `/crawlers/gptbot/`                                           |
| `/for/agencies`, `/for/agencies/index`, `/for/agencies/index.html`, `/for/agencies.html`    | 301 → `/for/agencies/` (single hop, the fix this migration shipped) |
| `/research/x.html`                                                                          | 301 → `/research/x/` (single hop)                                   |
| Webhook GET                                                                                 | 404                                                                 |
| Webhook unsigned POST                                                                       | 403                                                                 |

No malformed `.../index.html/` target found anywhere. No redirect loop found anywhere.

## App (`app.crawlpact.com`)

| Path                       | Result                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `/` (no cookie)            | 200 — public app-shell, `noindex`                                                   |
| `/sign-in`                 | 200                                                                                 |
| `/app` (unauthenticated)   | 302                                                                                 |
| `/admin` (unauthenticated) | 302                                                                                 |
| `/about/`                  | 308 → `https://crawlpact.com/about/`                                                |
| `/for/agencies/index.html` | 308 → `https://crawlpact.com/for/agencies/` (alias fix applies on the app host too) |
| `/robots.txt`              | `Allow: /`; `Disallow: /app`, `/admin`, `/api/`, `/audit/`, `/shared/`, `/dev/`     |

No public marketing HTML returns 200 on the app host anywhere tested. Query-string preservation
confirmed on both apex and app-host alias redirects (`?ref=abc`/`?utm_source=x` carried through
exactly, verified in earlier passes of this same migration; unchanged this pass since the
underlying `resolveCanonicalRedirectTarget` code is untouched).

## Unknown/other hostnames

`crawlpact-web.<account>.workers.dev` remains reachable — public content served (expected, no
boundary exists there for public content), but `/sign-in`, `/app`, `/admin`, `/api/*` all fail
closed against it (confirmed directly against the real fallback hostname in Phase 3, unchanged
since — `isSensitivePath` + unknown-host classification in `worker.ts` is host-derived, not
route-table-derived, so this doesn't need re-testing every pass to remain true, but is noted here
as evidence class SOURCE INSPECTION + Phase-3 LIVE HTTP, not re-executed fresh this exact pass).
See `OWNER_ACTION_QUEUE.md` item 2 for its disposition (Classification B — acceptable temporary
fallback with a proven fail-closed boundary).
