CREATE TABLE `order_support_config` (
	`id` int NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`handoffEnabled` boolean NOT NULL DEFAULT true,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `order_support_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_support_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kind` enum('answer','handoff','helpful','unhelpful') NOT NULL,
	`intent` varchar(40) NOT NULL,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `order_support_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_support_messages` (
	`id` varchar(36) NOT NULL,
	`sessionId` varchar(36) NOT NULL,
	`turnId` varchar(36) NOT NULL,
	`sender` enum('user','bot','human','system') NOT NULL,
	`content` text NOT NULL,
	`metadata` text,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `order_support_messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_support_msg_turn_unique` UNIQUE(`sessionId`,`turnId`,`sender`)
);
--> statement-breakpoint
CREATE TABLE `order_support_rate_limits` (
	`keyHash` varchar(64) NOT NULL,
	`windowStartedAt` bigint NOT NULL,
	`requestCount` int NOT NULL,
	CONSTRAINT `order_support_rate_limits_keyHash` PRIMARY KEY(`keyHash`)
);
--> statement-breakpoint
CREATE TABLE `order_support_sessions` (
	`id` varchar(36) NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`language` enum('ar','en') NOT NULL,
	`status` enum('bot','waiting','human','closed') NOT NULL DEFAULT 'bot',
	`intent` varchar(40) NOT NULL DEFAULT 'greeting',
	`rating` enum('helpful','unhelpful'),
	`consentVersion` varchar(20) NOT NULL,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `order_support_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_support_sessions_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
ALTER TABLE `order_support_messages` ADD CONSTRAINT `order_support_messages_sessionId_order_support_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `order_support_sessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `order_support_events_created` ON `order_support_events` (`createdAt`);--> statement-breakpoint
CREATE INDEX `order_support_msg_session_created` ON `order_support_messages` (`sessionId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `order_support_status_updated` ON `order_support_sessions` (`status`,`updatedAt`);