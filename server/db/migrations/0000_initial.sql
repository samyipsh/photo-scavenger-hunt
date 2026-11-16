CREATE TABLE `blocked_devices` (
	`device_id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`blocked_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`flavour` text,
	`hint` text,
	`points` integer NOT NULL,
	`who_in_shot` text,
	`award_kind` text,
	`animal` text,
	`sort` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`number` integer NOT NULL,
	`name` text NOT NULL,
	`leader` text,
	`token` text NOT NULL,
	`start_slot` integer NOT NULL,
	`hidden` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `groups_number_unique` ON `groups` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `groups_token_unique` ON `groups` (`token`);--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`ip` text PRIMARY KEY NOT NULL,
	`failures` integer NOT NULL,
	`window_start` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `photo_likes` (
	`photo_id` text NOT NULL,
	`device_id` text NOT NULL,
	`liked_at` integer NOT NULL,
	PRIMARY KEY(`photo_id`, `device_id`)
);
--> statement-breakpoint
CREATE INDEX `photo_likes_device` ON `photo_likes` (`device_id`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`challenge_id` text,
	`label` text,
	`thumb_key` text NOT NULL,
	`large_key` text NOT NULL,
	`bytes` integer NOT NULL,
	`width` integer,
	`height` integer,
	`verdict` text DEFAULT 'pending' NOT NULL,
	`reject_reason` text,
	`checked_at` integer,
	`removed` integer DEFAULT false NOT NULL,
	`removed_at` integer,
	`files_deleted_at` integer,
	`content_hash` text,
	`device_id` text,
	`uploader_name` text,
	`likes` integer DEFAULT 0 NOT NULL,
	`uploaded_at` integer NOT NULL,
	`lat` real,
	`lng` real
);
--> statement-breakpoint
CREATE INDEX `photos_group_uploaded` ON `photos` (`group_id`,`uploaded_at`);--> statement-breakpoint
CREATE INDEX `photos_checked_uploaded` ON `photos` (`checked_at`,`uploaded_at`);--> statement-breakpoint
CREATE INDEX `photos_challenge` ON `photos` (`challenge_id`);--> statement-breakpoint
CREATE INDEX `photos_hash` ON `photos` (`content_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `photos_active_hash` ON `photos` (`content_hash`) WHERE "photos"."removed" = 0 and "photos"."content_hash" is not null;--> statement-breakpoint
CREATE INDEX `photos_removed_uploaded` ON `photos` (`removed`,`uploaded_at`);--> statement-breakpoint
CREATE INDEX `photos_removed_likes` ON `photos` (`removed`,`likes`,`uploaded_at`);--> statement-breakpoint
CREATE INDEX `photos_device` ON `photos` (`device_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `station_scores` (
	`group_id` text NOT NULL,
	`station_id` text NOT NULL,
	`raw` real,
	`missed` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`group_id`, `station_id`)
);
--> statement-breakpoint
CREATE TABLE `stations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slot` integer NOT NULL,
	`scored` integer NOT NULL,
	`lower_wins` integer DEFAULT false NOT NULL,
	`place` text NOT NULL,
	`lat` real,
	`lng` real
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stations_slot_unique` ON `stations` (`slot`);