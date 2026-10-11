CREATE TABLE `request_quotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`providerUserId` int NOT NULL,
	`providerRole` enum('employee','agent') NOT NULL,
	`providerName` varchar(160) NOT NULL,
	`priceAmount` decimal(10,2) NOT NULL,
	`durationDays` int NOT NULL,
	`note` varchar(600),
	`status` enum('submitted','accepted','declined','withdrawn') NOT NULL DEFAULT 'submitted',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `request_quotes_id` PRIMARY KEY(`id`),
	CONSTRAINT `request_quotes_request_provider_unique` UNIQUE(`requestId`,`providerUserId`)
);
--> statement-breakpoint
ALTER TABLE `transaction_requests` ADD `quoteSelectedAt` timestamp;--> statement-breakpoint
ALTER TABLE `request_quotes` ADD CONSTRAINT `request_quotes_requestId_transaction_requests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `transaction_requests`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `request_quotes` ADD CONSTRAINT `request_quotes_providerUserId_users_id_fk` FOREIGN KEY (`providerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `request_quotes_request_status_idx` ON `request_quotes` (`requestId`,`status`);--> statement-breakpoint
CREATE INDEX `request_quotes_provider_idx` ON `request_quotes` (`providerUserId`);