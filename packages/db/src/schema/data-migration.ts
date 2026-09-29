import * as pg from "drizzle-orm/pg-core";

/**
 * Data migrations that run in code at startup, after the SQL migrations (converting stored data needs app code). Each
 * is recorded here once it has finished, so later startups skip it without scanning the tables again.
 */
export const dataMigration = pg.pgTable("data_migration", {
	name: pg.text("name").primaryKey(),
	completedAt: pg.timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
});
