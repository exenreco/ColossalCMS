CREATE TABLE IF NOT EXISTS auth_credentials (
  id text PRIMARY KEY NOT NULL,
  password_hash text NOT NULL,
  updated_at text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS auth_sessions (
  id text PRIMARY KEY NOT NULL,
  member_id text NOT NULL,
  expires_at text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions (expires_at);
