CREATE TABLE IF NOT EXISTS messaging_messages (
  id text PRIMARY KEY NOT NULL,
  sender_name text NOT NULL DEFAULT '',
  sender_email text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  fields text NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'unread',
  notification_status text NOT NULL DEFAULT 'not-configured',
  source_path text NOT NULL DEFAULT '',
  created_at text NOT NULL,
  updated_at text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_messaging_status ON messaging_messages (status,created_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS messaging_tokens (
  id text PRIMARY KEY NOT NULL,
  form_hash text NOT NULL,
  expires_at text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_messaging_token_expiry ON messaging_tokens (expires_at);
