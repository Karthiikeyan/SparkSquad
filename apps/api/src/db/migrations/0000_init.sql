CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_user_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `announcements` (
	`squad_id` text PRIMARY KEY NOT NULL,
	`body` text,
	`author_id` text,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`squad_id`) REFERENCES `squads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `badges` (
	`user_id` text NOT NULL,
	`badge` text NOT NULL,
	`earned_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`user_id`, `badge`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `blocks` (
	`blocker_id` text NOT NULL,
	`blocked_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`blocker_id`, `blocked_id`),
	FOREIGN KEY (`blocker_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`blocked_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `blocks_blocked_idx` ON `blocks` (`blocked_id`);--> statement-breakpoint
CREATE TABLE `challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`squad_id` text NOT NULL,
	`title` text NOT NULL,
	`plan_key` text NOT NULL,
	`plan_hash` text NOT NULL,
	`plan_version` integer DEFAULT 1 NOT NULL,
	`duration_days` integer NOT NULL,
	`days_per_week` integer DEFAULT 7 NOT NULL,
	`rest_days` text DEFAULT '[]' NOT NULL,
	`task_counts` text DEFAULT '[]' NOT NULL,
	`start_date` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`ended_at` text,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`squad_id`) REFERENCES `squads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `challenges_squad_idx` ON `challenges` (`squad_id`,`status`);--> statement-breakpoint
CREATE INDEX `challenges_updated_idx` ON `challenges` (`updated_at`);--> statement-breakpoint
CREATE TABLE `checkins` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge_id` text NOT NULL,
	`user_id` text NOT NULL,
	`local_date` text NOT NULL,
	`day_number` integer NOT NULL,
	`status` text NOT NULL,
	`counts_done` integer DEFAULT false NOT NULL,
	`tasks_done` integer DEFAULT 0 NOT NULL,
	`values` text DEFAULT '[]' NOT NULL,
	`note` text,
	`has_photo` integer DEFAULT false NOT NULL,
	`photo_key` text,
	`verified` text DEFAULT '[]' NOT NULL,
	`reaction_count` integer DEFAULT 0 NOT NULL,
	`comment_count` integer DEFAULT 0 NOT NULL,
	`edited` integer DEFAULT false NOT NULL,
	`hidden_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`challenge_id`) REFERENCES `challenges`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `checkins_unique_day` ON `checkins` (`challenge_id`,`user_id`,`local_date`);--> statement-breakpoint
CREATE INDEX `checkins_challenge_date_idx` ON `checkins` (`challenge_id`,`local_date`);--> statement-breakpoint
CREATE INDEX `checkins_user_updated_idx` ON `checkins` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `checkins_challenge_updated_idx` ON `checkins` (`challenge_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`checkin_id` text NOT NULL,
	`user_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`expires_at` text NOT NULL,
	`hidden_at` text,
	FOREIGN KEY (`checkin_id`) REFERENCES `checkins`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `comments_checkin_idx` ON `comments` (`checkin_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `comments_user_idx` ON `comments` (`user_id`);--> statement-breakpoint
CREATE INDEX `comments_expires_idx` ON `comments` (`expires_at`);--> statement-breakpoint
CREATE TABLE `entitlements` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product` text NOT NULL,
	`squad_id` text,
	`status` text NOT NULL,
	`expires_at` text,
	`rc_event_id` text NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entitlements_rc_event_id_unique` ON `entitlements` (`rc_event_id`);--> statement-breakpoint
