CREATE TABLE `admin_application_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipientUserId` int NOT NULL,
	`applicationId` int NOT NULL,
	`createdAt` bigint NOT NULL,
	`readAt` bigint,
	CONSTRAINT `admin_application_notifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_app_notice_recipient_app_unique` UNIQUE(`recipientUserId`,`applicationId`)
);
--> statement-breakpoint
CREATE TABLE `agent_application_documents` (
	`id` varchar(36) NOT NULL,
	`phone` varchar(40) NOT NULL,
	`applicationId` int,
	`kind` enum('national_id','work_license') NOT NULL,
	`fileName` varchar(160) NOT NULL,
	`mimeType` varchar(80) NOT NULL,
	`size` int NOT NULL,
	`storageKey` varchar(600) NOT NULL,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `agent_application_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `phone_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phone` varchar(40) NOT NULL,
	`role` enum('customer','agent') NOT NULL,
	`fullName` varchar(160) NOT NULL,
	`email` varchar(320) NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `phone_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `phone_profile_phone_role_unique` UNIQUE(`phone`,`role`)
);
--> statement-breakpoint
ALTER TABLE `admin_application_notifications` ADD CONSTRAINT `admin_application_notifications_recipientUserId_users_id_fk` FOREIGN KEY (`recipientUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_application_notifications` ADD CONSTRAINT `admin_app_notice_application_fk` FOREIGN KEY (`applicationId`) REFERENCES `agent_applications`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_application_documents` ADD CONSTRAINT `agent_app_document_application_fk` FOREIGN KEY (`applicationId`) REFERENCES `agent_applications`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `admin_app_notice_recipient_created_idx` ON `admin_application_notifications` (`recipientUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `agent_app_doc_phone_created_idx` ON `agent_application_documents` (`phone`,`createdAt`);--> statement-breakpoint
CREATE INDEX `agent_app_doc_application_idx` ON `agent_application_documents` (`applicationId`);