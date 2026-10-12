CREATE TABLE IF NOT EXISTS content_views (
  id text PRIMARY KEY NOT NULL,
  content_id text NOT NULL,
  viewed_at text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_content_views_time ON content_views (viewed_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_content_views_content ON content_views (content_id);
