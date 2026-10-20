CREATE TABLE `lead_bot_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(64) NOT NULL,
	`lang` enum('ar','en') NOT NULL DEFAULT 'ar',
	`stateJson` text NOT NULL,
	`handoffJson` text,
	`pagePath` varchar(200),
	`ipHash` varchar(64),
	`storageConsentAt` bigint NOT NULL,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	`lastMessageAt` bigint NOT NULL,
	CONSTRAINT `lead_bot_conversations_id` PRIMARY KEY(`id`),
	CONSTRAINT `lead_bot_conversations_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `lead_bot_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`type` varchar(40) NOT NULL,
	`intent` varchar(40),
	`slot` varchar(40),
	`detail` varchar(120),
	`createdAt` bigint NOT NULL,
	CONSTRAINT `lead_bot_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lead_bot_leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`kind` enum('sales','partner') NOT NULL DEFAULT 'sales',
	`status` enum('new','contacted','qualified','won','lost') NOT NULL DEFAULT 'new',
	`slotsJson` text NOT NULL,
	`score` int NOT NULL DEFAULT 0,
	`grade` enum('hot','warm','cold') NOT NULL DEFAULT 'cold',
	`scoreJson` text NOT NULL,
	`qualified` boolean NOT NULL DEFAULT false,
	`handoffStatus` enum('none','waiting','active','resolved') NOT NULL DEFAULT 'none',
	`handoffJson` text,
	`service` varchar(40),
	`name` varchar(160),
	`phoneKey` varchar(20),
	`assignedTo` varchar(160),
	`notes` text,
	`unreadForStaff` int NOT NULL DEFAULT 0,
	`hotNotifiedAt` bigint,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	`lastMessageAt` bigint NOT NULL,
	CONSTRAINT `lead_bot_leads_id` PRIMARY KEY(`id`),
	CONSTRAINT `lead_bot_leads_conversation_unique` UNIQUE(`conversationId`)
);
--> statement-breakpoint
CREATE TABLE `lead_bot_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`role` enum('user','bot','agent','system') NOT NULL,
	`text` text NOT NULL,
	`replyJson` text,
	`clientId` varchar(64),
	`authorName` varchar(160),
	`createdAt` bigint NOT NULL,
	CONSTRAINT `lead_bot_messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `lead_bot_messages_client_unique` UNIQUE(`conversationId`,`clientId`)
);
--> statement-breakpoint
CREATE TABLE `lead_bot_settings` (
	`id` int NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`aiAssist` boolean NOT NULL DEFAULT false,
	`autoEscalateAfterFallbacks` int NOT NULL DEFAULT 2,
	`offerHumanToHotLeads` boolean NOT NULL DEFAULT true,
	`workingDaysJson` varchar(40) NOT NULL DEFAULT '[0,1,2,3,4]',
	`workStartHour` int NOT NULL DEFAULT 9,
	`workEndHour` int NOT NULL DEFAULT 18,
	`responseSlaAr` varchar(80) NOT NULL,
	`responseSlaEn` varchar(80) NOT NULL,
	`whatsappNumber` varchar(16) NOT NULL DEFAULT '',
	`servicesJson` varchar(400) NOT NULL DEFAULT '[]',
	`updatedAt` bigint NOT NULL,
	`updatedByName` varchar(160),
	CONSTRAINT `lead_bot_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `lead_bot_events` ADD CONSTRAINT `lead_bot_events_conversationId_lead_bot_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `lead_bot_conversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lead_bot_leads` ADD CONSTRAINT `lead_bot_leads_conversationId_lead_bot_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `lead_bot_conversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lead_bot_messages` ADD CONSTRAINT `lead_bot_messages_conversationId_lead_bot_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `lead_bot_conversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `lead_bot_conversations_created_idx` ON `lead_bot_conversations` (`createdAt`);--> statement-breakpoint
CREATE INDEX `lead_bot_conversations_ip_idx` ON `lead_bot_conversations` (`ipHash`,`createdAt`);--> statement-breakpoint
CREATE INDEX `lead_bot_events_created_idx` ON `lead_bot_events` (`createdAt`);--> statement-breakpoint
CREATE INDEX `lead_bot_events_conversation_idx` ON `lead_bot_events` (`conversationId`);--> statement-breakpoint
CREATE INDEX `lead_bot_leads_phone_idx` ON `lead_bot_leads` (`phoneKey`);--> statement-breakpoint
CREATE INDEX `lead_bot_leads_activity_idx` ON `lead_bot_leads` (`lastMessageAt`);--> statement-breakpoint
CREATE INDEX `lead_bot_messages_conversation_idx` ON `lead_bot_messages` (`conversationId`,`createdAt`);