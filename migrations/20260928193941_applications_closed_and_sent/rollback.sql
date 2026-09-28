-- Reverses the closed stage for app versions before 6.0, which only know `rejected` and `archived`.
-- Run it by hand before downgrading; the added columns can stay, older versions ignore them.
UPDATE "application" SET "activity" = (
	SELECT jsonb_agg(
		CASE WHEN entry->>'type' = 'stage' AND entry->>'stage' = 'closed'
			THEN jsonb_set(entry, '{stage}', '"rejected"')
			ELSE entry
		END
		ORDER BY position
	)
	FROM jsonb_array_elements("activity") WITH ORDINALITY AS items(entry, position)
)
WHERE "activity" @> '[{"type": "stage", "stage": "closed"}]';

-- Closed as not selected was `rejected`.
UPDATE "application" SET "status" = 'rejected' WHERE "status" = 'closed' AND "closed_reason" = 'not-selected';

-- Any other closed application is archived at the last stage it reached before closing.
UPDATE "application" SET "archived" = true, "status" = coalesce((
	SELECT entry->>'stage'
	FROM jsonb_array_elements("activity") AS items(entry)
	WHERE entry->>'type' = 'stage' AND entry->>'stage' NOT IN ('closed', 'rejected')
	ORDER BY (entry->>'at')::timestamptz DESC
	LIMIT 1
), 'saved')
WHERE "status" = 'closed';
