CREATE TABLE `team_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipientUserId` int NOT NULL,
	`requestId` int,
	`type` varchar(64) NOT NULL,
	`title` varchar(180) NOT NULL,
	`message` varchar(500) NOT NULL,
	`isRead` boolean NOT NULL DEFAULT false,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `team_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `team_notifications` ADD CONSTRAINT `team_notifications_recipientUserId_users_id_fk` FOREIGN KEY (`recipientUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_notifications` ADD CONSTRAINT `team_notifications_requestId_transaction_requests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `transaction_requests`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `team_notifications_recipient_created_idx` ON `team_notifications` (`recipientUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `team_notifications_recipient_unread_idx` ON `team_notifications` (`recipientUserId`,`isRead`);