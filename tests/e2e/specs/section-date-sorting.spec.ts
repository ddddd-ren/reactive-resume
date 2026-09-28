import { Pool } from "pg";
import { createSampleResumeFromDashboard, openSidebarSection } from "../fixtures/resume";
import { expect, test } from "../fixtures/test";

type ExperienceItem = {
	id: string;
	company: string;
	position: string;
	location: string;
	period: string;
	description: string;
	hidden: boolean;
	website: { url: string; label: string; inlineLink: boolean };
	roles: [];
};

const experienceItem = (id: string, company: string, period: string): ExperienceItem => ({
	id,
	company,
	position: "Engineer",
	location: "",
	period,
	description: "",
	hidden: false,
	website: { url: "", label: "", inlineLink: false },
	roles: [],
});

function databasePool() {
	if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for section sorting E2E coverage.");
	return new Pool({ connectionString: process.env.DATABASE_URL });
}

async function seedExperienceItems(resumeId: string, items: ExperienceItem[]) {
	const pool = databasePool();
	try {
		const result = await pool.query<{ data: { sections: { experience: { items: ExperienceItem[] } } } }>(
			'select data from "resume" where id = $1',
			[resumeId],
		);
		const data = result.rows[0]?.data;
		if (!data) throw new Error(`Resume ${resumeId} was not found.`);
		data.sections.experience.items = items;
		await pool.query('update "resume" set data = $2, updated_at = now() where id = $1', [resumeId, data]);
	} finally {
		await pool.end();
	}
}

async function readExperienceItems(resumeId: string) {
	const pool = databasePool();
	try {
		const result = await pool.query<{ data: { sections: { experience: { items: ExperienceItem[] } } } }>(
			'select data from "resume" where id = $1',
			[resumeId],
		);
		const items = result.rows[0]?.data.sections.experience.items;
		if (!items) throw new Error(`Resume ${resumeId} was not found.`);
		return items;
	} finally {
		await pool.end();
	}
}

const itemIds = (items: ExperienceItem[]) => items.map(({ id }) => id);

test("sorts Experience once while preserving undo, persistence, later edits, and locking", async ({
	authPage: page,
}, testInfo) => {
	test.setTimeout(90_000);
	await createSampleResumeFromDashboard(page, testInfo);
	const resumeId = new URL(page.url()).pathname.match(/^\/builder\/([^/]+)/)?.[1];
	if (!resumeId) throw new Error(`Expected a builder URL, received ${page.url()}.`);
	const authoredItems = [
		experienceItem("unknown-sort", "Mystery Co", "Recently"),
		experienceItem("older-sort", "Older Co", "2018 - 2020"),
		experienceItem("current-sort", "Current Co", "2023 - Present"),
	];
	await seedExperienceItems(resumeId, authoredItems);
	await page.reload();
	await openSidebarSection(page, "Experience");
	const section = page.locator("#sidebar-experience");
	const renderedItemIds = () =>
		section
			.locator('[id^="resume-item-"]')
			.evaluateAll((nodes) => nodes.map(({ id }) => id.replace("resume-item-", "")));

	await expect.poll(renderedItemIds).toEqual(["unknown-sort", "older-sort", "current-sort"]);
	await section.getByRole("button", { name: "Options for Experience" }).click();
	await page.getByRole("menuitem", { name: "Sort by date" }).click();
	await expect(page.getByText("Could not sort these items; they stayed at the end: Mystery Co.")).toBeVisible();
	await expect
		.poll(async () => itemIds(await readExperienceItems(resumeId)))
		.toEqual(["current-sort", "older-sort", "unknown-sort"]);
	await expect.poll(renderedItemIds).toEqual(["current-sort", "older-sort", "unknown-sort"]);

	await page.getByRole("button", { name: "Undo", exact: true }).click();
	await expect
		.poll(async () => itemIds(await readExperienceItems(resumeId)))
		.toEqual(["unknown-sort", "older-sort", "current-sort"]);

	await section.getByRole("button", { name: "Options for Experience" }).click();
	await page.getByRole("menuitem", { name: "Sort by date" }).click();
	await expect
		.poll(async () => itemIds(await readExperienceItems(resumeId)))
		.toEqual(["current-sort", "older-sort", "unknown-sort"]);
	await page.reload();
	await openSidebarSection(page, "Experience");
	await expect.poll(renderedItemIds).toEqual(["current-sort", "older-sort", "unknown-sort"]);

	// Entries edit in place; the dates are structured, and the text dual-written from them.
	const current = page.locator("#resume-item-current-sort");
	await current.locator("button[aria-expanded]").first().click();
	await current.getByRole("switch", { name: "Present" }).click();
	await current.getByRole("textbox", { name: "Start" }).fill("2010");
	await current.getByRole("textbox", { name: "End" }).fill("2011");
	await expect
		.poll(async () => {
			const items = await readExperienceItems(resumeId);
			return { ids: itemIds(items), currentPeriod: items.find(({ id }) => id === "current-sort")?.period };
		})
		.toEqual({ ids: ["current-sort", "older-sort", "unknown-sort"], currentPeriod: "2010 – 2011" });

	// The document menu locks without asking; unlocking is one click away.
	await page.getByRole("button", { name: /^Document menu/ }).click();
	await page.getByRole("menuitem", { name: "Lock editing" }).click();
	// A locked resume is read-only: the row keeps its title but loses its menu and eye.
	await expect(section.getByRole("button", { name: "Options for Experience" })).toHaveCount(0);
	await expect(section.getByRole("button", { name: "Hide Experience from the page" })).toBeDisabled();
});
