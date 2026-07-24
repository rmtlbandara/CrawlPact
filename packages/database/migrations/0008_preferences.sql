-- Optional UI preferences (SRS §32 "Optional UI Preferences").
CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  sidebar_collapsed INTEGER NOT NULL DEFAULT 0 CHECK (sidebar_collapsed IN (0, 1)),
  table_density TEXT NOT NULL DEFAULT 'comfortable' CHECK (table_density IN ('comfortable', 'compact')),
  reduced_motion INTEGER NOT NULL DEFAULT 0 CHECK (reduced_motion IN (0, 1)),
  theme_preference TEXT NOT NULL DEFAULT 'light' CHECK (theme_preference IN ('light', 'dark')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE saved_filters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  context TEXT NOT NULL, -- e.g. 'domains', 'admin_users'
  name TEXT NOT NULL,
  filter_state TEXT NOT NULL, -- JSON
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_saved_filters_user_id ON saved_filters (user_id);

CREATE TABLE table_preferences (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  table_key TEXT NOT NULL, -- e.g. 'domains_table'
  visible_columns TEXT NOT NULL, -- JSON array
  sort_state TEXT, -- JSON
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, table_key)
);
