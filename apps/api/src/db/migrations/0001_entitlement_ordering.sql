ALTER TABLE `entitlements` ADD `entitlement_ids` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `entitlements` ADD `subscription_key` text;--> statement-breakpoint
ALTER TABLE `entitlements` ADD `event_at` text;--> statement-breakpoint
CREATE INDEX `entitlements_sub_idx` ON `entitlements` (`subscription_key`);--> statement-breakpoint
CREATE INDEX `entitlements_squad_idx` ON `entitlements` (`squad_id`);