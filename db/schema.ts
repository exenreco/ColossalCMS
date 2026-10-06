import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const content = sqliteTable(
  "content",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    excerpt: text("excerpt").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull(),
    publishAt: text("publish_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    author: text("author").notNull(),
    details: text("details").notNull().default("{}"),
    templateId: text("template_id").notNull().default(""),
  },
  (t) => [uniqueIndex("idx_content_slug").on(t.slug)],
);
export const config = sqliteTable("config", {
  id: text("id").primaryKey(),
  value: text("value").notNull(),
});
export const authCredentials = sqliteTable("auth_credentials", {
  id: text("id").primaryKey(),
  passwordHash: text("password_hash").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const authSessions = sqliteTable("auth_sessions", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull(),
  expiresAt: text("expires_at").notNull(),
});
export const plugins = sqliteTable("plugins", {
  id: text("id").primaryKey(),
  active: integer("active").notNull(),
  installed: integer("installed").notNull(),
});
export const members = sqliteTable(
  "members",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    role: text("role").notNull(),
  },
  (t) => [uniqueIndex("idx_members_email").on(t.email)],
);
export const activity = sqliteTable("activity", {
  id: text("id").primaryKey(),
  message: text("message").notNull(),
  createdAt: text("created_at").notNull(),
});
export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  hash: text("hash").notNull(),
  createdAt: text("created_at").notNull(),
});
export const media = sqliteTable("media", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  mime: text("mime").notNull(),
  storageKey: text("storage_key").notNull(),
  altText: text("alt_text").notNull().default(""),
  caption: text("caption").notNull().default(""),
  description: text("description").notNull().default(""),
  tags: text("tags").notNull().default("[]"),
  metadata: text("metadata").notNull().default("{}"),
  uploadedBy: text("uploaded_by").notNull(),
  uploadedAt: text("uploaded_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const revisions = sqliteTable("revisions", {
  id: text("id").primaryKey(),
  contentId: text("content_id").notNull(),
  snapshot: text("snapshot").notNull(),
  createdAt: text("created_at").notNull(),
  author: text("author").notNull(),
});
export const pluginPackages = sqliteTable("plugin_packages", {
  id: text("id").primaryKey(),
  manifest: text("manifest").notNull(),
  current: text("current").notNull(),
  previous: text("previous"),
  pending: text("pending"),
  installedAt: text("installed_at").notNull(),
});
export const pluginVersions = sqliteTable("plugin_versions", {
  id: text("id").primaryKey(),
  pluginId: text("plugin_id").notNull(),
  manifest: text("manifest").notNull(),
  files: text("files").notNull(),
  createdAt: text("created_at").notNull(),
});
export const notices = sqliteTable("notices", {
  id: text("id").primaryKey(),
  message: text("message").notNull(),
  createdAt: text("created_at").notNull(),
});

export const themes = sqliteTable("themes", {
  id: text("id").primaryKey(),
  manifest: text("manifest").notNull(),
  published: text("published").notNull(),
  draft: text("draft"),
  active: integer("active").notNull().default(0),
  isCore: integer("is_core").notNull().default(0),
  revision: integer("revision").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
});
export const themeHistory = sqliteTable("theme_history", {
  id: text("id").primaryKey(),
  themeId: text("theme_id").notNull(),
  version: text("version").notNull(),
  snapshot: text("snapshot").notNull(),
  createdAt: text("created_at").notNull(),
});

export const loginIpWindows = sqliteTable("login_ip_windows", {
  id: text("id").primaryKey(),
  ip: text("ip").notNull(),
  attempts: integer("attempts").notNull().default(0),
  failures: integer("failures").notNull().default(0),
  successes: integer("successes").notNull().default(0),
  firstAt: text("first_at").notNull(),
  lastAt: text("last_at").notNull(),
});
export const loginIpBlocks = sqliteTable("login_ip_blocks", {
  id: text("id").primaryKey(),
  ip: text("ip").notNull(),
  source: text("source").notNull(),
  reason: text("reason").notNull().default(""),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull().default(""),
});
export const loginEvents = sqliteTable("login_events", {
  id: text("id").primaryKey(),
  ip: text("ip").notNull(),
  email: text("email").notNull().default(""),
  outcome: text("outcome").notNull(),
  createdAt: text("created_at").notNull(),
});
