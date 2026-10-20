CREATE TABLE `notification_templates` (
	`templateKey` varchar(80) NOT NULL,
	`titleAr` varchar(180) NOT NULL,
	`messageAr` varchar(500) NOT NULL,
	`titleEn` varchar(180) NOT NULL,
	`messageEn` varchar(500) NOT NULL,
	`updatedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_templates_templateKey` PRIMARY KEY(`templateKey`)
);
--> statement-breakpoint
CREATE TABLE `site_announcements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageAr` varchar(280) NOT NULL,
	`messageEn` varchar(280) NOT NULL,
	`linkUrl` varchar(500),
	`linkLabelAr` varchar(40),
	`linkLabelEn` varchar(40),
	`tone` enum('info','success','warning') NOT NULL DEFAULT 'info',
	`isActive` boolean NOT NULL DEFAULT true,
	`dismissible` boolean NOT NULL DEFAULT true,
	`startsAt` bigint NOT NULL,
	`endsAt` bigint,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `site_announcements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `customer_notifications` ADD `titleEn` varchar(180);--> statement-breakpoint
ALTER TABLE `customer_notifications` ADD `messageEn` varchar(500);--> statement-breakpoint
ALTER TABLE `team_notifications` ADD `titleEn` varchar(180);--> statement-breakpoint
ALTER TABLE `team_notifications` ADD `messageEn` varchar(500);--> statement-breakpoint
ALTER TABLE `notification_templates` ADD CONSTRAINT `notification_templates_updatedByUserId_users_id_fk` FOREIGN KEY (`updatedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `site_announcements` ADD CONSTRAINT `site_announcements_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `site_announcements_active_idx` ON `site_announcements` (`isActive`,`startsAt`);