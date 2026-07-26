-- Persists the Policy Health Score's per-category breakdown alongside the
-- overall score, so real reports can show the same category detail the
-- landing page's synthetic demo already renders (SRS §10.24). Previously
-- `computePolicyHealthScore` (packages/policy/src/scoring.ts) computed this
-- breakdown but it was discarded before reaching persistence.
ALTER TABLE scans ADD COLUMN score_breakdown TEXT; -- JSON: Record<ScoreCategory, number>
