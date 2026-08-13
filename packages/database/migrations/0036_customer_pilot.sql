-- Phase 17: Customer Pilot and Commercial Validation — minimal pilot cohort
-- framework. Three tables only (not the fuller cohorts/participants/
-- feedback/invites model the Phase 17 prompt sketches as *possible*
-- architecture) — no invite-token table, since Super Admin can associate an
-- existing user directly via the existing `searchUsers` lookup
-- (apps/web/src/lib/admin/users.ts), and building invite-token
-- infrastructure "unnecessarily" is explicitly discouraged.
--
-- Deliberately NO entitlement/plan/subscription/domain-count/payment field
-- anywhere in this file — pilot membership must never grant or imply a
-- product entitlement. Activation, monitoring adoption, and paid conversion
-- are always derived live from `domains`/`subscriptions`
-- (apps/web/src/lib/admin/pilot-analytics.ts), never duplicated here.
--
-- FK deletion policy mirrors migration 0015's established rule: `user_id`
-- (the participant's own data) cascades with account deletion;
-- `created_by_user_id`/`added_by_admin_user_id` (an admin actor reference)
-- is nulled instead, so an admin's own later account deletion never breaks
-- pilot history.
CREATE TABLE pilot_cohorts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'recruiting', 'active', 'analysis', 'completed', 'cancelled')) DEFAULT 'draft',
  started_at TEXT,
  ended_at TEXT,
  created_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE pilot_participants (
  id TEXT PRIMARY KEY,
  pilot_cohort_id TEXT NOT NULL REFERENCES pilot_cohorts (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  segment TEXT NOT NULL CHECK (segment IN ('individual', 'professional', 'agency', 'multi_site', 'other')),
  participation_status TEXT NOT NULL CHECK (participation_status IN ('invited', 'joined', 'active', 'completed', 'withdrew', 'inactive', 'disqualified')) DEFAULT 'invited',
  acquisition_source TEXT CHECK (acquisition_source IN ('direct_owner_outreach', 'existing_contact', 'referral', 'organic_interest', 'other')),
  -- Manually incremented by a Super Admin when a meaningful human
  -- intervention occurs (§79) — the narrative itself is recorded via the
  -- existing internal_user_notes mechanism (addInternalNote), not
  -- duplicated here.
  human_help_count INTEGER NOT NULL DEFAULT 0,
  joined_at TEXT,
  activated_at TEXT,
  ended_at TEXT,
  added_by_admin_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (pilot_cohort_id, user_id)
);

CREATE INDEX idx_pilot_participants_cohort_id ON pilot_participants (pilot_cohort_id);
CREATE INDEX idx_pilot_participants_user_id ON pilot_participants (user_id);

-- Structured feedback only — no interview transcripts, no raw audio (§84).
-- `comment` is optional free text, app-length-bounded (see the API route),
-- purged after 18 months by the existing data-retention job, mirroring
-- Phase 13's product_events retention window — see
-- docs/pilot/PHASE_17_PILOT_DATA_RETENTION_DECISION.md.
CREATE TABLE pilot_feedback (
  id TEXT PRIMARY KEY,
  pilot_participant_id TEXT NOT NULL REFERENCES pilot_participants (id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('onboarding', 'audit_clarity', 'evidence', 'recommendation', 'saved_domain', 'timeline', 'monitoring', 'notification', 'report_sharing', 'agency_workspace', 'pricing', 'billing', 'reliability', 'support', 'feature_request', 'other')),
  usefulness TEXT CHECK (usefulness IN ('low', 'medium', 'high')),
  clarity TEXT CHECK (clarity IN ('clear', 'unclear')),
  difficulty TEXT CHECK (difficulty IN ('easy', 'moderate', 'hard')),
  primary_value TEXT CHECK (primary_value IN ('crawler_matrix', 'evidence_findings', 'recommended_configuration', 'saved_history', 'monitoring', 'timeline_attribution', 'reports_sharing', 'agency_workflows')),
  blocking_issue TEXT CHECK (blocking_issue IN ('none', 'partial', 'blocked')),
  purchase_reason TEXT CHECK (purchase_reason IN ('monitoring', 'portfolio', 'evidence', 'time_saving', 'client_reporting', 'change_detection', 'governance', 'other')),
  non_purchase_reason TEXT CHECK (non_purchase_reason IN ('no_current_need', 'free_is_sufficient', 'price', 'missing_capability', 'trust', 'unclear_value', 'too_few_domains', 'existing_solution', 'billing_friction', 'not_decision_maker', 'other')),
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_pilot_feedback_participant_id ON pilot_feedback (pilot_participant_id);
