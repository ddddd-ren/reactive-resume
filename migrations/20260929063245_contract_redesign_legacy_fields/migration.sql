-- Contract steps for the redesign (§3.10): the closed stage replaced `archived` and `rejected`, and versions are
-- labelled by `kind`. Older app versions stop working against this schema. rollback.sql restores the columns.
-- Anything still marked archived or rejected closes first, so no application reopens when the flag goes.
UPDATE "application" SET "status" = 'closed', "closed_reason" = 'not-selected' WHERE "status" = 'rejected';--> statement-breakpoint
UPDATE "application" SET "status" = 'closed' WHERE "archived" = true AND "status" <> 'closed';--> statement-breakpoint
UPDATE "application" SET "activity" = (
	SELECT jsonb_agg(
		CASE WHEN entry->>'type' = 'stage' AND entry->>'stage' = 'rejected'
			THEN jsonb_set(entry, '{stage}', '"closed"')
			ELSE entry
		END
		ORDER BY position
	)
	FROM jsonb_array_elements("activity") WITH ORDINALITY AS items(entry, position)
)
WHERE "activity" @> '[{"type": "stage", "stage": "rejected"}]';--> statement-breakpoint
ALTER TABLE "application" DROP COLUMN "archived";--> statement-breakpoint
ALTER TABLE "resume_version" DROP COLUMN "label";
