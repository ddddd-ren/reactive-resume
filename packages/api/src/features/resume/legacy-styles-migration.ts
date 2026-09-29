import type { SemanticStylesheet } from "@reactive-resume/schema/resume/stylesheet";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { migrateLetterStylesheet, migrateResumeStylesheet } from "./legacy-styles";

const MIGRATION = "2026-09-legacy-style-rules-to-semantic-css";
const BATCH = 200;

type Target = {
	table: string;
	column: string;
	/** Where the `metadata` object sits inside the column (a letter version keeps it under `style`). */
	owner: readonly string[];
	convert: (owner: unknown) => SemanticStylesheet | null;
};

const TARGETS: readonly Target[] = [
	{ table: "resume", column: "data", owner: [], convert: migrateResumeStylesheet },
	{ table: "resume_version", column: "data", owner: [], convert: migrateResumeStylesheet },
	{ table: "cover_letter", column: "style", owner: [], convert: migrateLetterStylesheet },
	{ table: "cover_letter_version", column: "data", owner: ["style"], convert: migrateLetterStylesheet },
];

type Summary = Record<string, { migrated: number; skipped: number; failed: number }>;

const jsonPath = (...keys: string[]) => sql.raw(`'{${keys.join(",")}}'`);

/**
 * Converts every stored legacy style (old editor rules, or a legacy-mode stylesheet) to Semantic CSS, once. It only
 * rewrites `metadata.stylesheet` (the rules stay, for rollback), skips a row whose stylesheet changed since it was
 * read (retrying it next startup), and records itself in `data_migration` once nothing is left so later startups
 * skip it. A row whose data doesn't parse is left as it is and counted. Runs under the startup migration lock, so one server does it.
 */
export async function migrateLegacyStyles(db: NodePgDatabase): Promise<Summary | null> {
	const done = await db.execute(sql`SELECT 1 FROM "data_migration" WHERE "name" = ${MIGRATION}`);
	if (done.rows.length > 0) return null;

	const summary: Summary = {};
	for (const target of TARGETS) {
		const counts = { migrated: 0, skipped: 0, failed: 0 };
		summary[target.table] = counts;
		const table = sql.identifier(target.table);
		const column = sql.identifier(target.column);
		const metadata = jsonPath(...target.owner, "metadata");
		const stylesheetPath = jsonPath(...target.owner, "metadata", "stylesheet");
		const needsMigration = sql`(
			${column} #>> ${jsonPath(...target.owner, "metadata", "stylesheet", "mode")} = 'legacy'
			OR (
				jsonb_typeof(${column} #> ${stylesheetPath}) IS DISTINCT FROM 'object'
				AND jsonb_typeof(${column} #> ${jsonPath(...target.owner, "metadata", "styleRules")}) = 'array'
				AND jsonb_array_length(${column} #> ${jsonPath(...target.owner, "metadata", "styleRules")}) > 0
			)
		)`;

		let after = "";
		for (;;) {
			const batch = await db.execute<{ id: string; owner: unknown; stylesheet: unknown }>(sql`
				SELECT "id", ${column} #> ${jsonPath(...target.owner)} AS "owner", ${column} #> ${stylesheetPath} AS "stylesheet"
				FROM ${table}
				WHERE "id" > ${after} AND jsonb_typeof(${column} #> ${metadata}) = 'object' AND ${needsMigration}
				ORDER BY "id"
				LIMIT ${BATCH}
			`);
			if (batch.rows.length === 0) break;

			for (const row of batch.rows) {
				after = row.id;
				let stylesheet: SemanticStylesheet | null;
				try {
					stylesheet = target.convert(row.owner);
				} catch {
					counts.failed++;
					continue;
				}
				if (!stylesheet) continue;
				const updated = await db.execute(sql`
					UPDATE ${table}
					SET ${column} = jsonb_set(${column}, ${stylesheetPath}, ${JSON.stringify(stylesheet)}::jsonb)
					WHERE "id" = ${row.id}
						AND ${column} #> ${stylesheetPath} IS NOT DISTINCT FROM ${row.stylesheet === null ? null : JSON.stringify(row.stylesheet)}::jsonb
				`);
				if (updated.rowCount) counts.migrated++;
				else counts.skipped++;
			}
		}
	}

	// A row that changed while it was being migrated is picked up next startup; one whose data doesn't parse never will.
	if (Object.values(summary).every(({ skipped }) => skipped === 0))
		await db.execute(sql`INSERT INTO "data_migration" ("name") VALUES (${MIGRATION}) ON CONFLICT DO NOTHING`);
	return summary;
}
