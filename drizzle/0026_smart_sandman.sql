CREATE TABLE `order_support_feedback` (
	`id` varchar(36) NOT NULL,
	`sessionId` varchar(36),
	`stars` int NOT NULL,
	`comment` text,
	`language` enum('ar','en') NOT NULL,
	`consentVersion` varchar(20) NOT NULL,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `order_support_feedback_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_support_feedback_one_session` UNIQUE(`sessionId`)
);
--> statement-breakpoint
ALTER TABLE `order_support_feedback` ADD CONSTRAINT `order_support_feedback_sessionId_order_support_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `order_support_sessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `order_support_feedback_created` ON `order_support_feedback` (`createdAt`);