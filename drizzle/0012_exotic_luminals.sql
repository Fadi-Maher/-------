CREATE TABLE `customer_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phone` varchar(40) NOT NULL,
	`requestId` int NOT NULL,
	`type` varchar(64) NOT NULL,
	`title` varchar(180) NOT NULL,
	`message` varchar(500) NOT NULL,
	`isRead` boolean NOT NULL DEFAULT false,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `request_quotes` MODIFY COLUMN `status` enum('submitted','selected','accepted','declined','withdrawn') NOT NULL DEFAULT 'submitted';--> statement-breakpoint
ALTER TABLE `transaction_requests` ADD `quoteSubmissionDeadline` timestamp;--> statement-breakpoint
ALTER TABLE `transaction_requests` ADD `providerAcceptanceDeadline` timestamp;--> statement-breakpoint
ALTER TABLE `transaction_requests` ADD `providerAcceptedAt` timestamp;--> statement-breakpoint
ALTER TABLE `customer_notifications` ADD CONSTRAINT `customer_notifications_requestId_transaction_requests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `transaction_requests`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `customer_notifications_phone_created_idx` ON `customer_notifications` (`phone`,`createdAt`);--> statement-breakpoint
CREATE INDEX `customer_notifications_phone_unread_idx` ON `customer_notifications` (`phone`,`isRead`);