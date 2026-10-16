CREATE INDEX IF NOT EXISTS idx_content_published_date ON content (status, publish_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_themes_active ON themes (active);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_theme_history_theme_date ON theme_history (theme_id, created_at);
