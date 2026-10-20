CREATE TABLE `agent_applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phone` varchar(40) NOT NULL,
	`fullName` varchar(160) NOT NULL,
	`email` varchar(320) NOT NULL,
	`city` varchar(120) NOT NULL,
	`specialty` varchar(160) NOT NULL,
	`experienceYears` int NOT NULL,
	`notes` varchar(1000),
	`consentedAt` bigint NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`createdAt` bigint NOT NULL,
	`reviewedAt` bigint,
	`reviewedByUserId` int,
	`reviewNote` varchar(500),
	`activatedStaffAccountId` int,
	CONSTRAINT `agent_applications_id` PRIMARY KEY(`id`),
	CONSTRAINT `agent_applications_phone_unique` UNIQUE(`phone`)
);
--> statement-breakpoint
CREATE TABLE `phone_otp_challenges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`challengeId` varchar(36) NOT NULL,
	`phone` varchar(40) NOT NULL,
	`codeHash` varchar(64) NOT NULL,
	`expiresAt` bigint NOT NULL,
	`resendAvailableAt` bigint NOT NULL,
	`attemptCount` int NOT NULL DEFAULT 0,
	`sendCount` int NOT NULL DEFAULT 1,
	`windowStartedAt` bigint NOT NULL,
	`verifiedAt` bigint,
	`verifiedClientKey` varchar(36),
	CONSTRAINT `phone_otp_challenges_id` PRIMARY KEY(`id`),
	CONSTRAINT `phone_otp_phone_unique` UNIQUE(`phone`),
	CONSTRAINT `phone_otp_challenge_unique` UNIQUE(`challengeId`)
);
--> statement-breakpoint
ALTER TABLE `agent_applications` ADD CONSTRAINT `agent_applications_reviewedByUserId_users_id_fk` FOREIGN KEY (`reviewedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_applications` ADD CONSTRAINT `agent_applications_activatedStaffAccountId_staff_accounts_id_fk` FOREIGN KEY (`activatedStaffAccountId`) REFERENCES `staff_accounts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `agent_applications_status_created_idx` ON `agent_applications` (`status`,`createdAt`);