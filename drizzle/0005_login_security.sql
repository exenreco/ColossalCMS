CREATE TABLE IF NOT EXISTS login_ip_windows (
  id text PRIMARY KEY NOT NULL,
  ip text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  failures integer NOT NULL DEFAULT 0,
  successes integer NOT NULL DEFAULT 0,
  first_at text NOT NULL,
  last_at text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_login_windows_ip ON login_ip_windows (ip);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_login_windows_last ON login_ip_windows (last_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS login_ip_blocks (
  id text PRIMARY KEY NOT NULL,
  ip text NOT NULL,
  source text NOT NULL,
  reason text NOT NULL DEFAULT '',
  created_at text NOT NULL,
  expires_at text NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS login_events (
  id text PRIMARY KEY NOT NULL,
  ip text NOT NULL,
  email text NOT NULL DEFAULT '',
  outcome text NOT NULL,
  created_at text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_login_events_created ON login_events (created_at);
