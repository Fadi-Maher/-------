ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','agent') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `transaction_requests` ADD `assigneeId` int;--> statement-breakpoint
ALTER TABLE `transaction_requests` ADD `priority` enum('low','normal','high','urgent') DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE `transaction_requests` ADD `tags` text;--> statement-breakpoint
ALTER TABLE `transaction_requests` ADD CONSTRAINT `transaction_requests_assigneeId_users_id_fk` FOREIGN KEY (`assigneeId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;