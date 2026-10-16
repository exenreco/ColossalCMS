import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";
export const responseCache = sqliteTable(
  "response_cache",
  {
    id: text("id").primaryKey(),
    cacheKey: text("cache_key").notNull(),
    generation: text("generation").notNull(),
    payload: text("payload").notNull(),
    expiresAt: text("expires_at").notNull(),
  },
  (table) => [index("idx_response_cache_expires").on(table.expiresAt)],
);
