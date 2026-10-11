CREATE TABLE `request_attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`updateId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` text NOT NULL,
	`mimeType` varchar(160) NOT NULL,
	`size` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `request_attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `request_attachments` ADD CONSTRAINT `request_attachments_updateId_request_updates_id_fk` FOREIGN KEY (`updateId`) REFERENCES `request_updates`(`id`) ON DELETE cascade ON UPDATE no action;