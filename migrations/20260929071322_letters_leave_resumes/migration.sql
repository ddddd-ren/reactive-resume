-- Letters are documents of their own. Every cover letter a resume still carries (a custom section of type
-- `cover-letter`, one letter per item, hidden ones too) becomes a saved letter linked to that resume's sender
-- details and design, as it read inside the resume. A resume that carried exactly one letter, used by exactly one
-- application without a letter, hands it to that application. Then the sections leave the resumes and their page
-- layouts.
-- Resume versions keep their history as it was; restoring one saves its letters again (once) as letters.
-- Idempotent: a letter already saved from the same item with the same text isn't saved twice. rollback.sql
-- puts the letters back into their resumes.
WITH letter_items AS (
	SELECT
		r.id AS resume_id,
		r.user_id,
		r.name AS resume_name,
		r.data,
		s.section,
		i.item,
		count(*) OVER (PARTITION BY r.id) AS letters_in_resume
	FROM "resume" r
	CROSS JOIN LATERAL jsonb_array_elements(r.data->'customSections') AS s(section)
	CROSS JOIN LATERAL jsonb_array_elements(s.section->'items') AS i(item)
	WHERE jsonb_typeof(r.data->'customSections') = 'array'
		AND s.section->>'type' = 'cover-letter'
		AND jsonb_typeof(s.section->'items') = 'array'
),
inserted AS (
	INSERT INTO "cover_letter" (
		"id", "user_id", "name", "recipient", "content", "style", "layout", "sender_linked", "design_linked", "source_resume_id",
		"source_application_id"
	)
	SELECT
		gen_random_uuid()::text,
		l.user_id,
		left(
			coalesce(nullif(btrim(l.resume_name), ''), 'Resume') || ' — ' ||
			coalesce(nullif(btrim(l.section->>'title'), ''), 'Cover letter'),
			100
		),
		coalesce(l.item->>'recipient', ''),
		coalesce(l.item->>'content', ''),
		jsonb_build_object(
			'basics', l.data->'basics',
			'picture', l.data->'picture',
			'metadata', (l.data->'metadata') - 'notes' - 'layout',
			'sectionId', l.section->>'id',
			'itemId', l.item->>'id'
		),
		'freeform',
		true,
		true,
		l.resume_id,
		CASE WHEN l.letters_in_resume = 1 THEN (
			SELECT min(a."id") FROM "application" a
			WHERE a."resume_id" = l.resume_id AND a."cover_letter_id" IS NULL
			HAVING count(*) = 1
		) END
	FROM letter_items l
	WHERE NOT EXISTS (
		SELECT 1 FROM "cover_letter" c
		WHERE c."user_id" = l.user_id
			AND c."source_resume_id" = l.resume_id
			AND c."style"->>'itemId' = l.item->>'id'
			AND c."content" = coalesce(l.item->>'content', '')
	)
	RETURNING "id", "user_id", "name", "recipient", "content", "style", "layout", "recipient_name",
		"recipient_company", "letter_date", "source_resume_id", "source_application_id"
),
versions AS (
	INSERT INTO "cover_letter_version" ("id", "cover_letter_id", "user_id", "data", "kind")
	SELECT
		gen_random_uuid()::text,
		"id",
		"user_id",
		jsonb_build_object(
			'name', "name",
			'recipient', "recipient",
			'content', "content",
			'style', "style",
			'layout', "layout",
			'recipientName', "recipient_name",
			'recipientCompany', "recipient_company",
			'letterDate', "letter_date"
		),
		'created'
	FROM inserted
	RETURNING "id"
)
UPDATE "application" a
SET "cover_letter_id" = inserted."id"
FROM inserted
WHERE a."id" = inserted."source_application_id" AND a."cover_letter_id" IS NULL;--> statement-breakpoint
WITH letters AS (
	SELECT r.id, array_agg(s.section->>'id') AS ids
	FROM "resume" r
	CROSS JOIN LATERAL jsonb_array_elements(r.data->'customSections') AS s(section)
	WHERE jsonb_typeof(r.data->'customSections') = 'array' AND s.section->>'type' = 'cover-letter'
	GROUP BY r.id
),
cleaned AS (
	SELECT
		r.id,
		letters.ids,
		jsonb_set(
			r.data,
			'{customSections}',
			(
				SELECT coalesce(jsonb_agg(s.section ORDER BY s.position), '[]'::jsonb)
				FROM jsonb_array_elements(r.data->'customSections') WITH ORDINALITY AS s(section, position)
				WHERE s.section->>'type' IS DISTINCT FROM 'cover-letter'
			)
		) AS data
	FROM "resume" r
	JOIN letters ON letters.id = r.id
)
UPDATE "resume" r
SET "data" = CASE
	WHEN jsonb_typeof(c.data#>'{metadata,layout,pages}') = 'array' THEN jsonb_set(
		c.data,
		'{metadata,layout,pages}',
		(
			SELECT coalesce(jsonb_agg(
				p.page
				|| CASE WHEN jsonb_typeof(p.page->'main') = 'array' THEN jsonb_build_object('main', (
					SELECT coalesce(jsonb_agg(m.id ORDER BY m.position), '[]'::jsonb)
					FROM jsonb_array_elements(p.page->'main') WITH ORDINALITY AS m(id, position)
					WHERE NOT (m.id #>> '{}') = ANY (c.ids)
				)) ELSE '{}'::jsonb END
				|| CASE WHEN jsonb_typeof(p.page->'sidebar') = 'array' THEN jsonb_build_object('sidebar', (
					SELECT coalesce(jsonb_agg(sb.id ORDER BY sb.position), '[]'::jsonb)
					FROM jsonb_array_elements(p.page->'sidebar') WITH ORDINALITY AS sb(id, position)
					WHERE NOT (sb.id #>> '{}') = ANY (c.ids)
				)) ELSE '{}'::jsonb END
				ORDER BY p.position
			), '[]'::jsonb)
			FROM jsonb_array_elements(c.data#>'{metadata,layout,pages}') WITH ORDINALITY AS p(page, position)
		)
	)
	ELSE c.data
END
FROM cleaned c
WHERE r.id = c.id;
