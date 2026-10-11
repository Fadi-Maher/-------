CREATE TABLE `pwa_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`endpointHash` varchar(64) NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` varchar(255) NOT NULL,
	`auth` varchar(255) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pwa_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `pwa_subscriptions_endpointHash_unique` UNIQUE(`endpointHash`)
);
