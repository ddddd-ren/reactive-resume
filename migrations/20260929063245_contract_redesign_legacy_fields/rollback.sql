-- Restores the columns the contract step dropped, for older app versions. Closed applications without a reason
-- were archived ones; version labels come back from their kind.
ALTER TABLE "application" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;
UPDATE "application" SET "archived" = true WHERE "status" = 'closed' AND "closed_reason" IS NULL;
ALTER TABLE "resume_version" ADD COLUMN "label" text DEFAULT '' NOT NULL;
UPDATE "resume_version" SET "label" = CASE "kind"
	WHEN 'created' THEN 'Created'
	WHEN 'import' THEN 'Imported'
	WHEN 'auto' THEN 'Manual save'
	WHEN 'before-restore' THEN 'Before restore'
	WHEN 'restored' THEN 'Restored version'
	WHEN 'ai' THEN 'AI edit'
	WHEN 'sent' THEN 'Sent'
	ELSE coalesce("name", '')
END;