CREATE INDEX `entitlements_user_idx` ON `entitlements` (`user_id`);--> statement-breakpoint
CREATE TABLE `integrations` (
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`handle` text NOT NULL,
	PRIMARY KEY(`user_id`, `provider`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `member_summary` (
	`challenge_id` text NOT NULL,
	`user_id` text NOT NULL,
	`days_done` integer NOT NULL,
	`days_elapsed` integer NOT NULL,
	`tasks_done` integer NOT NULL,
	`best_streak` integer NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`challenge_id`, `user_id`),
	FOREIGN KEY (`challenge_id`) REFERENCES `challenges`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`read_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_user_updated_idx` ON `notifications` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `notifications_created_idx` ON `notifications` (`created_at`);--> statement-breakpoint
CREATE TABLE `nudges` (
	`challenge_id` text NOT NULL,
	`from_user_id` text NOT NULL,
	`to_user_id` text NOT NULL,
	`local_date` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`challenge_id`, `from_user_id`, `to_user_id`, `local_date`),
	FOREIGN KEY (`challenge_id`) REFERENCES `challenges`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `nudges_to_idx` ON `nudges` (`to_user_id`);--> statement-breakpoint
CREATE INDEX `nudges_created_idx` ON `nudges` (`challenge_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `plan_day_edits` (
	`challenge_id` text NOT NULL,
	`day_number` integer NOT NULL,
	`day_json` text NOT NULL,
	`edited_by` text NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`challenge_id`, `day_number`),
	FOREIGN KEY (`challenge_id`) REFERENCES `challenges`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `push_tokens` (
	`token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`platform` text NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `push_tokens_user_idx` ON `push_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `reactions` (
	`checkin_id` text NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`checkin_id`, `user_id`, `kind`),
	FOREIGN KEY (`checkin_id`) REFERENCES `checkins`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reactions_user_idx` ON `reactions` (`user_id`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`reason` text NOT NULL,
	`details` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`reporter_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reports_status_idx` ON `reports` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `squad_members` (
	`squad_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text NOT NULL,
	`joined_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`muted_at` text,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`squad_id`, `user_id`),
	FOREIGN KEY (`squad_id`) REFERENCES `squads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `squad_members_user_idx` ON `squad_members` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `squad_members_updated_idx` ON `squad_members` (`squad_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `squads` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`rules` text DEFAULT '' NOT NULL,
	`category` text NOT NULL,
	`privacy` text NOT NULL,
	`owner_id` text NOT NULL,
	`invite_code` text NOT NULL,
	`chat_url` text,
	`member_limit` integer DEFAULT 100 NOT NULL,
	`member_count` integer DEFAULT 0 NOT NULL,
	`is_pro` integer DEFAULT false NOT NULL,
	`pro_expires_at` text,
	`allow_personal_targets` integer DEFAULT true NOT NULL,
	`partial_counts` integer DEFAULT true NOT NULL,
	`hidden_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `squads_invite_code_unique` ON `squads` (`invite_code`);--> statement-breakpoint
CREATE INDEX `squads_owner_idx` ON `squads` (`owner_id`);--> statement-breakpoint
CREATE INDEX `squads_discover_idx` ON `squads` (`privacy`,`category`);--> statement-breakpoint
CREATE INDEX `squads_updated_idx` ON `squads` (`updated_at`);--> statement-breakpoint
CREATE TABLE `streaks` (
	`user_id` text NOT NULL,
	`scope` text NOT NULL,
	`current` integer DEFAULT 0 NOT NULL,
	`best` integer DEFAULT 0 NOT NULL,
	`freezes` integer DEFAULT 0 NOT NULL,
	`last_done_date` text,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`user_id`, `scope`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `streaks_updated_idx` ON `streaks` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `templates` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`duration_days` integer NOT NULL,
	`tasks_per_day` integer NOT NULL,
	`plan_key` text NOT NULL,
	`published` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `templates_slug_unique` ON `templates` (`slug`);--> statement-breakpoint
CREATE TABLE `usage_counters` (
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`kind` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `day`, `kind`)
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`username` text,
	`display_name` text,
	`avatar_color` integer DEFAULT 0 NOT NULL,
	`timezone` text DEFAULT 'Asia/Kolkata' NOT NULL,
	`interests` text DEFAULT '[]' NOT NULL,
	`reminder_time` text DEFAULT '20:00' NOT NULL,
	`notify_missed_day` integer DEFAULT true NOT NULL,
	`notify_squad_updates` integer DEFAULT true NOT NULL,
	`notify_nudges` integer DEFAULT true NOT NULL,
	`age_confirmed_at` text,
	`terms_accepted_at` text,
	`plan` text DEFAULT 'free' NOT NULL,
	`plan_expires_at` text,
	`plus_interest_at` text,
	`suspended_at` text,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);--> statement-breakpoint
CREATE INDEX `user_timezone_idx` ON `user` (`timezone`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);