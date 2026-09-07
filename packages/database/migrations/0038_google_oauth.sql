-- Google federated authentication (ADR-0009). An additional credential
-- provider alongside passkeys/WebAuthn — not a second user/account system.
-- Every Google-authenticated person still resolves to exactly one row in
-- `users`; `oauth_accounts` only maps a verified Google identity onto that
-- existing account model. See docs/security/AUTHENTICATION_SECURITY.md and
-- docs/architecture/adr/ADR-0009-GOOGLE-FEDERATED-AUTHENTICATION.md.

-- One row per (user, provider) — this phase supports exactly one Google
-- identity per CrawlPact account (UNIQUE (user_id, provider)) and one
-- CrawlPact account per Google identity (UNIQUE (provider, provider_subject)).
-- `provider_subject` is Google's immutable `sub` claim — the only value ever
-- used to look up or authorize a Google sign-in; email is stored purely as
-- provider-account display metadata for Account settings and is never used
-- for authorization or automatic linking (see google-account.ts). No access
-- token, refresh token, or ID token is ever stored here or anywhere else —
-- this integration is authentication-only.
CREATE TABLE oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google' CHECK (provider IN ('google')),
  provider_subject TEXT NOT NULL,
  email TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_used_at TEXT,
  UNIQUE (provider, provider_subject),
  UNIQUE (user_id, provider)
);

CREATE INDEX idx_oauth_accounts_user_id ON oauth_accounts (user_id);

-- Server-authoritative, one-time, short-lived authentication intent — the
-- trust boundary for the cross-site Google redirect (SRS §33-adjacent CSRF
-- posture). The raw `state`/`nonce` values only ever exist client-side and
-- inside Google's ID token; only their SHA-256 hashes are ever persisted, so
-- a leaked DB row can't be replayed as a bearer credential. `action`
-- distinguishes sign-in / sign-up / an authenticated account-linking
-- request; `user_id` is set only for `link` (never trusted from the
-- request body — see google-account.ts). `redirect_to`/`failure_redirect`
-- are the server-derived, already-safe-relative-validated destinations
-- (Phase 5's `isSafeRelativeRedirect`), captured at intent-creation time so
-- the callback never has to trust anything Google echoes back for this.
CREATE TABLE oauth_auth_intents (
  id TEXT PRIMARY KEY,
  state_hash TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'google' CHECK (provider IN ('google')),
  action TEXT NOT NULL CHECK (action IN ('signin', 'signup', 'link')),
  redirect_to TEXT NOT NULL,
  failure_redirect TEXT NOT NULL,
  user_id TEXT REFERENCES users (id) ON DELETE CASCADE,
  nonce_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL,
  consumed_at TEXT
);

CREATE INDEX idx_oauth_auth_intents_expires_at ON oauth_auth_intents (expires_at);
CREATE INDEX idx_oauth_auth_intents_user_id ON oauth_auth_intents (user_id);
