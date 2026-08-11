-- Phase 16: Policy Observatory — research publication governance.
--
-- Deliberately a single table, not the full research_studies/research_corpora/
-- research_runs/research_observations model the Phase 16 prompt sketches as
-- *possible* architecture (§25: "Do not automatically create all of them.
-- Choose the minimum architecture required by real Phase 16 outputs."). This
-- phase ships the Registry Observatory only (Layer A) — every published
-- research artifact is deterministically derived from an immutable
-- `registry_versions` release, so there is no separate corpus/run/observation
-- concept yet. The Website Policy Observatory (Layer B) is explicitly
-- deferred — see docs/research/PHASE_16_RESEARCH_CORPUS_DECISION.md — and
-- would need its own migration when built.
--
-- `content_json`: the full deterministic, code-generated publication body
-- (title, summary, key findings with numerator/denominator/scope, methodology
-- version, registry version, limitations, provenance). Frozen once published;
-- `correct()` rewrites it in place only through the governed correction flow
-- (which appends to `correction_log` — never a silent edit).
--
-- `checksum`: SHA-256 over the canonicalised `content_json`, recomputable via
-- `pnpm research:integrity:verify` and `pnpm research:reproduce`, mirroring
-- migration 0034's registry release checksum.
CREATE TABLE research_publications (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('registry_landscape')),
  status TEXT NOT NULL CHECK (status IN ('draft', 'review', 'published', 'corrected', 'superseded', 'withdrawn')) DEFAULT 'draft',
  title TEXT NOT NULL,
  methodology_version TEXT NOT NULL,
  registry_version_id TEXT NOT NULL REFERENCES registry_versions (id),
  content_json TEXT NOT NULL,
  checksum TEXT NOT NULL,
  correction_log TEXT NOT NULL DEFAULT '[]',
  superseded_by_publication_id TEXT REFERENCES research_publications (id),
  withdrawal_reason TEXT,
  created_by_user_id TEXT REFERENCES users (id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  published_at TEXT,
  corrected_at TEXT
);

CREATE INDEX idx_research_publications_status ON research_publications (status);
CREATE INDEX idx_research_publications_registry_version_id ON research_publications (registry_version_id);
