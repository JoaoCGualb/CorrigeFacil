ALTER TABLE `records` ADD `identity` text;--> statement-breakpoint
CREATE UNIQUE INDEX `records_submission_identity` ON `records` (`owner`,`identity`);