# Data Retention

Mirrors SRS §34. Enforced by a daily scheduled job as of Part 2 Step 19 —
`apps/web/src/lib/data-retention.ts`, run from the same cron as monitoring
(`apps/web/src/worker.ts`'s `scheduled()`, unconditionally — it's a privacy/compliance job, not
gated behind `AUDIT_ENGINE_ENABLED` the way scanning is). Tested against a real D1 database in
`apps/web/tests/integration/data-retention.integration.test.ts`.

| Data                           | Retention                             | Enforcement                                                                                                                                                                                                                                 |
| ------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anonymous scan cache           | 24 hours to 7 days                    | ✅ Purged after 7 days (`purgeAnonymousScans`)                                                                                                                                                                                              |
| Free account scan history      | 30 days                               | ✅ Per the owning user's current plan (`plans.history_retention_days`)                                                                                                                                                                      |
| Solo plan history              | 12 months                             | ✅ Same mechanism as above                                                                                                                                                                                                                  |
| Pro plan history               | 24 months                             | ✅ Same mechanism as above                                                                                                                                                                                                                  |
| Agency plan history            | 36 months                             | ✅ Same mechanism as above                                                                                                                                                                                                                  |
| Raw IP security logs           | Minimum operational period            | ✅ Never stored raw at all — only a salted hash (`ip_hash`), by design                                                                                                                                                                      |
| Administrative logs            | At least 24 months                    | ✅ `admin_audit_logs` has had a real writer (`writeAdminAuditLog`) since Part 3 Step 1; kept indefinitely today, which trivially satisfies a 24-month floor — no purge job exists or is required                                            |
| Billing reconciliation records | As legally and operationally required | ✅ Kept indefinitely and now **provably survives account deletion** (see below) — `transactions`/`webhook_events` were never purged, but see the Part 3 Step 21 fix note for why "never purged" alone wasn't actually true before this pass |
| Deleted account private data   | Purge within 30 days where permitted  | ✅ Hard-deleted after the 30-day cancellable grace period, cascading through every owned table via `ON DELETE CASCADE`                                                                                                                      |

A domain's _current_ scan (`domains.last_scan_id`) is always kept regardless of age, even past
the retention cutoff — deleting it would leave the domain's displayed score/report pointing at a
row that no longer exists. Only older, superseded scans for that domain are purged.

## What is stored vs. not stored

CrawlPact stores bounded snapshots of specific policy resources (`robots.txt`, `llms.txt`, RSL,
relevant headers, relevant HTML policy snippets, sitemap metadata) via `scan_resources.
snapshot_text`, capped by the `max_body_size_bytes` runtime setting. It never stores a copy of
an entire website.

## IP addresses

`ip_hash` columns (`sessions`, `security_events`) store an HMAC-SHA256 hash (keyed by
`SESSION_SIGNING_SECRET`, see `apps/web/src/lib/ip-hash.ts`), never a raw IP — implemented in
Part 2 and used consistently across auth rate limiting, recovery-code redemption, webhook
signature failures, and unsafe-scan-attempt logging.

## Part 3 Step 21 fix: account deletion was silently destroying (or crashing on) actor-linked history

Verification for this step included writing a real integration test that creates a user with a
`billing_customers`/`subscriptions`/`transactions`/`webhook_events` trail and then runs the real
deletion purge against it — something no prior test had exercised. The test failed against the
existing schema: `billing_customers.user_id` had `ON DELETE CASCADE`, and `webhook_events`'s FK
to `billing_customers` had no cascade at all, so deleting a user whose billing customer had ever
had a webhook processed threw `SQLITE_CONSTRAINT_FOREIGNKEY` and aborted the **entire** daily
retention job (including the unrelated entitlement-expiry step that runs after it in the same
job) — every day, indefinitely, for that account. For a billing customer with no webhook history,
the same cascade would instead have silently deleted their `subscriptions`/`transactions` rows,
contradicting the retention table above.

Fixed in `migrations/0013_billing_customer_survives_account_deletion.sql`:
`billing_customers.user_id` is now nullable with `ON DELETE SET NULL` instead of `CASCADE` — the
billing/transaction trail survives account deletion, only its link to the (now-gone) user is
severed. Proven by
`apps/web/tests/integration/data-retention.integration.test.ts`'s billing-retention test, which
fails against the old schema and passes against the fix.

