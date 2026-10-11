CREATE TABLE `request_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`customerId` int,
	`providerUserId` int,
	`providerName` varchar(160) NOT NULL,
	`providerRole` enum('employee','agent') NOT NULL,
	`rating` int NOT NULL,
	`reviewText` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `request_reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `request_reviews_request_unique` UNIQUE(`requestId`)
);
--> statement-breakpoint
ALTER TABLE `request_reviews` ADD CONSTRAINT `request_reviews_requestId_transaction_requests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `transaction_requests`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `request_reviews` ADD CONSTRAINT `request_reviews_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `request_reviews` ADD CONSTRAINT `request_reviews_providerUserId_users_id_fk` FOREIGN KEY (`providerUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `request_reviews_provider_created_idx` ON `request_reviews` (`providerUserId`,`createdAt`);