-- RISK-025: the `idx_crawlers_user_agent_token` unique index (0004_registry.sql,
-- re-created identically by 0015's table rebuild) used SQLite's default BINARY
-- collation, so 'Googlebot' and 'googlebot' could both be inserted as distinct
-- rows. `scripts/registry-tools.mjs`'s duplicate-token validator has always
-- compared case-insensitively (`GROUP BY LOWER(user_agent_token)`), so the two
-- layers disagreed. This makes the DB constraint case-insensitive to match,
-- closing the gap the CLI validator alone could not enforce.
--
-- No plain `ALTER INDEX` exists in SQLite; a unique index can be redefined
-- directly via DROP + CREATE without a table rebuild, since this only changes
-- the index's collating sequence, not the underlying column type or any FK
-- clause.
DROP INDEX idx_crawlers_user_agent_token;

CREATE UNIQUE INDEX idx_crawlers_user_agent_token ON crawlers (user_agent_token COLLATE NOCASE);
