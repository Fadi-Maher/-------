CREATE TABLE `assistant_conversation_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assistant_conversation_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `assistant_conversation_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(64) NOT NULL,
	`language` enum('ar','en') NOT NULL,
	`consentVersion` varchar(32) NOT NULL,
	`consentedAt` timestamp NOT NULL DEFAULT (now()),
	`consentRevokedAt` timestamp,
	`lastMessageAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assistant_conversation_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `assistant_conversation_sessions_publicId_unique` UNIQUE(`publicId`)
);
--> statement-breakpoint
CREATE TABLE `assistant_faqs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`questionAr` varchar(500) NOT NULL,
	`answerAr` text NOT NULL,
	`questionEn` varchar(500),
	`answerEn` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assistant_faqs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `assistant_conversation_messages` ADD CONSTRAINT `assistant_messages_session_fk` FOREIGN KEY (`sessionId`) REFERENCES `assistant_conversation_sessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assistant_faqs` ADD CONSTRAINT `assistant_faqs_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `assistant_messages_session_created_idx` ON `assistant_conversation_messages` (`sessionId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `assistant_sessions_consent_idx` ON `assistant_conversation_sessions` (`consentRevokedAt`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `assistant_faqs_active_sort_idx` ON `assistant_faqs` (`isActive`,`sortOrder`);
