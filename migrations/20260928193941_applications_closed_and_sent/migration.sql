ALTER TABLE "application" ADD COLUMN "closed_reason" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "cover_letter_id" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "sent_resume_version_id" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "sent_check_score" smallint;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "requirements" jsonb DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_cover_letter_id_cover_letter_id_fkey" FOREIGN KEY ("cover_letter_id") REFERENCES "cover_letter"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_sent_resume_version_id_resume_version_id_fkey" FOREIGN KEY ("sent_resume_version_id") REFERENCES "resume_version"("id") ON DELETE SET NULL;--> statement-breakpoint
-- The closed stage replaces `rejected` (closed, not selected) and the `archived` flag (closed, no reason).
-- `archived` keeps its value so older app versions still hide these rows. rollback.sql reverses this.
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
-- A letter written for exactly one application becomes that application's letter.
UPDATE "application" SET "cover_letter_id" = letters."id"
FROM (
	SELECT "source_application_id", min("id") AS "id"
	FROM "cover_letter"
	WHERE "source_application_id" IS NOT NULL
	GROUP BY "source_application_id"
	HAVING count(*) = 1
) AS letters
WHERE "application"."id" = letters."source_application_id" AND "application"."cover_letter_id" IS NULL;
