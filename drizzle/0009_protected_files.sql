CREATE TABLE IF NOT EXISTS protected_files (
  id text PRIMARY KEY NOT NULL,
  source_media_id text NOT NULL,
  storage_key text NOT NULL,
  name text NOT NULL,
  mime text NOT NULL,
  password_hash text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS protected_file_attempts (
  id text PRIMARY KEY NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_protected_file_attempts_expiry ON protected_file_attempts (expires_at);
