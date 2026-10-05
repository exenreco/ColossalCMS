CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`storage_key` text NOT NULL,
	`alt_text` text DEFAULT '' NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`uploaded_by` text NOT NULL,
	`uploaded_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notices` (
	`id` text PRIMARY KEY NOT NULL,
	`message` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plugin_packages` (
	`id` text PRIMARY KEY NOT NULL,
	`manifest` text NOT NULL,
	`current` text NOT NULL,
	`previous` text,
	`pending` text,
	`installed_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plugin_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`plugin_id` text NOT NULL,
	`manifest` text NOT NULL,
	`files` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`content_id` text NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` text NOT NULL,
	`author` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `content` ADD `details` text DEFAULT '{}' NOT NULL;