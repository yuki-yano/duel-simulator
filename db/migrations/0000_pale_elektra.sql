CREATE TABLE `deck_images` (
	`hash` text PRIMARY KEY NOT NULL,
	`aspect_ratio_type` text NOT NULL,
	`main_deck_count` integer NOT NULL,
	`extra_deck_count` integer NOT NULL,
	`source_width` integer NOT NULL,
	`source_height` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_deck_images_created_at` ON `deck_images` (`created_at`);--> statement-breakpoint
CREATE TABLE `saved_states` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`state_json` text NOT NULL,
	`deck_image_hash` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`type` text NOT NULL,
	`version` text NOT NULL,
	`deck_config` text NOT NULL,
	`deck_card_ids` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`deck_image_hash`) REFERENCES `deck_images`(`hash`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_saved_states_session_id` ON `saved_states` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_saved_states_created_at` ON `saved_states` (`created_at`);