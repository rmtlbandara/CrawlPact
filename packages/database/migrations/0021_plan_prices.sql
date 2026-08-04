-- Phase 6 (Pricing, Plan Architecture and Checkout Continuity): replaces the flat, single
-- annual-price-per-plan model (`plans.annual_price_usd_cents`, one Paddle price ID per plan via
-- flat env vars in `apps/web/src/lib/billing/plan-mapping.ts`) with a normalised, DB-backed,
-- multi-interval, multi-environment, legacy-aware price catalog. `plans.annual_price_usd_cents`
-- is left in place (no destructive column removal) but is no longer written to or read by any
-- Phase 6 code — see docs/billing/APPROVED_PRICING_AND_ENTITLEMENT_MATRIX.md and
-- docs/billing/PADDLE_LIVE_CATALOG_MAP.md.
--
-- One row per (plan, environment, interval, Paddle price). A given plan/environment/interval can
-- have more than one row over time (the "current" one plus any number of "legacy" ones) — that's
-- deliberate: an existing subscriber's webhook events must keep resolving through a legacy row
-- forever, even after a newer current row exists for the same plan/interval/environment.
CREATE TABLE plan_prices (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans (id),
  environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'production')),
  interval TEXT NOT NULL CHECK (interval IN ('month', 'year')),
  amount_usd_cents INTEGER NOT NULL,
  paddle_product_id TEXT NOT NULL,
  paddle_price_id TEXT NOT NULL,
  -- Whether this price may be offered to a brand-new checkout. false for every legacy row and
  -- for any row superseded by a newer one at the same plan/environment/interval.
  active_for_new_checkout INTEGER NOT NULL DEFAULT 1 CHECK (active_for_new_checkout IN (0, 1)),
  -- true once a newer row exists for the same plan/environment/interval. A legacy row is never
  -- deleted or its Paddle price archived automatically — see
  -- docs/billing/LEGACY_PRICE_AND_SUBSCRIBER_POLICY.md.
  legacy INTEGER NOT NULL DEFAULT 0 CHECK (legacy IN (0, 1)),
  effective_date TEXT NOT NULL,
  archived_at TEXT,
  last_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (paddle_price_id)
);

CREATE INDEX idx_plan_prices_lookup ON plan_prices (plan_id, environment, interval, active_for_new_checkout);
CREATE INDEX idx_plan_prices_paddle_price_id ON plan_prices (paddle_price_id);

-- Additive subscription columns: which exact price/interval a subscription is actually on (the
-- old schema stored neither — only `plan_id`, inferred indirectly through a flat env-var lookup
-- at webhook-processing time, never persisted), plus a scheduled-downgrade slot. A scheduled
-- downgrade is never applied to Paddle itself until its effective date arrives (see
-- docs/billing/PLAN_CHANGE_AND_PRORATION_POLICY.md) — until then the subscription's real
-- `plan_id`/`paddle_price_id` are simply left untouched, so current entitlements are preserved
-- with no extra logic beyond "don't call Paddle yet."
ALTER TABLE subscriptions ADD COLUMN paddle_price_id TEXT;
ALTER TABLE subscriptions ADD COLUMN billing_interval TEXT CHECK (billing_interval IN ('month', 'year'));
ALTER TABLE subscriptions ADD COLUMN scheduled_plan_id TEXT REFERENCES plans (id);
ALTER TABLE subscriptions ADD COLUMN scheduled_paddle_price_id TEXT;
ALTER TABLE subscriptions ADD COLUMN scheduled_change_effective_at TEXT;
