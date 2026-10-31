ALTER TABLE `user` ADD `notify_comments` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `notify_members` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `notify_milestones` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `notify_streak_risk` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `notify_challenge_start` integer DEFAULT true NOT NULL;