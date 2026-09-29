-- Puts letters back into their resumes, for app versions that still show cover letters inside a resume. Run it by
-- hand before downgrading. Only letters saved from a resume's own section come back (their style names that
-- section); library letters stay in the library, where older versions list them too. Each letter returns as a
-- cover-letter section at the end of its resume's first page (one section per resume per run: run it again for a
-- resume that had several). The letters themselves are kept.
WITH returning_letters AS (
	SELECT
		c."source_resume_id" AS resume_id,
		c."style"->>'sectionId' AS section_id,
		jsonb_agg(
			jsonb_build_object(
				'id', c."style"->>'itemId',
				'hidden', false,
				'recipient', c."recipient",
				'content', c."content"
			)
			ORDER BY c."created_at"
		) AS items
	FROM "cover_letter" c
	WHERE c."source_resume_id" IS NOT NULL
		AND c."trashed_at" IS NULL
		AND c."style"->>'sectionId' IS NOT NULL
		AND c."style"->>'sectionId' <> 'library-cover-letter'
	GROUP BY c."source_resume_id", c."style"->>'sectionId'
)
UPDATE "resume" r
SET "data" = jsonb_set(
	jsonb_set(
		r.data,
		'{customSections}',
		coalesce(r.data->'customSections', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
			'id', l.section_id,
			'type', 'cover-letter',
			'title', '',
			'icon', 'envelope-simple',
			'columns', 1,
			'hidden', false,
			'keepTogether', false,
			'startOnNewPage', false,
			'items', l.items
		))
	),
	'{metadata,layout,pages,0,main}',
	coalesce(r.data#>'{metadata,layout,pages,0,main}', '[]'::jsonb) || to_jsonb(l.section_id)
)
FROM returning_letters l
WHERE r.id = l.resume_id
	AND jsonb_typeof(r.data#>'{metadata,layout,pages,0}') = 'object'
	AND NOT (coalesce(r.data->'customSections', '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('id', l.section_id)));
