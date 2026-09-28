import type { CoverLetterStyle } from "@reactive-resume/schema/cover-letter/data";
import * as pg from "drizzle-orm/pg-core";
import { generateId } from "@reactive-resume/utils/string";
import { application } from "./applications";
import { user } from "./auth";
import { resume } from "./resume";

export const coverLetter = pg.pgTable(
	"cover_letter",
	{
		id: pg
			.text("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		userId: pg
			.text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: pg.text("name").notNull(),
		recipient: pg.text("recipient").notNull().default(""),
		content: pg.text("content").notNull().default(""),
		style: pg.jsonb("style").$type<CoverLetterStyle>().notNull(),
		sourceResumeId: pg.text("source_resume_id").references(() => resume.id, { onDelete: "set null" }),
		sourceApplicationId: pg.text("source_application_id").references(() => application.id, { onDelete: "set null" }),
		tags: pg.text("tags").array().notNull().default([]),
		isLocked: pg.boolean("is_locked").notNull().default(false),
		// In Trash since this moment; purged after 30 days.
		trashedAt: pg.timestamp("trashed_at", { withTimezone: true }),
		revision: pg.integer("revision").notNull().default(1),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg
			.timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [pg.index().on(table.userId, table.updatedAt.desc(), table.id.desc())],
);
