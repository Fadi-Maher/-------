CREATE TABLE `customer_phone_releases` (
	`phone` varchar(40) NOT NULL,
	`customerId` int,
	`releasedAt` bigint NOT NULL,
	CONSTRAINT `customer_phone_releases_phone` PRIMARY KEY(`phone`)
);
--> statement-breakpoint
ALTER TABLE `customer_phone_releases` ADD CONSTRAINT `customer_phone_releases_customerId_customers_id_fk` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE set null ON UPDATE no action;