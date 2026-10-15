import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";
export const messagingMessages = sqliteTable(
  "messaging_messages",
  {
    id: text("id").primaryKey(),
    senderName: text("sender_name").notNull().default(""),
    senderEmail: text("sender_email").notNull().default(""),
    subject: text("subject").notNull().default(""),
    fields: text("fields").notNull().default("[]"),
    status: text("status").notNull().default("unread"),
    notificationStatus: text("notification_status")
      .notNull()
      .default("not-configured"),
    sourcePath: text("source_path").notNull().default(""),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("idx_messaging_status").on(t.status, t.createdAt)],
);
export const messagingTokens = sqliteTable(
  "messaging_tokens",
  {
    id: text("id").primaryKey(),
    formHash: text("form_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
  },
  (t) => [index("idx_messaging_token_expiry").on(t.expiresAt)],
);
