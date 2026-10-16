CREATE TABLE IF NOT EXISTS response_cache (
  id TEXT PRIMARY KEY NOT NULL,
  cache_key TEXT NOT NULL,
  generation TEXT NOT NULL,
  payload TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_response_cache_expires ON response_cache (expires_at);
