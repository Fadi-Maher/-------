CREATE TABLE `request_updates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`message` text NOT NULL,
	`status` enum('received','in_review','in_progress','completed'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `request_updates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `request_updates` ADD CONSTRAINT `request_updates_requestId_transaction_requests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `transaction_requests`(`id`) ON DELETE cascade ON UPDATE no action;