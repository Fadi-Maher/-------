CREATE TABLE `app_settings` (
	`id` int NOT NULL,
	`whatsappNumber` varchar(32),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `custom_form_fields` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fieldKey` varchar(64) NOT NULL,
	`label` varchar(120) NOT NULL,
	`type` enum('text','textarea','tel','email','select') NOT NULL DEFAULT 'text',
	`placeholder` varchar(255),
	`optionsJson` text,
	`isRequired` boolean NOT NULL DEFAULT false,
	`isVisible` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `custom_form_fields_id` PRIMARY KEY(`id`),
	CONSTRAINT `custom_form_fields_fieldKey_unique` UNIQUE(`fieldKey`)
);
--> statement-breakpoint
ALTER TABLE `transaction_requests` ADD `customFields` text;