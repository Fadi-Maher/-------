CREATE TABLE `agent_finance_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentUserId` int NOT NULL,
	`requestId` int NOT NULL,
	`kind` enum('collection','cost') NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`occurredAt` bigint NOT NULL,
	`createdAt` bigint NOT NULL,
	`clientKey` varchar(36) NOT NULL,
	`note` varchar(500),
	`voidedAt` bigint,
	`voidReason` varchar(500),
	CONSTRAINT `agent_finance_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `agent_finance_client_unique` UNIQUE(`agentUserId`,`clientKey`)
);
--> statement-breakpoint
ALTER TABLE `agent_finance_entries` ADD CONSTRAINT `agent_finance_entries_agentUserId_users_id_fk` FOREIGN KEY (`agentUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_finance_entries` ADD CONSTRAINT `agent_finance_entries_requestId_transaction_requests_id_fk` FOREIGN KEY (`requestId`) REFERENCES `transaction_requests`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `agent_finance_created_idx` ON `agent_finance_entries` (`agentUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `agent_finance_request_idx` ON `agent_finance_entries` (`agentUserId`,`requestId`);