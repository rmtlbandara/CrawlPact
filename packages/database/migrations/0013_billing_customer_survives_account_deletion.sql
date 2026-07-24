-- Fixes a real bug found in Part 3 Step 21 (privacy/retention verification):
-- billing_customers.user_id had ON DELETE CASCADE, which transitively
-- cascade-deleted subscriptions and transactions -- and was actually
-- blocked entirely by webhook_events' un-cascaded FK to billing_customers,
-- throwing a foreign key constraint error -- whenever an account was
-- purged after the deletion grace period expired. Confirmed by a real
-- integration test against real D1 before this fix: any account that had
-- ever had a webhook processed made the daily retention cron throw and
-- silently stop processing further accounts, every single day, until
-- fixed. This contradicted the documented retention policy (SRS Sec.34:
-- billing/transaction records are kept "as legally and operationally
-- required," independent of the owning account's lifecycle).
--
-- SQLite cannot ALTER a column's foreign key behavior directly, so this
-- rebuilds the table per SQLite's documented 12-step procedure, preserving
-- every row and every other constraint/index/data value unchanged.
--
-- Uses `PRAGMA defer_foreign_keys=ON`, not `foreign_keys=OFF`: D1 runs a
-- migration file as one implicit transaction, and SQLite silently no-ops
-- `foreign_keys` pragma changes mid-transaction, so `OFF` here would not
-- actually take effect (this only stayed harmless because, on the
-- databases this ran against so far, no subscriptions/transactions/
-- webhook_events rows existed yet to violate the DROP TABLE step; it is
-- still a latent bug against any database with real billing data present
-- before this migration runs). `defer_foreign_keys` IS honored
-- mid-transaction and defers every check to the final COMMIT, by which
-- point billing_customers exists again with the same data under the same
-- name. See migration 0015's note for the full empirical finding.

PRAGMA defer_foreign_keys=ON;

CREATE TABLE billing_customers_new (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE REFERENCES users (id) ON DELETE SET NULL,
  paddle_customer_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO billing_customers_new (id, user_id, paddle_customer_id, created_at, updated_at)
SELECT id, user_id, paddle_customer_id, created_at, updated_at FROM billing_customers;

DROP TABLE billing_customers;
ALTER TABLE billing_customers_new RENAME TO billing_customers;
