-- Paddle-backed billing (SRS §27). Paddle remains the source of truth; these
-- tables cache only what CrawlPact needs to identify the customer/plan and
-- determine access (ADR: local state is a cache, never authoritative).
CREATE TABLE billing_customers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  paddle_customer_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  billing_customer_id TEXT NOT NULL REFERENCES billing_customers (id) ON DELETE CASCADE,
  paddle_subscription_id TEXT NOT NULL UNIQUE,
  plan_id TEXT NOT NULL REFERENCES plans (id),
  status TEXT NOT NULL CHECK (
    status IN ('active', 'trialing', 'past_due', 'paused', 'cancelled', 'expired')
  ),
  current_period_end TEXT,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0 CHECK (cancel_at_period_end IN (0, 1)),
  last_paddle_event_id TEXT,
  sync_error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_subscriptions_billing_customer_id ON subscriptions (billing_customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions (status);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  paddle_transaction_id TEXT NOT NULL UNIQUE,
  billing_customer_id TEXT NOT NULL REFERENCES billing_customers (id) ON DELETE CASCADE,
  subscription_id TEXT REFERENCES subscriptions (id),
  currency TEXT NOT NULL,
  gross_amount_cents INTEGER NOT NULL,
  tax_amount_cents INTEGER,
  status TEXT NOT NULL,
  refund_status TEXT,
  chargeback_status TEXT,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_transactions_billing_customer_id ON transactions (billing_customer_id);

CREATE TABLE webhook_events (
  id TEXT PRIMARY KEY,
  paddle_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processed', 'ignored', 'failed', 'retrying', 'permanently_failed')
  ),
  related_billing_customer_id TEXT REFERENCES billing_customers (id),
  related_subscription_id TEXT REFERENCES subscriptions (id),
  payload_redacted TEXT NOT NULL, -- JSON, sensitive fields removed before storage
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  occurred_at TEXT NOT NULL,
  processed_at TEXT,
  last_retry_at TEXT
);

CREATE INDEX idx_webhook_events_status ON webhook_events (status);

CREATE TABLE temporary_entitlements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  granted_plan_id TEXT NOT NULL REFERENCES plans (id),
  reason TEXT NOT NULL,
  granted_by_user_id TEXT NOT NULL REFERENCES users (id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  revoked_at TEXT
);

CREATE INDEX idx_temporary_entitlements_user_id ON temporary_entitlements (user_id);
