CREATE INDEX `records_owner_updated` ON `records` (`owner`,`updated`);--> statement-breakpoint
-- Expression syntax corrected after generation; keep json_extract as SQL, not quoted column names.
CREATE INDEX `records_student_lookup` ON `records` (`owner`,json_extract(data, '$.studentId'),`id`) WHERE kind = 'submission';
