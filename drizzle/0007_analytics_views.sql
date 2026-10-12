CREATE TABLE IF NOT EXISTS analytics_views (
  id text PRIMARY KEY NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  viewed_at text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_analytics_views_target ON analytics_views (target_type, viewed_at, target_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_analytics_views_time ON analytics_views (viewed_at);
