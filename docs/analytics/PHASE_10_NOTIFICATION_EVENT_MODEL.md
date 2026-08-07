# Phase 10 — Notification Event Model (Analytics)

12 new categorical events, appended to `apps/web/src/lib/analytics.ts`'s `PRODUCT_EVENT_NAMES`
following the established convention (a `const` array, no zod enum, `trackEvent()`/`track()` as the
only write paths).

| Event                                                       | Fired from                                                                                                                                              | Properties                                                                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `notifications_viewed`                                      | `NotificationsManager.tsx`, on mount and on filter change                                                                                               | none                                                                                                       |
| `notification_marked_read`                                  | `NotificationsManager.tsx`, per mark-read action                                                                                                        | none                                                                                                       |
| `notifications_marked_all_read`                             | `NotificationsManager.tsx`                                                                                                                              | none                                                                                                       |
| `notification_filter_applied`                               | `NotificationsManager.tsx`                                                                                                                              | `unreadOnly: boolean`, `category: string` (a category name or `"all"` — never a notification id/type/body) |
| `notification_deep_link_opened`                             | `NotificationsManager.tsx`, per domain link click                                                                                                       | none                                                                                                       |
| `atom_feed_created`                                         | `pages/api/notifications/feed-token.ts` POST, server-side                                                                                               | none                                                                                                       |
| `atom_feed_regenerated`                                     | same route, when an active token already existed                                                                                                        | none                                                                                                       |
| `atom_feed_revoked`                                         | same route, DELETE                                                                                                                                      | none                                                                                                       |
| `atom_feed_entitlement_blocked`                             | same route, on the 403 path                                                                                                                             | none                                                                                                       |
| `monitoring_paused_viewed`                                  | reserved for a future domain-detail surfacing of the paused state (not wired to a UI event in this phase's scope — no domain-detail UI change was made) | —                                                                                                          |
| `monitoring_resume_started` / `monitoring_resume_completed` | reserved for the existing (unchanged by Phase 10) resume action, not newly instrumented this phase                                                      | —                                                                                                          |

`monitoring_paused_viewed`/`monitoring_resume_*` are declared (for forward-compatibility with the
existing, unchanged resume UI) but not fired by any Phase 10 code change — Phase 10 did not modify
the domain-detail monitoring-resume UI, so instrumenting it was out of this phase's actual code
change surface. `notification_opened` (mark-read tracking) already existed before Phase 10
(`apps/web/src/lib/notifications.ts`'s `markNotificationsRead`) and is unchanged.

## Never sent as a property (enforced by code review, not a runtime guard)

Notification body, notification title, domain name, feed token, feed URL, notification id, scan id,
timeline-event id, user email, Paddle identifiers. Every property above is a plain categorical
string/boolean — confirmed by reading every `trackEvent`/`track()` call site added this phase.

## Analytics vs. reliability metrics

Kept separate per §70: product analytics (this document) answers "do users open notifications, use
Atom, follow domain links" — engagement questions. Reliability metrics
(`GET /api/admin/capacity`'s `monitoring`/`notifications` blocks) answer "was a notification
generated, deduplicated, missed, reconciled; is monitoring overdue" — correctness questions.
Reliability metrics are never derived from the analytics event stream (`product_events`), and vice
versa.
