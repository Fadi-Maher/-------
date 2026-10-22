CREATE TABLE `order_support_attachments` (
	`id` varchar(36) NOT NULL,
	`sessionId` varchar(36) NOT NULL,
	`storageKey` text NOT NULL,
	`mimeType` varchar(30) NOT NULL,
	`byteSize` int NOT NULL,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `order_support_attachments_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_support_attachment_session` UNIQUE(`sessionId`)
);
--> statement-breakpoint
ALTER TABLE `order_support_feedback` ADD `accessKeyHash` varchar(64);--> statement-breakpoint
ALTER TABLE `order_support_feedback` ADD `followupNote` text;--> statement-breakpoint
ALTER TABLE `order_support_feedback` ADD `followupCreatedAt` bigint;--> statement-breakpoint
ALTER TABLE `order_support_attachments` ADD CONSTRAINT `order_support_attachments_sessionId_order_support_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `order_support_sessions`(`id`) ON DELETE cascade ON UPDATE no action;