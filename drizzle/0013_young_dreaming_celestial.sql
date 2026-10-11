ALTER TABLE `request_updates` ADD `senderType` enum('owner','customer','employee','agent','system') DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE `request_updates` ADD `senderUserId` int;--> statement-breakpoint
ALTER TABLE `request_updates` ADD `senderName` varchar(160);--> statement-breakpoint
ALTER TABLE `request_updates` ADD CONSTRAINT `request_updates_senderUserId_users_id_fk` FOREIGN KEY (`senderUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;