The same verification pass found the identical bug in `product_events.user_id` (no `ON DELETE`
clause at all, defaulting to SQLite's `NO ACTION`) — fixed in
`migrations/0014_product_events_survive_account_deletion.sql`, same `SET NULL` treatment, covered
by the same test's `product_events` assertions.

An exhaustive `grep -n "REFERENCES users" packages/database/migrations/*.sql` sweep then found 12
more "who did this" (actor-reference) columns with the same latent bug, across `crawlers`,
`registry_versions`, `ruleset_versions`, `admin_role_assignments`, `temporary_entitlements`,
`scans`, `system_notices`, `security_events` (two columns), `admin_audit_logs`, `blocked_targets`,
`runtime_configuration`, and `internal_user_notes` — any of these would have thrown the same
constraint error and aborted the retention job the first time an account with a matching
historical row (e.g. a customer's own past scan, or an admin who had ever approved a crawler,
published a registry release, or written an audit log entry) was purged. Fixed in a single
migration, `migrations/0015_actor_references_survive_account_deletion.sql`, applying the same
"the record survives, only the actor link is severed" `ON DELETE SET NULL` treatment to every one
of them (four of which — `temporary_entitlements.granted_by_user_id`,
`admin_audit_logs.administrator_user_id`, `blocked_targets.blocked_by_user_id`,
`internal_user_notes.author_user_id` — also had to become nullable, since they were `NOT NULL`).
`internal_user_notes.user_id` (the note's _subject_, as opposed to its author) deliberately keeps
`ON DELETE CASCADE` unchanged: a note about a deleted customer is that customer's PII and should
go; only the _author_ reference (an admin) survives.

**Migration-authoring note for anyone writing a future SQLite table-rebuild migration against
D1**: `PRAGMA foreign_keys=OFF` — the first clause of SQLite's documented 12-step table-rebuild
procedure — is silently a no-op when run inside D1, because both `wrangler d1 execute --file` and
`wrangler d1 migrations apply` run an entire migration file as one implicit transaction, and
SQLite ignores `foreign_keys` pragma changes made mid-transaction (this is standard SQLite
behavior, not a D1 bug). Migrations 0013–0015 originally shipped with `foreign_keys=OFF` and
passed when tested against a fresh, autocommit-mode `sqlite3` CLI database — but failed with
`SQLITE_CONSTRAINT_FOREIGNKEY` when applied to a real D1 database that already had rows in tables
downstream of the ones being rebuilt (e.g. `crawlers` is a parent of `registry_version_entries`).
The fix, applied to all three migrations, is `PRAGMA defer_foreign_keys=ON` instead: unlike
`foreign_keys`, SQLite explicitly allows `defer_foreign_keys` to be toggled mid-transaction, and it
defers every FK check in the file to the final implicit `COMMIT` — by which point each rebuilt
table exists again under its original name with valid data, so every deferred check passes. Any
future migration using this rebuild pattern must use `defer_foreign_keys`, not `foreign_keys=OFF`.
Validate new migrations of this shape against a **fresh D1 database** via
`wrangler d1 execute --local --persist-to <scratch-dir> --file <migration>` (which faithfully
reproduces D1's transaction-wrapping behavior), not just a raw `sqlite3 db < file` run — the two
environments genuinely disagree on this specific case.

**Known follow-on gap, disclosed rather than fixed in the same pass**: `lib/admin/subscriptions.ts`'s
`listSubscriptions`/`listTransactions` use an `INNER JOIN` to `users` to show the owner's name —
a billing customer whose account has been deleted (so `user_id` is now `NULL`) will no longer
appear in those admin list views, even though the underlying rows are intact and queryable
directly. This is a real UX/completeness gap (the record isn't lost, just not surfaced in that
one view) — see `docs/status/KNOWN_RISKS.md`.

## What's still open

Billing records (`transactions`, `webhook_events`) have no purge job — SRS leaves their exact
retention to "legally and operationally required," which needs a real decision (likely
finance-adjacent) rather than an arbitrary cutoff invented here. This is now moot in the sense
that these records are also never _accidentally_ deleted alongside an account (fixed above).
