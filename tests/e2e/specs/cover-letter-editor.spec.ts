import type { Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { createSampleResumeFromDashboard, openSidebarSection } from "../fixtures/resume";
import { expect, test } from "../fixtures/test";

/** New → "New cover letter instead" opens the letter editor on an untitled letter. */
async function newLetter(page: Page) {
	await page.goto("/dashboard");
	await page.getByRole("button", { name: "New", exact: true }).click();
	await page.getByRole("button", { name: "New cover letter instead" }).click();
	await page.waitForURL(/\/builder\/letter\/.+/);
	await expect(page.getByRole("button", { name: "Document menu: Untitled letter" })).toBeVisible();
}

const saved = (page: Page) => expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();

test("writes a letter for an application, from the resume's details, and downloads it", async ({
	authPage: page,
	account,
}, testInfo) => {
	test.setTimeout(90_000);
	const pool = new Pool({ connectionString: process.env.DATABASE_URL });
	try {
		await pool.query(
			'insert into application (id, user_id, company, role) select $1, id, $2, $3 from "user" where email = $4',
			[randomUUID(), "Lumen Health", "Senior Product Designer", account.email],
		);
		await createSampleResumeFromDashboard(page, testInfo);
		await newLetter(page);

		// A new letter takes its sender details from the resume edited last.
		await expect(page.getByRole("switch", { name: /^Use details from/ })).toBeChecked();

		// Linking the application fills the recipient; the greeting follows the name.
		await page.getByRole("button", { name: "Link an application" }).click();
		await page.getByRole("menuitem", { name: /Senior Product Designer/ }).click();
		await expect(page.getByLabel("Company")).toHaveValue("Lumen Health");
		await expect(page.getByText("Dear hiring team,").first()).toBeVisible();
		await page.getByLabel("Name or team").fill("Dana Reyes");
		await expect(page.getByText("Dear Dana,").first()).toBeVisible();

		await page.getByRole("button", { name: "Write it myself" }).click();
		await page.getByRole("textbox", { name: "Letter body" }).fill("I design calm tools for clinicians.");
		await saved(page);
		await expect(page.getByText("6 words")).toBeVisible();
		await expect(page.getByText("Short and direct. Fine if the posting asks for brevity.")).toBeVisible();

		await page.getByRole("button", { name: "Document menu: Untitled letter" }).click();
		await page.getByRole("menuitem", { name: "Rename…" }).click();
		const rename = page.getByRole("alertdialog", { name: "Rename letter" });
		await rename.getByRole("textbox").fill("Lumen letter");
		await rename.getByRole("button", { name: "Confirm" }).click();
		await saved(page);

		const pdfDownload = page.waitForEvent("download");
		await page.getByRole("button", { name: "Download PDF", exact: true }).click();
		const pdf = await pdfDownload;
		expect(pdf.suggestedFilename()).toMatch(/-Cover-Letter\.pdf$/);
		const pdfPath = await pdf.path();
		if (!pdfPath) throw new Error("PDF download did not produce a file.");
		expect((await readFile(pdfPath)).subarray(0, 5).toString()).toBe("%PDF-");

		await page.getByRole("button", { name: "Share", exact: true }).click();
		const sheet = page.getByRole("dialog", { name: "Share & export" });
		await sheet.getByRole("radio", { name: /^JSON/ }).click();
		const jsonDownload = page.waitForEvent("download");
		await sheet.getByRole("button", { name: "Download JSON" }).click();
		const jsonPath = await (await jsonDownload).path();
		if (!jsonPath) throw new Error("JSON download did not produce a file.");
		const document = JSON.parse(await readFile(jsonPath, "utf8"));
		expect(document).toMatchObject({
			format: "reactive-resume-cover-letter",
			name: "Lumen letter",
			layout: "structured",
			recipientName: "Dana Reyes",
			recipientCompany: "Lumen Health",
		});
		await page.keyboard.press("Escape");

		// The application sends this letter, and opens it from What you sent.
		await page.goto("/dashboard/applications");
		await page
			.getByRole("button", { name: /Senior Product Designer/ })
			.first()
			.click();
		const detail = page.getByRole("dialog", { name: "Senior Product Designer" });
		await expect(detail.getByText("Lumen letter")).toBeVisible();
		await detail.getByRole("link", { name: "Open" }).last().click();
		await page.waitForURL(/\/builder\/letter\/.+/);
		await expect(page.getByRole("textbox", { name: "Letter body" })).toContainText("calm tools");

		// Old links to the letter dialog open the editor.
		const letterUrl = page.url();
		const letterId = letterUrl.split("/").at(-1);
		await page.goto(`/dashboard?letter=${letterId}`);
		await page.waitForURL(letterUrl);
	} finally {
		await pool.end();
	}
});

test("names a version, restores it, and copies the letter into a resume", async ({ authPage: page }, testInfo) => {
	test.setTimeout(90_000);
	await createSampleResumeFromDashboard(page, testInfo);
	const builderUrl = page.url();
	await newLetter(page);

	await page.getByRole("button", { name: "Write it myself" }).click();
	const body = page.getByRole("textbox", { name: "Letter body" });
	await body.fill("The first version of the letter.");
	await saved(page);

	await page.getByRole("button", { name: "History", exact: true }).click();
	const sheet = page.getByRole("dialog", { name: "Share & export" });
	const versions = sheet.getByRole("list", { name: "Versions" });
	await sheet.getByRole("textbox", { name: "Name this version" }).fill("First");
	await sheet.getByRole("button", { name: "Save", exact: true }).click();
	await expect(versions.getByRole("button", { name: /^First/ })).toBeVisible();
	await page.keyboard.press("Escape");

	await body.fill("A second version that replaces it.");
	await saved(page);

	await page.getByRole("button", { name: "History", exact: true }).click();
	await versions.getByRole("button", { name: /^First/ }).click();
	await expect(sheet.getByRole("status").filter({ hasText: /Viewing .* · First · read-only/ })).toBeVisible();
	await sheet.getByRole("button", { name: "Restore this version" }).click();
	await expect(versions.getByRole("button", { name: /^Before restore/ })).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(body).toContainText("The first version of the letter.");

	// A saved letter can start a letter inside a resume, as a copy that doesn't follow later edits.
	await page.goto(builderUrl);
	await openSidebarSection(page, "Cover Letter");
	await page.getByRole("button", { name: "Add cover letter", exact: true }).click();
	await page.getByLabel("Import from library", { exact: true }).click();
	await page.getByRole("option", { name: "Untitled letter", exact: true }).click();
	await expect(page.getByRole("textbox", { name: "Letter", exact: true })).toContainText("first version");
});
