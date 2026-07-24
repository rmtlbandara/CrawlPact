-- Same real bug as migration 0013, found by the same Part 3 Step 21
-- verification pass, in a second table: product_events.user_id had no
-- ON DELETE clause at all (defaulting to SQLite's NO ACTION), so deleting
-- any user who had ever triggered a tracked event -- which is nearly every
-- real signup, since register/finish.ts writes an "account_created" event
-- immediately -- threw SQLITE_CONSTRAINT_FOREIGNKEY and aborted the entire
-- daily retention job. Confirmed by a real integration test against real
-- D1 before this fix.
--
-- Fix: user_id becomes ON DELETE SET NULL, matching the same
-- "aggregate/anonymised data survives, the identifying link doesn't"
-- principle already applied to billing_customers in migration 0013, and
-- consistent with this table already carrying an independent anonymous_id
-- for continuity without a direct user reference (SRS Sec.28.13, first-party
-- analytics minimisation).
--
-- Uses `PRAGMA defer_foreign_keys=ON`, not `foreign_keys=OFF` -- see
-- migration 0013's note and 0015's full explanation: D1 wraps a migration
-- file in one implicit transaction, and `foreign_keys=OFF` is silently a
-- no-op mid-transaction, so only `defer_foreign_keys` actually protects
-- the DROP/rebuild step against any pre-existing product_events rows.

PRAGMA defer_foreign_keys=ON;

CREATE TABLE product_events_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_name TEXT NOT NULL,
  user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  anonymous_id TEXT,
  properties TEXT, -- JSON, no unnecessary personal data (SRS §28.13)
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO product_events_new (id, event_name, user_id, anonymous_id, properties, created_at)
SELECT id, event_name, user_id, anonymous_id, properties, created_at FROM product_events;

DROP TABLE product_events;
ALTER TABLE product_events_new RENAME TO product_events;
