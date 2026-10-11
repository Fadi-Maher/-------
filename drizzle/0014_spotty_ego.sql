ALTER TABLE `staff_accounts` ADD `phone` varchar(40);--> statement-breakpoint
ALTER TABLE `staff_accounts` ADD CONSTRAINT `staff_accounts_phone_unique` UNIQUE(`phone`);