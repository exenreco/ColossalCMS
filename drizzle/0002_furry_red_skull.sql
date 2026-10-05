CREATE TABLE `theme_history` (
	`id` text PRIMARY KEY NOT NULL,
	`theme_id` text NOT NULL,
	`version` text NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `themes` (
	`id` text PRIMARY KEY NOT NULL,
	`manifest` text NOT NULL,
	`published` text NOT NULL,
	`draft` text,
	`active` integer DEFAULT 0 NOT NULL,
	`is_core` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `content` ADD `template_id` text DEFAULT '' NOT NULL;